import type { Build } from '../engine/encode';
import { blockTintFor } from '../views/Interleave/blockTint';
import { isPlaced, mix, parseHex, readPalette, toCss, type Palette } from '../views/Matrix/palette';

/**
 * Paint one filmstrip frame: what the symbol looks like at the end of a
 * stage, from the same Build the matrix paints. It reads the provenance map
 * and recomputes nothing — a frame is a small, static summary of the stage,
 * not a second renderer of it.
 *
 * Canvas rather than SVG: nine frames of up to 77×77 modules would add some
 * fifty thousand nodes for pictures 44 px wide. The main matrix stays SVG.
 */
export function paintStageThumb(
  canvas: HTMLCanvasElement,
  build: Build,
  stage: number,
  palette: Palette = readPalette(),
): void {
  const css = canvas.clientWidth || 44;
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const px = Math.round(css * dpr);
  if (canvas.width !== px) canvas.width = px;
  if (canvas.height !== px) canvas.height = px;
  const g = canvas.getContext('2d');
  if (!g) return;

  const quiet = 1;
  const span = build.size + quiet * 2;
  const edge = (n: number) => Math.round((n * px) / span);

  g.fillStyle = palette.moduleLight;
  g.fillRect(0, 0, px, px);

  const lightOf = (hex: string, amount: number) => toCss(mix(WHITE, parseHex(hex), amount));
  const dataHex = readVar('--role-data', '#12a89c');
  const eccHex = readVar('--role-ecc', '#6aa832');
  const formatHex = readVar('--role-format', '#8b5cf6');
  const tint = stage === 5 ? blockTintFor(build) : null;
  const faint = lightOf('#000000', 0.16);

  for (let i = 0; i < build.modules.length; i++) {
    const m = build.modules[i];
    const placed = isPlaced(m.role);
    const info = m.role.kind === 'format' || m.role.kind === 'version';
    let fill: string | null = null;

    switch (stage) {
      case 1:
        // The bare frame: only the finders, faint, before any text arrives.
        if (m.role.kind === 'finder' && m.value) fill = faint;
        break;
      case 2:
        if (!placed && !info && m.value) fill = palette.moduleDark;
        break;
      case 3:
        if (!placed && !info) fill = m.value ? palette.moduleDark : null;
        else if (m.role.kind === 'data') fill = lightOf(dataHex, m.role.codeword % 2 ? 0.55 : 0.3);
        break;
      case 4:
        if (!placed && !info) fill = m.value ? palette.moduleDark : null;
        else if (m.role.kind === 'data') fill = lightOf(dataHex, 0.45);
        else if (m.role.kind === 'ecc') fill = lightOf(eccHex, 0.5);
        break;
      case 5:
        if (!placed && !info) fill = m.value ? palette.moduleDark : null;
        else if (tint) fill = tint(i);
        break;
      case 6:
        if (info) break;
        fill = (placed ? m.preMask : m.value) ? palette.moduleDark : null;
        break;
      case 7:
        if (info) break;
        if (placed && m.masked) fill = m.value ? toCss(mix(BLACK, parseHex(formatHex), 0.7)) : lightOf(formatHex, 0.28);
        else fill = m.value ? palette.moduleDark : null;
        break;
      case 8:
        fill = m.value ? palette.moduleDark : null;
        break;
      default: {
        // Damage: the finished symbol with one bruise and its repair.
        const r = build.size;
        const dx = m.x - r * 0.68;
        const dy = m.y - r * 0.62;
        const ex = m.x - r * 0.36;
        const ey = m.y - r * 0.78;
        if (dx * dx + dy * dy < (r * 0.13) ** 2) fill = palette.damage;
        else if (placed && ex * ex + ey * ey < (r * 0.09) ** 2) fill = palette.repair;
        else fill = m.value ? palette.moduleDark : null;
      }
    }

    if (!fill) continue;
    g.fillStyle = fill;
    const x = m.x + quiet;
    const y = m.y + quiet;
    g.fillRect(edge(x), edge(y), edge(x + 1) - edge(x), edge(y + 1) - edge(y));
  }
}

const WHITE = { r: 255, g: 255, b: 255 };
const BLACK = { r: 0, g: 0, b: 0 };

function readVar(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}
