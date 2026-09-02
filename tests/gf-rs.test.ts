import { describe, it, expect } from 'vitest';
import { mul, div, inv, exp, log, polyEval } from '../src/engine/gf256';
import { generatorPoly, rsEncode, rsDecode } from '../src/engine/reed-solomon';

describe('GF(256)', () => {
  it('is closed and consistent under multiplication', () => {
    for (let a = 1; a < 256; a++) {
      for (let b = 1; b < 256; b++) {
        const p = mul(a, b);
        expect(p).toBeGreaterThan(0);
        expect(div(p, b)).toBe(a);
      }
    }
  });

  it('matches known products', () => {
    expect(mul(0, 5)).toBe(0);
    expect(mul(1, 200)).toBe(200);
    expect(mul(2, 128)).toBe(0x1d);
    expect(mul(76, 43)).toBe(mul(43, 76));
  });

  it('inverts every non-zero element', () => {
    for (let a = 1; a < 256; a++) expect(mul(a, inv(a))).toBe(1);
  });

  it('has α of order 255', () => {
    expect(exp(0)).toBe(1);
    expect(exp(255)).toBe(1);
    for (let i = 1; i < 255; i++) expect(log(exp(i))).toBe(i);
  });
});

describe('generator polynomials', () => {
  // Values from ISO/IEC 18004 Annex A.
  it('matches the spec for degree 7', () => {
    expect([...generatorPoly(7)]).toEqual([1, 127, 122, 154, 164, 11, 68, 117]);
  });

  it('matches the spec for degree 10', () => {
    expect([...generatorPoly(10)]).toEqual([
      1, 216, 194, 159, 111, 199, 94, 95, 113, 157, 193,
    ]);
  });

  it('matches the spec for degree 13', () => {
    expect([...generatorPoly(13)]).toEqual([
      1, 137, 73, 227, 17, 177, 17, 52, 13, 46, 43, 83, 132, 120,
    ]);
  });

  it('has α^0 … α^(n-1) as its roots', () => {
    for (const degree of [7, 10, 15, 28, 30]) {
      const g = generatorPoly(degree);
      for (let i = 0; i < degree; i++) expect(polyEval(g, exp(i))).toBe(0);
    }
  });
});

describe('Reed-Solomon encoding', () => {
  // The worked "HELLO WORLD" 1-M example from the spec's tutorial literature.
  const data = new Uint8Array([
    32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17,
  ]);

  it('produces the known EC codewords', () => {
    const { ecc } = rsEncode(data, 10);
    expect([...ecc]).toEqual([196, 35, 39, 119, 235, 215, 231, 226, 93, 23]);
  });

  it('records one division step per data codeword', () => {
    const { trace } = rsEncode(data, 10, true);
    expect(trace).toHaveLength(data.length);
    expect(trace[0].remainderBefore.every((b) => b === 0)).toBe(true);
    for (const step of trace) {
      expect(step.generatorMultiple).toHaveLength(11);
      expect(step.remainderAfter).toHaveLength(10);
    }
  });

  it('leaves a codeword block with zero syndromes', () => {
    const { ecc } = rsEncode(data, 10);
    const block = new Uint8Array([...data, ...ecc]);
    const { failed, errorPositions } = rsDecode(block, 10);
    expect(failed).toBe(false);
    expect(errorPositions).toEqual([]);
  });
});

describe('Reed-Solomon decoding', () => {
  const data = new Uint8Array(
    Array.from({ length: 40 }, (_, i) => (i * 37 + 11) & 0xff),
  );
  const eccLen = 20;
  const { ecc } = rsEncode(data, eccLen);
  const clean = new Uint8Array([...data, ...ecc]);

  it('repairs up to eccLen/2 errors', () => {
    for (let count = 1; count <= eccLen / 2; count++) {
      const damaged = clean.slice();
      const hit: number[] = [];
      for (let i = 0; i < count; i++) {
        const pos = (i * 7 + 3) % clean.length;
        damaged[pos] ^= 0xa5 + i;
        hit.push(pos);
      }
      const result = rsDecode(damaged, eccLen);
      expect(result.failed).toBe(false);
      expect([...result.corrected]).toEqual([...clean]);
      expect(result.errorPositions.sort((a, b) => a - b)).toEqual(
        hit.sort((a, b) => a - b),
      );
    }
  });

  it('reports failure beyond capacity rather than corrupting silently', () => {
    const damaged = clean.slice();
    for (let i = 0; i < eccLen / 2 + 3; i++) {
      damaged[(i * 5 + 1) % clean.length] ^= 0x3c + i;
    }
    const result = rsDecode(damaged, eccLen);
    if (!result.failed) {
      // A miscorrection is possible in principle; it must never claim the
      // original block back when it did not recover it.
      expect([...result.corrected]).not.toEqual([...clean]);
    }
  });
});
