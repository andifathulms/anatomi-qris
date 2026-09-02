import { describe, it, expect } from 'vitest';
import {
  EC_LEVELS,
  MAX_VERSION,
  alignmentCentres,
  blockSpec,
  blockCount,
  dataCodewordCount,
  eccCodewordCount,
  formatInfo,
  remainderBits,
  totalCodewords,
  versionInfo,
} from '../src/engine/tables';

/**
 * Data-region capacity from geometry alone (ISO/IEC 18004 §7.3 counted
 * directly), which is an independent derivation from the RS block table.
 */
function dataModules(version: number): number {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const numAlign = Math.floor(version / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (version >= 7) result -= 36;
  }
  return result;
}

describe('capacity table', () => {
  it('agrees with the geometry for every supported version and level', () => {
    for (let v = 1; v <= MAX_VERSION; v++) {
      const expected = dataModules(v);
      for (const ec of EC_LEVELS) {
        expect(totalCodewords(v, ec) * 8 + remainderBits(v)).toBe(expected);
      }
    }
  });

  it('gives every block in a version the same EC codeword count', () => {
    for (let v = 1; v <= MAX_VERSION; v++) {
      for (const ec of EC_LEVELS) {
        const s = blockSpec(v, ec);
        expect(blockCount(v, ec)).toBe(s.group1Blocks + s.group2Blocks);
        expect(eccCodewordCount(v, ec)).toBe(s.eccPerBlock * blockCount(v, ec));
        if (s.group2Blocks > 0) {
          expect(s.group2DataCodewords).toBe(s.group1DataCodewords + 1);
        }
      }
    }
  });

  it('shrinks data capacity as error correction rises', () => {
    for (let v = 1; v <= MAX_VERSION; v++) {
      const [l, m, q, h] = EC_LEVELS.map((ec) => dataCodewordCount(v, ec));
      expect(l).toBeGreaterThan(m);
      expect(m).toBeGreaterThan(q);
      expect(q).toBeGreaterThan(h);
    }
  });
});

describe('alignment pattern centres', () => {
  it('matches ISO/IEC 18004 Annex E for versions 1–15', () => {
    const spec: Record<number, number[]> = {
      1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34],
      7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
      11: [6, 30, 54], 12: [6, 32, 58], 13: [6, 34, 62], 14: [6, 26, 46, 66],
      15: [6, 26, 48, 70],
    };
    for (let v = 1; v <= MAX_VERSION; v++) {
      expect(alignmentCentres(v)).toEqual(spec[v]);
    }
  });
});

describe('BCH information fields', () => {
  it('computes the 32 format strings from Annex C', () => {
    const spec = [
      0x77c4, 0x72f3, 0x7daa, 0x789d, 0x662f, 0x6318, 0x6c41, 0x6976,
      0x5412, 0x5125, 0x5e7c, 0x5b4b, 0x45f9, 0x40ce, 0x4f97, 0x4aa0,
      0x355f, 0x3068, 0x3f31, 0x3a06, 0x24b4, 0x2183, 0x2eda, 0x2bed,
      0x1689, 0x13be, 0x1ce7, 0x19d0, 0x0762, 0x0255, 0x0d0c, 0x083b,
    ];
    const order = ['L', 'M', 'Q', 'H'] as const;
    let i = 0;
    for (const ec of order) {
      for (let mask = 0; mask < 8; mask++) {
        expect(formatInfo(ec, mask)).toBe(spec[i++]);
      }
    }
  });

  it('computes the version strings from Annex D', () => {
    const spec: Record<number, number> = {
      7: 0x07c94, 8: 0x085bc, 9: 0x09a99, 10: 0x0a4d3, 11: 0x0bbf6,
      12: 0x0c762, 13: 0x0d847, 14: 0x0e60d, 15: 0x0f928,
    };
    for (let v = 7; v <= MAX_VERSION; v++) expect(versionInfo(v)).toBe(spec[v]);
  });
});
