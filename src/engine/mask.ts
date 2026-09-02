import type { MatrixCanvas } from './matrix';

export type PenaltyRule = 1 | 2 | 3 | 4;

export interface PenaltyFeature {
  rule: PenaltyRule;
  /** The offending modules, so the gallery can draw the feature in place. */
  cells: Array<[number, number]>;
  points: number;
  orientation: 'row' | 'col' | 'block';
}

export interface MaskScore {
  mask: number;
  rule1: number;
  rule2: number;
  rule3: number;
  rule4: number;
  total: number;
  darkCount: number;
  darkRatio: number;
  features: PenaltyFeature[];
}

/**
 * The eight mask conditions of ISO/IEC 18004 §7.8.2. A module is flipped when
 * the condition holds. Note the spec's (i, j) is (row, column) — the argument
 * order here is (x, y) to match the rest of the engine.
 */
export function maskCondition(mask: number, x: number, y: number): boolean {
  switch (mask) {
    case 0: return (y + x) % 2 === 0;
    case 1: return y % 2 === 0;
    case 2: return x % 3 === 0;
    case 3: return (y + x) % 3 === 0;
    case 4: return (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0;
    case 5: return ((y * x) % 2) + ((y * x) % 3) === 0;
    case 6: return (((y * x) % 2) + ((y * x) % 3)) % 2 === 0;
    case 7: return (((y + x) % 2) + ((y * x) % 3)) % 2 === 0;
    default: throw new Error(`mask ${mask} is not one of the eight patterns`);
  }
}

/** Apply a mask to the data region in place, recording which modules flipped. */
export function applyMask(c: MatrixCanvas, mask: number): void {
  for (let y = 0; y < c.size; y++) {
    for (let x = 0; x < c.size; x++) {
      const i = c.idx(x, y);
      if (c.reserved[i]) continue;
      const flip = maskCondition(mask, x, y);
      c.maskedFlag[i] = flip ? 1 : 0;
      c.values[i] = flip ? (c.preMask[i] === 1 ? 0 : 1) : c.preMask[i];
    }
  }
}

/** The 1:1:3:1:1 finder-alike run, as an 11-bit pattern and its reverse. */
const FINDER_ALIKE = 0b10111010000;
const FINDER_ALIKE_REVERSED = 0b00001011101;

/**
 * Score a matrix against the four penalty rules.
 *
 * The hot path indexes the grid directly and slides an 11-bit register for
 * rule 3, because encode() runs this eight times on every keystroke. Passing
 * `collectFeatures` walks the same rules again recording the offending
 * geometry; the gallery asks for that only for the mask it is showing, via
 * maskFeatures() below, so the picture still comes from the scored grid rather
 * than from a re-enactment of it.
 */
export function scoreMask(
  grid: Uint8Array,
  size: number,
  mask: number,
  collectFeatures = false,
): MaskScore {
  let rule1 = 0;
  let rule2 = 0;
  let rule3 = 0;
  let darkCount = 0;

  for (let a = 0; a < size; a++) {
    let rowRun = 1;
    let colRun = 1;
    let rowBits = grid[a * size];
    let colBits = grid[a];

    for (let b = 1; b < size; b++) {
      const rowValue = grid[a * size + b];
      const colValue = grid[b * size + a];

      // Rule 1, both orientations in one pass.
      if (rowValue === grid[a * size + b - 1]) rowRun++;
      else {
        if (rowRun >= 5) rule1 += 3 + (rowRun - 5);
        rowRun = 1;
      }
      if (colValue === grid[(b - 1) * size + a]) colRun++;
      else {
        if (colRun >= 5) rule1 += 3 + (colRun - 5);
        colRun = 1;
      }

      // Rule 3, as a sliding 11-bit window.
      rowBits = ((rowBits << 1) & 0x7ff) | rowValue;
      colBits = ((colBits << 1) & 0x7ff) | colValue;
      if (b >= 10) {
        if (rowBits === FINDER_ALIKE || rowBits === FINDER_ALIKE_REVERSED) rule3 += 40;
        if (colBits === FINDER_ALIKE || colBits === FINDER_ALIKE_REVERSED) rule3 += 40;
      }
    }
    if (rowRun >= 5) rule1 += 3 + (rowRun - 5);
    if (colRun >= 5) rule1 += 3 + (colRun - 5);
  }

  // Rule 2: every 2x2 block of a single colour costs 3.
  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const i = y * size + x;
      const v = grid[i];
      if (grid[i + 1] === v && grid[i + size] === v && grid[i + size + 1] === v) rule2 += 3;
    }
  }

  for (let i = 0; i < grid.length; i++) darkCount += grid[i];

  // Rule 4: how far the dark/light balance strays from even, in whole 5%
  // steps. ISO/IEC 18004 Table 11 -- the floor, not the ceiling.
  const total = size * size;
  const percent = (darkCount * 100) / total;
  const rule4 = Math.floor(Math.abs(percent - 50) / 5) * 10;

  return {
    mask,
    rule1,
    rule2,
    rule3,
    rule4,
    total: rule1 + rule2 + rule3 + rule4,
    darkCount,
    darkRatio: darkCount / total,
    features: collectFeatures ? collectPenaltyFeatures(grid, size) : [],
  };
}

/** The offending geometry behind the scores, for the gallery's highlights. */
export function collectPenaltyFeatures(grid: Uint8Array, size: number): PenaltyFeature[] {
  const features: PenaltyFeature[] = [];
  const at = (x: number, y: number) => grid[y * size + x];

  for (const orientation of ['row', 'col'] as const) {
    for (let a = 0; a < size; a++) {
      let runColour = orientation === 'row' ? at(0, a) : at(a, 0);
      let runStart = 0;
      for (let b = 1; b <= size; b++) {
        const colour =
          b < size
            ? orientation === 'row' ? at(b, a) : at(a, b)
            : (runColour ^ 1);
        if (colour === runColour) continue;
        const length = b - runStart;
        if (length >= 5) {
          const cells: Array<[number, number]> = [];
          for (let k = runStart; k < b; k++) {
            cells.push(orientation === 'row' ? [k, a] : [a, k]);
          }
          features.push({ rule: 1, cells, points: 3 + (length - 5), orientation });
        }
        runColour = colour;
        runStart = b;
      }
    }
  }

  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const v = at(x, y);
      if (at(x + 1, y) === v && at(x, y + 1) === v && at(x + 1, y + 1) === v) {
        features.push({
          rule: 2,
          cells: [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]],
          points: 3,
          orientation: 'block',
        });
      }
    }
  }

  for (let a = 0; a < size; a++) {
    let rowBits = at(0, a);
    let colBits = at(a, 0);
    for (let b = 1; b < size; b++) {
      rowBits = ((rowBits << 1) & 0x7ff) | at(b, a);
      colBits = ((colBits << 1) & 0x7ff) | at(a, b);
      if (b < 10) continue;
      if (rowBits === FINDER_ALIKE || rowBits === FINDER_ALIKE_REVERSED) {
        features.push({
          rule: 3,
          cells: Array.from({ length: 11 }, (_, k) => [b - 10 + k, a] as [number, number]),
          points: 40,
          orientation: 'row',
        });
      }
      if (colBits === FINDER_ALIKE || colBits === FINDER_ALIKE_REVERSED) {
        features.push({
          rule: 3,
          cells: Array.from({ length: 11 }, (_, k) => [a, b - 10 + k] as [number, number]),
          points: 40,
          orientation: 'col',
        });
      }
    }
  }

  return features;
}

/** The lowest total wins; ties go to the lower mask number, as the spec says. */
export function chooseMask(scores: MaskScore[]): number {
  let best = scores[0];
  for (const s of scores) if (s.total < best.total) best = s;
  return best.mask;
}
