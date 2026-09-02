import { describe, it, expect } from 'vitest';
import { encode, toGrid } from '../src/engine/encode';
import { decode } from '../src/engine/decode';
import { codewordKey } from '../src/engine/provenance';
import { blockSpec, EC_LEVELS, type EcLevel } from '../src/engine/tables';
import { SAMPLES } from '../samples/index';

function lcg(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

/** Flip every module of the given interleaved-stream codewords. */
function damageCodewords(
  build: ReturnType<typeof encode>,
  grid: boolean[][],
  streamIndices: number[],
): number {
  let hit = 0;
  for (const s of streamIndices) {
    for (const [x, y] of build.byStreamIndex.get(s) ?? []) {
      grid[y][x] = !grid[y][x];
      hit++;
    }
  }
  return hit;
}

/** Stream indices belonging to one block, data first then ecc. */
function streamIndicesOfBlock(build: ReturnType<typeof encode>, block: number): number[] {
  const out: number[] = [];
  build.blockPlan.sources.forEach((src, index) => {
    if (src.block === block) out.push(index);
  });
  return out;
}

describe('recovery at the stated capacity', () => {
  it('repairs exactly floor(ecc/2) codewords per block, at every EC level', () => {
    for (const ec of EC_LEVELS) {
      const build = encode(SAMPLES[1].payload, { ecLevel: ec });
      const spec = blockSpec(build.version, ec);
      const perBlock = Math.floor(spec.eccPerBlock / 2);
      const grid = toGrid(build);

      let damaged = 0;
      for (let b = 0; b < build.blocks.length; b++) {
        const indices = streamIndicesOfBlock(build, b).slice(0, perBlock);
        damaged += damageCodewords(build, grid, indices);
      }
      expect(damaged).toBe(build.blocks.length * perBlock * 8);

      const result = decode(grid, build.version, ec, build.chosenMask);
      expect(result.failed, `level ${ec}`).toBe(false);
      expect(result.text).toBe(SAMPLES[1].payload);
      expect(result.corrected).toBe(build.blocks.length * perBlock);
      expect(result.capacity).toBe(build.blocks.length * perBlock);
    }
  });

  it('fails, and says so, one codeword past capacity', () => {
    for (const ec of EC_LEVELS) {
      const build = encode(SAMPLES[1].payload, { ecLevel: ec });
      const spec = blockSpec(build.version, ec);
      const perBlock = Math.floor(spec.eccPerBlock / 2);
      const grid = toGrid(build);

      // One block gets one codeword more than it can locate.
      const indices = streamIndicesOfBlock(build, 0).slice(0, perBlock + 1);
      damageCodewords(build, grid, indices);

      const result = decode(grid, build.version, ec, build.chosenMask);
      expect(result.text, `level ${ec} must not claim a recovery`).not.toBe(
        SAMPLES[1].payload,
      );
      expect(result.failed || result.failedBlocks.length > 0).toBe(true);
      expect(result.capacity).toBe(build.blocks.length * perBlock);
    }
  });

  it('survives a contiguous stain, which is what interleaving buys', () => {
    const build = encode(SAMPLES[1].payload, { ecLevel: 'Q' });
    const grid = toGrid(build);
    // A square blot in the middle of the symbol.
    const side = 6;
    const x0 = Math.floor((build.size - side) / 2);
    const y0 = Math.floor((build.size - side) / 2);
    for (let y = y0; y < y0 + side; y++) {
      for (let x = x0; x < x0 + side; x++) grid[y][x] = !grid[y][x];
    }
    const result = decode(grid, build.version, 'Q', build.chosenMask);
    expect(result.failed).toBe(false);
    expect(result.text).toBe(SAMPLES[1].payload);
    expect(result.corrected).toBeGreaterThan(0);
  });

  it('recovers from scattered random noise below capacity', () => {
    const random = lcg(7);
    for (const ec of ['M', 'H'] as EcLevel[]) {
      const build = encode(SAMPLES[0].payload, { ecLevel: ec });
      const spec = blockSpec(build.version, ec);
      const budget = Math.floor(spec.eccPerBlock / 2);
      const grid = toGrid(build);

      // Damage at most `budget` distinct codewords in each block.
      const perBlock = new Map<number, Set<number>>();
      for (let attempt = 0; attempt < 400; attempt++) {
        const s = Math.floor(random() * build.interleaved.length);
        const src = build.blockPlan.sources[s];
        let used = perBlock.get(src.block);
        if (!used) {
          used = new Set();
          perBlock.set(src.block, used);
        }
        if (used.has(s) || used.size >= budget) continue;
        used.add(s);
        const coords = build.byStreamIndex.get(s) ?? [];
        const [x, y] = coords[Math.floor(random() * coords.length)];
        grid[y][x] = !grid[y][x];
      }

      const result = decode(grid, build.version, ec, build.chosenMask);
      expect(result.failed, `level ${ec}`).toBe(false);
      expect(result.text).toBe(SAMPLES[0].payload);
    }
  });
});

describe('damage attribution', () => {
  it('names the stream indices it repaired', () => {
    const build = encode(SAMPLES[0].payload, { ecLevel: 'H' });
    const grid = toGrid(build);
    const targets = [3, 11, 19];
    damageCodewords(build, grid, targets);
    const result = decode(grid, build.version, 'H', build.chosenMask);
    expect(result.failed).toBe(false);
    expect(result.errorPositions).toEqual(targets);
  });

  it('reaches a damaged module through the provenance map alone', () => {
    const build = encode(SAMPLES[0].payload, { ecLevel: 'M' });
    const coords = build.byCodeword.get(codewordKey('data', 5))!;
    for (const [x, y] of coords) {
      const module = build.modules[y * build.size + x];
      expect(module.role.kind).toBe('data');
      if (module.role.kind === 'data') expect(module.role.codeword).toBe(5);
    }
  });
});
