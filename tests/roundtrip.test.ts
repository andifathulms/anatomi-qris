import { describe, it, expect } from 'vitest';
import jsQR from 'jsqr';
import { encode, toGrid } from '../src/engine/encode';
import { canEncode } from '../src/engine/segments';
import { decode } from '../src/engine/decode';
import { EC_LEVELS } from '../src/engine/tables';
import { SAMPLES } from '../samples/index';

const QUIET = 4;
/** jsQR locates by image feature, so give it modules a scanner would see. */
const SCALE = 4;

/** Our matrix as the RGBA buffer jsQR expects, with the mandatory quiet zone. */
function toRgba(grid: boolean[][]) {
  const size = grid.length;
  const modules = size + QUIET * 2;
  const width = modules * SCALE;
  const data = new Uint8ClampedArray(width * width * 4).fill(255);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!grid[y][x]) continue;
      for (let dy = 0; dy < SCALE; dy++) {
        for (let dx = 0; dx < SCALE; dx++) {
          const px = (x + QUIET) * SCALE + dx;
          const py = (y + QUIET) * SCALE + dy;
          const i = (py * width + px) * 4;
          data[i] = data[i + 1] = data[i + 2] = 0;
        }
      }
    }
  }
  return { data, width };
}

const CORPUS = [
  ...SAMPLES.map((s) => s.payload),
  'A',
  '0',
  'halo',
  'HELLO WORLD',
  '628123456789',
  'Warung Ibu Éni — Rp15.000',
  'Sebuah kalimat yang cukup panjang untuk mendorong versi simbol naik beberapa tingkat sekaligus.',
];

describe('round trip through jsQR', () => {
  it('reads back every corpus string at every EC level', () => {
    for (const text of CORPUS) {
      for (const ec of EC_LEVELS) {
        if (!canEncode(text, ec)) continue;
        const build = encode(text, { ecLevel: ec });
        const { data, width } = toRgba(toGrid(build));
        const result = jsQR(data, width, width);
        expect(result, `jsQR failed to read ${JSON.stringify(text.slice(0, 32))} @${ec}`).not.toBeNull();
        expect(result!.data).toBe(text);
      }
    }
  });

  it('reads back every forced mask, not just the chosen one', () => {
    for (let mask = 0; mask < 8; mask++) {
      const build = encode('Anatomi QRIS', { ecLevel: 'H', forceMask: mask });
      const { data, width } = toRgba(toGrid(build));
      const result = jsQR(data, width, width);
      expect(result?.data, `mask ${mask}`).toBe('Anatomi QRIS');
    }
  });
});

describe('round trip through our own decoder', () => {
  it('reads back every corpus string at every EC level', () => {
    for (const text of CORPUS) {
      for (const ec of EC_LEVELS) {
        if (!canEncode(text, ec)) continue;
        const build = encode(text, { ecLevel: ec });
        const result = decode(toGrid(build), build.version, ec, build.chosenMask);
        expect(result.failed).toBe(false);
        expect(result.corrected).toBe(0);
        expect(result.mode).toBe(build.mode);
        expect(result.text).toBe(text);
      }
    }
  });

  it('recovers the exact codewords the encoder produced', () => {
    const build = encode(SAMPLES[0].payload, { ecLevel: 'M' });
    const result = decode(toGrid(build), build.version, 'M', build.chosenMask);
    expect(result.text).toBe(SAMPLES[0].payload);
    expect(result.failedBlocks).toEqual([]);
    for (const syndromes of result.syndromesByBlock) {
      expect([...syndromes].every((s) => s === 0)).toBe(true);
    }
  });
});
