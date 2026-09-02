import type { ModuleInfo, ModuleRole } from './provenance';
import type { InterleaveSource } from './blocks';
import {
  alignmentCentres,
  formatInfo,
  hasVersionInfo,
  matrixSize,
  versionInfo,
  type EcLevel,
} from './tables';

export const UNSET = -1;

/**
 * The working matrix. Roles are recorded as each module is written rather
 * than reconstructed afterwards — that is what makes the provenance map free
 * and what stops any view from having to recompute geometry.
 */
export class MatrixCanvas {
  readonly size: number;
  /** 0 light, 1 dark, -1 not yet written. */
  readonly values: Int8Array;
  readonly preMask: Int8Array;
  readonly reserved: Uint8Array;
  readonly roles: Array<ModuleRole | null>;
  readonly placementOrder: Int32Array;
  readonly maskedFlag: Uint8Array;

  constructor(readonly version: number) {
    this.size = matrixSize(version);
    const n = this.size * this.size;
    this.values = new Int8Array(n).fill(UNSET);
    this.preMask = new Int8Array(n).fill(UNSET);
    this.reserved = new Uint8Array(n);
    this.roles = new Array(n).fill(null);
    this.placementOrder = new Int32Array(n).fill(-1);
    this.maskedFlag = new Uint8Array(n);
  }

  idx(x: number, y: number): number {
    return y * this.size + x;
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.size && y < this.size;
  }

  set(x: number, y: number, dark: boolean, role: ModuleRole, reserve = true): void {
    const i = this.idx(x, y);
    this.values[i] = dark ? 1 : 0;
    this.preMask[i] = dark ? 1 : 0;
    this.roles[i] = role;
    if (reserve) this.reserved[i] = 1;
  }

  get(x: number, y: number): boolean {
    return this.values[this.idx(x, y)] === 1;
  }
}

/** Finder patterns, their separators, timing, alignment and the dark module. */
export function drawFunctionPatterns(c: MatrixCanvas): void {
  const size = c.size;

  const corners: Array<['tl' | 'tr' | 'bl', number, number]> = [
    ['tl', 0, 0],
    ['tr', size - 7, 0],
    ['bl', 0, size - 7],
  ];

  for (const [corner, ox, oy] of corners) {
    for (let dy = -1; dy <= 7; dy++) {
      for (let dx = -1; dx <= 7; dx++) {
        const x = ox + dx;
        const y = oy + dy;
        if (!c.inBounds(x, y)) continue;
        const outside = dx < 0 || dy < 0 || dx > 6 || dy > 6;
        if (outside) {
          c.set(x, y, false, { kind: 'separator' });
          continue;
        }
        const ring = Math.max(Math.abs(dx - 3), Math.abs(dy - 3));
        c.set(x, y, ring !== 2, { kind: 'finder', corner });
      }
    }
  }

  for (let i = 8; i < size - 8; i++) {
    const dark = i % 2 === 0;
    c.set(i, 6, dark, { kind: 'timing', axis: 'row' });
    c.set(6, i, dark, { kind: 'timing', axis: 'col' });
  }

  const centres = alignmentCentres(c.version);
  let alignmentIndex = 0;
  for (const cy of centres) {
    for (const cx of centres) {
      const nearFinder =
        (cx === 6 && cy === 6) ||
        (cx === 6 && cy === size - 7) ||
        (cx === size - 7 && cy === 6);
      if (nearFinder) continue;
      const index = alignmentIndex++;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const ring = Math.max(Math.abs(dx), Math.abs(dy));
          c.set(cx + dx, cy + dy, ring !== 1, { kind: 'alignment', index });
        }
      }
    }
  }

  // The dark module: always at (8, 4*version + 9).
  c.set(8, 4 * c.version + 9, true, { kind: 'darkModule' });
}

/** Reserve the format and version areas so the zigzag walks around them. */
export function reserveInfoAreas(c: MatrixCanvas): void {
  const size = c.size;
  for (let i = 0; i <= 8; i++) {
    if (i !== 6) {
      c.reserved[c.idx(i, 8)] = 1;
      c.reserved[c.idx(8, i)] = 1;
    }
  }
  for (let i = 0; i < 8; i++) {
    c.reserved[c.idx(size - 1 - i, 8)] = 1;
    c.reserved[c.idx(8, size - 1 - i)] = 1;
  }
  if (hasVersionInfo(c.version)) {
    for (let i = 0; i < 18; i++) {
      const a = Math.floor(i / 3);
      const b = i % 3;
      c.reserved[c.idx(a, size - 11 + b)] = 1;
      c.reserved[c.idx(size - 11 + b, a)] = 1;
    }
  }
}

export interface PlacementResult {
  /** Number of modules written by the zigzag, in order. */
  placed: number;
  remainder: number;
}

/**
 * The zigzag: two-module-wide columns from the bottom right, snaking up and
 * down, skipping the vertical timing column and every reserved module. The
 * placement order recorded here is exactly the order the animation replays.
 */
export function placeCodewords(
  c: MatrixCanvas,
  stream: Uint8Array,
  dataCodewordCount: number,
  sources: InterleaveSource[],
  blockDataStart: number[],
  eccPerBlock: number,
): PlacementResult {
  const size = c.size;
  let bitIndex = 0;
  let order = 0;
  let remainder = 0;
  const totalBits = stream.length * 8;

  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    const upward = ((right + 1) & 2) === 0;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const y = upward ? size - 1 - vert : vert;
        const i = c.idx(x, y);
        if (c.reserved[i]) continue;

        let role: ModuleRole;
        let dark = false;

        if (bitIndex < totalBits) {
          const streamIndex = bitIndex >> 3;
          const bit = bitIndex & 7;
          dark = ((stream[streamIndex] >>> (7 - bit)) & 1) === 1;
          const src = sources[streamIndex];
          if (streamIndex < dataCodewordCount) {
            role = {
              kind: 'data',
              codeword: blockDataStart[src.block] + src.offset,
              bit,
              block: src.block,
              streamIndex,
            };
          } else {
            role = {
              kind: 'ecc',
              codeword: src.block * eccPerBlock + src.offset,
              bit,
              block: src.block,
              streamIndex,
            };
          }
          bitIndex++;
        } else {
          role = { kind: 'remainder', index: remainder++ };
        }

        c.values[i] = dark ? 1 : 0;
        c.preMask[i] = dark ? 1 : 0;
        c.roles[i] = role;
        c.placementOrder[i] = order++;
      }
    }
  }

  return { placed: order, remainder };
}

/** Write the 15-bit format information into both of its copies. */
export function drawFormatInfo(c: MatrixCanvas, ec: EcLevel, mask: number): void {
  const size = c.size;
  const bits = formatInfo(ec, mask);
  for (let i = 0; i < 15; i++) {
    const dark = ((bits >>> i) & 1) === 1;
    // Copy 0: around the top-left finder.
    if (i < 6) c.set(8, i, dark, { kind: 'format', bit: i, copy: 0 });
    else if (i === 6) c.set(8, 7, dark, { kind: 'format', bit: i, copy: 0 });
    else if (i === 7) c.set(8, 8, dark, { kind: 'format', bit: i, copy: 0 });
    else if (i === 8) c.set(7, 8, dark, { kind: 'format', bit: i, copy: 0 });
    else c.set(14 - i, 8, dark, { kind: 'format', bit: i, copy: 0 });

    // Copy 1: split between the bottom-left and top-right finders.
    if (i < 8) c.set(size - 1 - i, 8, dark, { kind: 'format', bit: i, copy: 1 });
    else c.set(8, size - 15 + i, dark, { kind: 'format', bit: i, copy: 1 });
  }
}

/** Write the 18-bit version information. Versions 7 and up only. */
export function drawVersionInfo(c: MatrixCanvas): void {
  if (!hasVersionInfo(c.version)) return;
  const size = c.size;
  const bits = versionInfo(c.version);
  for (let i = 0; i < 18; i++) {
    const dark = ((bits >>> i) & 1) === 1;
    const a = Math.floor(i / 3);
    const b = i % 3;
    c.set(a, size - 11 + b, dark, { kind: 'version', bit: i, copy: 0 });
    c.set(size - 11 + b, a, dark, { kind: 'version', bit: i, copy: 1 });
  }
}

/** Collect the finished canvas into the flat, row-major ModuleInfo array. */
export function toModules(c: MatrixCanvas): ModuleInfo[] {
  const out: ModuleInfo[] = new Array(c.size * c.size);
  for (let y = 0; y < c.size; y++) {
    for (let x = 0; x < c.size; x++) {
      const i = c.idx(x, y);
      const role = c.roles[i];
      if (!role) throw new Error(`module ${x},${y} has no role`);
      const orderValue = c.placementOrder[i];
      out[i] = {
        x,
        y,
        value: c.values[i] === 1,
        preMask: c.preMask[i] === 1,
        masked: c.maskedFlag[i] === 1,
        role,
        placementOrder: orderValue < 0 ? null : orderValue,
      };
    }
  }
  return out;
}
