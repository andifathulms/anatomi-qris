import type { ModuleRole } from '../../engine/provenance';

export type RoleKey =
  | 'finder' | 'separator' | 'timing' | 'alignment' | 'darkModule'
  | 'format' | 'version' | 'data' | 'ecc' | 'remainder';

export const ROLE_KEYS: RoleKey[] = [
  'finder', 'separator', 'timing', 'alignment', 'darkModule',
  'format', 'version', 'data', 'ecc', 'remainder',
];

const CSS_VAR: Record<RoleKey, string> = {
  finder: '--role-finder',
  separator: '--role-separator',
  timing: '--role-timing',
  alignment: '--role-alignment',
  darkModule: '--role-darkmodule',
  format: '--role-format',
  version: '--role-version',
  data: '--role-data',
  ecc: '--role-ecc',
  remainder: '--role-remainder',
};

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function parseHex(hex: string): Rgb {
  const clean = hex.trim().replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

export function toCss({ r, g, b }: Rgb): string {
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

export function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

const WHITE: Rgb = { r: 255, g: 255, b: 255 };
const BLACK: Rgb = { r: 0, g: 0, b: 0 };

export interface Palette {
  /** Role tint over a light module and over a dark module. */
  light: Record<RoleKey, string>;
  dark: Record<RoleKey, string>;
  /** Higher-chroma hue for the masked-module inset stroke. */
  stroke: Record<RoleKey, string>;
  hue: Record<RoleKey, string>;
  damage: string;
  repair: string;
  /** Selection and focus. Legible over both a white and a black module. */
  marker: string;
  /** A highlighted light module: the marker, washed toward paper. */
  markerSoft: string;
  /** A dark module outside the highlight, faded so the highlight carries. */
  dim: string;
  moduleLight: string;
  moduleDark: string;
  inkSoft: string;
  ink: string;
}

/**
 * The anatomy lens (DESIGN.md §2.3): the tint rides on the module's value and
 * never replaces it. A light module takes the role hue at 25% coverage over
 * white; a dark module takes it at 65% over black. Within a role the two stay
 * clearly apart, so the QR silhouette survives being coloured in.
 *
 * The values come from tokens.css rather than a second copy in TypeScript, so
 * there is one source of truth for the palette.
 */
export function readPalette(root: HTMLElement = document.documentElement): Palette {
  const style = getComputedStyle(root);
  const read = (name: string) => style.getPropertyValue(name).trim();
  const lightCoverage = Number(read('--lens-light-coverage')) || 0.25;
  const darkCoverage = Number(read('--lens-dark-coverage')) || 0.65;

  const light = {} as Record<RoleKey, string>;
  const dark = {} as Record<RoleKey, string>;
  const stroke = {} as Record<RoleKey, string>;
  const hue = {} as Record<RoleKey, string>;

  for (const key of ROLE_KEYS) {
    const rgb = parseHex(read(CSS_VAR[key]) || '#888888');
    hue[key] = toCss(rgb);
    light[key] = toCss(mix(WHITE, rgb, lightCoverage));
    dark[key] = toCss(mix(BLACK, rgb, darkCoverage));
    stroke[key] = toCss(mix(rgb, WHITE, 0.2));
  }

  const marker = read('--marker') || '#f0439a';
  const markerRgb = marker.startsWith('#') ? parseHex(marker) : parseHex('#f0439a');

  return {
    light,
    dark,
    stroke,
    hue,
    damage: read('--damage') || '#ff4438',
    repair: read('--repair') || '#2fd6a8',
    marker,
    markerSoft: toCss(mix(WHITE, markerRgb, 0.3)),
    dim: toCss(mix(WHITE, BLACK, 0.2)),
    moduleLight: read('--module-light') || '#ffffff',
    moduleDark: read('--module-dark') || '#000000',
    inkSoft: read('--ink-soft') || '#8b95a4',
    ink: read('--ink') || '#e9edf3',
  };
}

export function roleKey(role: ModuleRole): RoleKey {
  return role.kind as RoleKey;
}

/** True for the function patterns — the warm half of the palette. */
export function isStructure(role: ModuleRole): boolean {
  switch (role.kind) {
    case 'finder':
    case 'separator':
    case 'timing':
    case 'alignment':
    case 'darkModule':
      return true;
    default:
      return false;
  }
}

/** True for modules the zigzag writes, which are the ones the mask can flip. */
export function isPlaced(role: ModuleRole): boolean {
  return role.kind === 'data' || role.kind === 'ecc' || role.kind === 'remainder';
}
