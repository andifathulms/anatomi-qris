import { describe, it, expect } from 'vitest';
import { encode, toGrid } from '../src/engine/encode';
import { maskCondition } from '../src/engine/mask';
import { codewordKey } from '../src/engine/provenance';
import { canEncode } from '../src/engine/segments';
import { EC_LEVELS } from '../src/engine/tables';
import { flatten, parseTlvDetailed } from '../src/qris/tlv';
import { SAMPLES } from '../samples/index';

const QRIS = SAMPLES.filter((s) => s.id.startsWith('qris'));

/**
 * PRD acceptance criterion 4: selecting any TLV node highlights exactly the
 * modules carrying those bytes, verified by decoding only the highlighted
 * codewords.
 *
 * This is the claim the whole app rests on, so it is checked node by node for
 * every bundled payload at every EC level that fits.
 */
describe('TLV node to module highlighting', () => {
  it('lights exactly the modules carrying each node, and no others', () => {
    for (const sample of QRIS) {
      const nodes = flatten(parseTlvDetailed(sample.payload).nodes);
      expect(nodes.length).toBeGreaterThan(5);

      for (const ec of EC_LEVELS) {
        if (!canEncode(sample.payload, ec)) continue;
        const build = encode(sample.payload, { ecLevel: ec });
        const grid = toGrid(build);

        for (const node of nodes) {
          const codewords = build.resolver.rangeToCodewords(node.start, node.end);
          expect(codewords.length, `${sample.id} ${node.path}`).toBeGreaterThan(0);

          // Read only the highlighted modules back out of the finished matrix.
          const recovered = new Map<number, number>();
          for (const c of codewords) {
            const coords = build.byCodeword.get(codewordKey('data', c));
            expect(coords, `${sample.id} ${node.path} codeword ${c}`).toHaveLength(8);
            let value = 0;
            for (const [x, y] of coords!) {
              const role = build.modules[y * build.size + x].role;
              if (role.kind !== 'data') throw new Error('highlighted a non-data module');
              const raw = grid[y][x];
              const bit = maskCondition(build.chosenMask, x, y) ? !raw : raw;
              value |= (bit ? 1 : 0) << (7 - role.bit);
            }
            recovered.set(c, value);
          }

          // The mode header is 12 or 20 bits, so payload bytes straddle
          // codeword boundaries. Reassemble the bits the highlighted codewords
          // carry, then cut the node's own byte range back out of them.
          const ordered = Array.from(recovered.keys()).sort((a, b) => a - b);
          const firstBit = ordered[0] * 8;
          let bits = '';
          for (const c of ordered) bits += recovered.get(c)!.toString(2).padStart(8, '0');

          const nodeStartBit = build.segmentation.payloadBitOffset + node.start * 8;
          const offset = nodeStartBit - firstBit;
          expect(offset, `${sample.id} ${node.path} @${ec}`).toBeGreaterThanOrEqual(0);

          let text = '';
          for (let i = 0; i < node.end - node.start; i++) {
            const slice = bits.slice(offset + i * 8, offset + i * 8 + 8);
            expect(slice, `${sample.id} ${node.path} byte ${i}`).toHaveLength(8);
            text += String.fromCharCode(parseInt(slice, 2));
          }
          expect(text, `${sample.id} ${node.path} @${ec}`).toBe(
            sample.payload.slice(node.start, node.end),
          );
        }
      }
    }
  });

  it('never highlights a codeword outside the node, beyond byte-boundary spill', () => {
    const sample = QRIS[0];
    const build = encode(sample.payload, { ecLevel: 'M' });
    for (const node of flatten(parseTlvDetailed(sample.payload).nodes)) {
      const codewords = build.resolver.rangeToCodewords(node.start, node.end);
      // The payload is byte mode, so a node of n characters occupies n bytes
      // and can spill into at most one codeword on each side of its range.
      expect(codewords.length).toBeLessThanOrEqual(node.end - node.start + 2);
      expect(Math.min(...codewords) * 8).toBeLessThanOrEqual(
        build.segmentation.payloadBitOffset + node.end * 8,
      );
    }
  });

  it('gives disjoint nodes disjoint module sets, aside from shared codewords', () => {
    const build = encode(QRIS[0].payload, { ecLevel: 'M' });
    const nodes = flatten(parseTlvDetailed(QRIS[0].payload).nodes);
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const a = new Set(build.resolver.rangeToCodewords(first.start, first.end));
    const b = new Set(build.resolver.rangeToCodewords(last.start, last.end));
    for (const c of a) expect(b.has(c)).toBe(false);
  });
});
