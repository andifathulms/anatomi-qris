import { useEffect, useRef } from 'react';
import type { Build } from '../../engine/encode';
import { readPalette, isPlaced, roleKey, type Palette } from './palette';

export interface PaintState {
  /** 0 to 1: how far the zigzag has run. */
  placeProgress: number;
  /** 0 to 1: how far the mask has been applied. */
  maskProgress: number;
  /** 0 to 1: how far the format and version information has been written. */
  infoProgress: number;
  /** 0 to 1: how far the anatomy wave has crossed the matrix. */
  anatomyProgress: number;
  highlight: Set<number>;
  damage: Set<number>;
  repaired: Set<number>;
  focused: number | null;
  /** Modules a mask penalty rule is currently objecting to. */
  offences: Set<number>;
  /** Show the matrix as a mask candidate rather than the chosen build. */
  overrideGrid: Uint8Array | null;
  /** Colour a module by something other than its role, e.g. its block. */
  tint: ((index: number) => string | null) | null;
  /** Changes when the token values behind the palette change, i.e. on a
      theme switch. --damage, --repair and --marker differ between themes. */
  paletteKey: string;
}

/**
 * Paint every module's fill directly on the DOM.
 *
 * React renders the rects once and never remounts them (CLAUDE.md §6); this
 * loop mutates their fills. Each module's last fill is cached, so a steady
 * frame writes nothing and an animating frame writes only what moved. That is
 * what keeps a 77x77 matrix inside the frame budget without a canvas fallback.
 */
export function useMatrixPainter(
  build: Build | null,
  rects: React.MutableRefObject<Array<SVGRectElement | null>>,
  state: PaintState,
) {
  const lastFill = useRef<string[]>([]);
  const lastStroke = useRef<string[]>([]);
  const palette = useRef<Palette | null>(null);

  useEffect(() => {
    palette.current = readPalette();
    // Force a full repaint: the cached fills were mixed from the old tokens.
    lastFill.current = [];
    lastStroke.current = [];
  }, [state.paletteKey]);

  useEffect(() => {
    if (!build) return;
    if (!palette.current) palette.current = readPalette();
    const p = palette.current;
    const n = build.size * build.size;
    if (lastFill.current.length !== n) {
      lastFill.current = new Array(n).fill('');
      lastStroke.current = new Array(n).fill('');
    }

    const anatomy = state.anatomyProgress;
    // The zigzag reaches column x when the walk has passed it; the walk runs
    // right to left, so a function pattern lights once the front is left of it.
    const front = build.size - state.placeProgress * (build.size + 2);
    const placedCount = Math.floor(state.placeProgress * countPlaced(build));

    for (let i = 0; i < n; i++) {
      const module = build.modules[i];
      const rect = rects.current[i];
      if (!rect) continue;

      const key = roleKey(module.role);
      const placeable = isPlaced(module.role);
      const isInfo = module.role.kind === 'format' || module.role.kind === 'version';

      let visible = true;
      let dark: boolean;

      if (state.overrideGrid) {
        dark = state.overrideGrid[i] === 1;
      } else if (placeable) {
        const order = module.placementOrder ?? 0;
        visible = order < placedCount;
        // Between "place" and "mask" the mask arrives module by module, so a
        // half-scrubbed stage shows the mask half applied.
        const maskHere = module.masked && orderFraction(order, build) <= state.maskProgress;
        dark = maskHere ? !module.preMask : module.preMask;
      } else if (isInfo) {
        visible = state.infoProgress > 0;
        dark = module.value;
      } else {
        dark = module.value;
      }

      let fill: string;
      if (!visible) {
        fill = p.moduleLight;
      } else if (state.damage.has(i)) {
        fill = p.damage;
      } else if (state.repaired.has(i)) {
        fill = p.repair;
      } else if (anatomy > 0 && waveReached(module.x, module.y, build.size, anatomy)) {
        const lit = !placeable || module.x >= Math.floor(front) - 2 || state.placeProgress >= 1;
        if (lit) fill = dark ? p.dark[key] : p.light[key];
        else fill = dark ? p.moduleDark : p.moduleLight;
      } else {
        fill = dark ? p.moduleDark : p.moduleLight;
      }

      const tint = visible && state.tint ? state.tint(i) : null;
      if (tint) fill = dark ? tint : mixToward(tint, p.moduleLight, 0.62);

      if (state.offences.has(i)) fill = p.damage;

      let stroke = 'none';
      // --marker, not --ink: a pale ink stroke is invisible on a white
      // module, so half of every highlight simply did not render.
      if (state.focused === i) stroke = p.marker;
      else if (state.highlight.has(i)) stroke = p.marker;
      else if (
        anatomy > 0 &&
        visible &&
        module.masked &&
        placeable &&
        state.maskProgress > 0 &&
        waveReached(module.x, module.y, build.size, anatomy)
      ) {
        // The mask layer stays separable from the data layer without a second
        // colour system: a 1px inset stroke in the same hue, higher chroma.
        stroke = p.stroke[key];
      }

      if (lastFill.current[i] !== fill) {
        rect.setAttribute('fill', fill);
        lastFill.current[i] = fill;
      }
      if (lastStroke.current[i] !== stroke) {
        rect.setAttribute('stroke', stroke);
        lastStroke.current[i] = stroke;
      }
    }
  });
}

/** Keep a tinted light module clearly lighter than a tinted dark one. */
function mixToward(color: string, target: string, amount: number): string {
  const a = rgbOf(color);
  const b = rgbOf(target);
  if (!a || !b) return color;
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * amount)},${Math.round(
    a[1] + (b[1] - a[1]) * amount,
  )},${Math.round(a[2] + (b[2] - a[2]) * amount)})`;
}

function rgbOf(color: string): [number, number, number] | null {
  const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (match) return [Number(match[1]), Number(match[2]), Number(match[3])];
  if (color.startsWith('#') && color.length === 7) {
    return [
      parseInt(color.slice(1, 3), 16),
      parseInt(color.slice(3, 5), 16),
      parseInt(color.slice(5, 7), 16),
    ];
  }
  return null;
}

function countPlaced(build: Build): number {
  let count = 0;
  for (const m of build.modules) if (m.placementOrder !== null) count++;
  return count;
}

function orderFraction(order: number, build: Build): number {
  return order / Math.max(1, build.size * build.size);
}

/**
 * The anatomy toggle is a wave sweeping diagonally from the top-left finder,
 * not a crossfade (DESIGN.md §6.4). This is the module's place along it.
 */
function waveReached(x: number, y: number, size: number, progress: number): boolean {
  if (progress >= 1) return true;
  return (x + y) / (2 * size - 2) <= progress;
}
