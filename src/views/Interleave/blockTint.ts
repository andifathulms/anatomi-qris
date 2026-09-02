import type { Build } from '../../engine/encode';
import { mix, parseHex, toCss } from '../Matrix/palette';

/**
 * Blocks are tinted as shades of the two codeword hues — data teal and EC moss
 * — rather than with a new categorical scale. The palette already says these
 * modules are codewords; the shade says which block, and no eleventh hue is
 * introduced to say it.
 */
export function blockTints(blockCount: number): { data: string[]; ecc: string[] } {
  const style = getComputedStyle(document.documentElement);
  const dataHue = parseHex(style.getPropertyValue('--role-data').trim() || '#1e8c86');
  const eccHue = parseHex(style.getPropertyValue('--role-ecc').trim() || '#5e8f3a');
  const white = { r: 255, g: 255, b: 255 };
  const black = { r: 0, g: 0, b: 0 };

  const ramp = (hue: typeof dataHue) =>
    Array.from({ length: blockCount }, (_, i) => {
      const t = blockCount === 1 ? 0 : i / (blockCount - 1);
      // Alternate darker and lighter around the hue so neighbouring blocks
      // stay separable even when there are a dozen of them.
      const shifted = t < 0.5 ? mix(hue, black, t * 0.7) : mix(hue, white, (t - 0.5) * 0.9);
      return toCss(shifted);
    });

  return { data: ramp(dataHue), ecc: ramp(eccHue) };
}

/**
 * Colour every module by the block it came from. This is the whole coffee
 * stain argument in one picture: adjacent modules are visibly different
 * colours, meaning different blocks, meaning localized damage is spread thin
 * across many separately correctable units.
 */
export function blockTintFor(build: Build): (index: number) => string | null {
  const tints = blockTints(build.blocks.length);
  return (index: number) => {
    const role = build.modules[index]?.role;
    if (!role) return null;
    if (role.kind === 'data') return tints.data[role.block] ?? null;
    if (role.kind === 'ecc') return tints.ecc[role.block] ?? null;
    return null;
  };
}
