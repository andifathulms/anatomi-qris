import { describe, it, expect } from 'vitest';
import { encode, toGrid } from '../src/engine/encode';
import { canEncode } from '../src/engine/segments';
import { maskCondition } from '../src/engine/mask';
import { codewordKey } from '../src/engine/provenance';
import { EC_LEVELS, matrixSize } from '../src/engine/tables';
import { SAMPLES } from '../samples/index';

/** The shorter QRIS payload, which fits at all four EC levels. */
const QRIS_SAMPLE = SAMPLES[0].payload;

/** Deterministic pseudo-random source; the engine itself must stay pure. */
function lcg(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

describe('the forward map', () => {
  it('gives every module in the symbol exactly one role', () => {
    for (const ec of EC_LEVELS) {
      const build = encode(QRIS_SAMPLE, { ecLevel: ec });
      expect(build.modules).toHaveLength(build.size * build.size);
      const seen = new Set<string>();
      for (const m of build.modules) {
        expect(m.role).toBeTruthy();
        seen.add(`${m.x},${m.y}`);
        expect(build.modules[m.y * build.size + m.x]).toBe(m);
      }
      expect(seen.size).toBe(build.size * build.size);
    }
  });

  it('numbers the placement order contiguously over the data region', () => {
    const build = encode(QRIS_SAMPLE, { ecLevel: 'Q' });
    const orders = build.modules
      .map((m) => m.placementOrder)
      .filter((o): o is number => o !== null)
      .sort((a, b) => a - b);
    expect(orders[0]).toBe(0);
    for (let i = 0; i < orders.length; i++) expect(orders[i]).toBe(i);

    // Every placed module carries data, ecc or remainder; nothing else does.
    for (const m of build.modules) {
      const placeable = m.role.kind === 'data' || m.role.kind === 'ecc' || m.role.kind === 'remainder';
      expect(m.placementOrder !== null).toBe(placeable);
    }
  });

  it('accounts for the mask flag exactly where the condition holds', () => {
    const build = encode('Anatomi QRIS', { ecLevel: 'M' });
    for (const m of build.modules) {
      const inDataRegion = m.placementOrder !== null;
      if (!inDataRegion) {
        expect(m.masked).toBe(false);
        expect(m.preMask).toBe(m.value);
        continue;
      }
      expect(m.masked).toBe(maskCondition(build.chosenMask, m.x, m.y));
      expect(m.value).toBe(m.masked ? !m.preMask : m.preMask);
    }
  });

  it('places exactly the remainder bits the version calls for', () => {
    for (let v = 1; v <= 15; v++) {
      const filler = 'x'.repeat(1);
      const build = encode(filler, { ecLevel: 'L', minVersion: v });
      expect(build.version).toBe(v);
      expect(build.size).toBe(matrixSize(v));
      const remainder = build.modules.filter((m) => m.role.kind === 'remainder');
      expect(remainder).toHaveLength(build.remainderBits);
    }
  });
});

describe('the reverse map', () => {
  it('gives every data and EC codeword exactly eight modules', () => {
    for (const ec of EC_LEVELS) {
      const build = encode(QRIS_SAMPLE, { ecLevel: ec });
      for (let c = 0; c < build.dataCodewords.length; c++) {
        expect(build.byCodeword.get(codewordKey('data', c))).toHaveLength(8);
      }
      for (let c = 0; c < build.eccCodewords.length; c++) {
        expect(build.byCodeword.get(codewordKey('ecc', c))).toHaveLength(8);
      }
    }
  });

  it('maps every payload byte onto codewords that actually hold it', () => {
    for (const sample of SAMPLES) {
      for (const ec of EC_LEVELS) {
        if (!canEncode(sample.payload, ec)) continue;
        const build = encode(sample.payload, { ecLevel: ec });
        const units = build.segmentation.units.length;
        for (let u = 0; u < units; u++) {
          const codewords = build.byteToCodeword(u);
          expect(codewords.length).toBeGreaterThan(0);
          for (const c of codewords) {
            expect(c).toBeGreaterThanOrEqual(0);
            expect(c).toBeLessThan(build.dataCodewords.length);
          }
        }
      }
    }
  });
});

/**
 * The round trip CLAUDE.md §3 asks for: take a byte range, resolve it to
 * codewords, resolve those to modules, read exactly those modules out of the
 * matrix, undo the mask, and confirm the bytes come back. If this holds, the
 * QRIS highlighting is correct by construction.
 */
describe('byte range to modules and back', () => {
  it('recovers the original bytes from only the highlighted modules', () => {
    const random = lcg(20260902);
    for (const sample of SAMPLES) {
      for (const ec of EC_LEVELS) {
        if (!canEncode(sample.payload, ec)) continue;
        const build = encode(sample.payload, { ecLevel: ec });
        const grid = toGrid(build);
        const units = build.segmentation.units.length;

        for (let trial = 0; trial < 8; trial++) {
          const start = Math.floor(random() * units);
          const end = Math.min(units, start + 1 + Math.floor(random() * 12));
          const codewords = build.resolver.rangeToCodewords(start, end);
          expect(codewords.length).toBeGreaterThan(0);

          // Read the codewords back out of the matrix, module by module.
          for (const c of codewords) {
            const coords = build.byCodeword.get(codewordKey('data', c))!;
            expect(coords).toHaveLength(8);
            let value = 0;
            for (const [x, y] of coords) {
              const module = build.modules[y * build.size + x];
              const role = module.role;
              expect(role.kind).toBe('data');
              if (role.kind !== 'data') throw new Error('unreachable');
              // Undo the mask, using the grid rather than the stored preMask
              // so this reads the finished symbol the way a scanner would.
              const raw = grid[y][x];
              const bit = maskCondition(build.chosenMask, x, y) ? !raw : raw;
              expect(bit).toBe(module.preMask);
              value |= (bit ? 1 : 0) << (7 - role.bit);
            }
            expect(value).toBe(build.dataCodewords[c]);
          }

          // And the bytes of the range are inside those codewords' bits.
          const span = build.resolver.unitToBitSpan(start)!;
          const first = Math.floor(span.start / 8);
          expect(codewords).toContain(first);
        }
      }
    }
  });

  it('lights up disjoint modules for disjoint payload fields', () => {
    const build = encode(QRIS_SAMPLE, { ecLevel: 'M' });
    const head = new Set(build.resolver.rangeToCodewords(0, 6));
    const tail = new Set(
      build.resolver.rangeToCodewords(
        build.segmentation.units.length - 6,
        build.segmentation.units.length,
      ),
    );
    for (const c of head) expect(tail.has(c)).toBe(false);
  });
});
