import { describe, it, expect } from 'vitest';
import { encode, toGrid } from '../src/engine/encode';
import { decode } from '../src/engine/decode';

/** A payload that lands on version 15 at level M. */
const BIG = 'x'.repeat(410);

function median(samples: number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

describe('performance budget', () => {
  it('encodes a version 15 symbol inside the typing budget', () => {
    const build = encode(BIG, { ecLevel: 'M' });
    expect(build.version).toBe(15);

    for (let i = 0; i < 20; i++) encode(BIG, { ecLevel: 'M' }); // warm up
    const samples: number[] = [];
    for (let i = 0; i < 40; i++) {
      const t0 = performance.now();
      encode(BIG, { ecLevel: 'M' });
      samples.push(performance.now() - t0);
    }
    // CLAUDE.md §5: under 8 ms, so typing recomputes with no debounce.
    expect(median(samples)).toBeLessThan(8);
  });

  it('decodes a version 15 symbol inside a frame', () => {
    const build = encode(BIG, { ecLevel: 'M' });
    const grid = toGrid(build);
    for (let i = 0; i < 10; i++) decode(grid, build.version, 'M', build.chosenMask);
    const samples: number[] = [];
    for (let i = 0; i < 20; i++) {
      const t0 = performance.now();
      decode(grid, build.version, 'M', build.chosenMask);
      samples.push(performance.now() - t0);
    }
    // The damage lab re-decodes on every brush move.
    expect(median(samples)).toBeLessThan(16);
  });
});
