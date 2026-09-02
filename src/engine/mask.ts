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

const FINDER_ALIKE = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];

/**
 * Score a finished matrix against the four penalty rules, collecting the
 * offending geometry as it goes. The gallery highlights `features` on the
 * matrix itself, so the number and the picture come from one pass.
 */
export function scoreMask(
  grid: (x: number, y: number) => boolean,
  size: number,
  mask: number,
): MaskScore {
  const features: PenaltyFeature[] = [];
  let rule1 = 0;
  let rule2 = 0;
  let rule3 = 0;

  // Rule 1: runs of five or more modules of one colour, in rows and columns.
  const scanRuns = (orientation: 'row' | 'col') => {
    for (let a = 0; a < size; a++) {
      let runColour = grid(orientation === 'row' ? 0 : a, orientation === 'row' ? a : 0);
      let runStart = 0;
      for (let b = 1; b <= size; b++) {
        const colour =
          b < size ? grid(orientation === 'row' ? b : a, orientation === 'row' ? a : b) : !runColour;
        if (colour === runColour) continue;
        const length = b - runStart;
        if (length >= 5) {
          const points = 3 + (length - 5);
          rule1 += points;
          const cells: Array<[number, number]> = [];
          for (let k = runStart; k < b; k++) {
            cells.push(orientation === 'row' ? [k, a] : [a, k]);
          }
          features.push({ rule: 1, cells, points, orientation });
        }
        runColour = colour;
        runStart = b;
      }
    }
  };
  scanRuns('row');
  scanRuns('col');

  // Rule 2: every 2x2 block of a single colour costs 3.
  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const v = grid(x, y);
      if (grid(x + 1, y) === v && grid(x, y + 1) === v && grid(x + 1, y + 1) === v) {
        rule2 += 3;
        features.push({
          rule: 2,
          cells: [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]],
          points: 3,
          orientation: 'block',
        });
      }
    }
  }

  // Rule 3: the 1:1:3:1:1 finder-alike run with four light modules beside it.
  const matchAt = (x: number, y: number, dx: number, dy: number, reversed: boolean) => {
    for (let k = 0; k < 11; k++) {
      const want = FINDER_ALIKE[reversed ? 10 - k : k] === 1;
      if (grid(x + dx * k, y + dy * k) !== want) return false;
    }
    return true;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      for (const reversed of [false, true]) {
        if (x + 10 < size && matchAt(x, y, 1, 0, reversed)) {
          rule3 += 40;
          features.push({
            rule: 3,
            cells: Array.from({ length: 11 }, (_, k) => [x + k, y] as [number, number]),
            points: 40,
            orientation: 'row',
          });
        }
        if (y + 10 < size && matchAt(x, y, 0, 1, reversed)) {
          rule3 += 40;
          features.push({
            rule: 3,
            cells: Array.from({ length: 11 }, (_, k) => [x, y + k] as [number, number]),
            points: 40,
            orientation: 'col',
          });
        }
      }
    }
  }

  // Rule 4: how far the dark/light balance strays from even.
  let darkCount = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) if (grid(x, y)) darkCount++;
  }
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
    features,
  };
}

/** The lowest total wins; ties go to the lower mask number, as the spec says. */
export function chooseMask(scores: MaskScore[]): number {
  let best = scores[0];
  for (const s of scores) if (s.total < best.total) best = s;
  return best.mask;
}
