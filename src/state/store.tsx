import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react';
import { encode, type Build } from '../engine/encode';
import { canEncode } from '../engine/segments';
import { EC_LEVELS, type EcLevel } from '../engine/tables';
import { inspectQris, type QrisDetection } from '../qris/detect';
import { SAMPLES } from '../../samples/index';
import { type Locale } from '../copy';
import type { RoleKey } from '../views/Matrix/palette';

export const STAGE_COUNT = 9;

export type Theme = 'dark' | 'light';

export type View = 'stages' | 'payload';

/**
 * What is currently highlighted, and where the highlight came from. One
 * structure, so a selection made in the tree, the ribbon or the matrix binds
 * all three without any of them owning the others.
 */
export interface Highlight {
  source: 'tlv' | 'bits' | 'matrix' | 'codeword' | 'block';
  /** Row-major module indices. */
  modules: number[];
  /** Data codeword indices, where the selection began life as codewords. */
  codewords: number[];
  /** Character range in the raw input, for the TLV raw-string marking. */
  charRange: [number, number] | null;
  label: string;
}

export interface AppState {
  input: string;
  ecLevel: EcLevel;
  forceMask: number | null;
  /** Continuous, 1 to 9. Fractional while the scrubber is between stations. */
  stage: number;
  /**
   * False until the reader first moves the rail. While it is false the
   * specimen shows the finished symbol rather than stage one's bare
   * skeleton — a first-time visitor should see a QR code, not an empty
   * frame that reads as a failed render.
   */
  stageTouched: boolean;
  rendering: 'printed' | 'anatomy';
  /**
   * What the panel shows: the nine-stage construction, or the payload read by
   * meaning. The second only exists while the QRIS lens is on; the store
   * reports 'stages' whenever it is off, whatever this says.
   */
  view: View;
  /** A module role picked in the legend: that role keeps its colour and
      every other module fades. Null when nothing is isolated. */
  isolatedRole: RoleKey | null;
  /** The guided tour is scrubbing the stages on a timer. */
  touring: boolean;
  locale: Locale;
  /** Dark is the instrument, light is the lab notebook. DESIGN.md §2.1. */
  theme: Theme;
  highlight: Highlight | null;
  focusedModule: number | null;
  /** Row-major indices of modules the user has flipped in the damage lab. */
  damage: number[];
  showMaskFeatures: boolean;
  selectedMask: number | null;
  /** Random noise density, 0 to 1. Kept apart from painted damage so the
      slider maps the pointer directly and is reversible. */
  noise: number;
}

type Action =
  | { type: 'setInput'; input: string }
  | { type: 'setEcLevel'; ecLevel: EcLevel }
  | { type: 'setStage'; stage: number }
  | { type: 'setRendering'; rendering: 'printed' | 'anatomy' }
  | { type: 'setView'; view: View }
  | { type: 'setIsolatedRole'; role: RoleKey | null }
  | { type: 'setTouring'; touring: boolean }
  | { type: 'setLocale'; locale: Locale }
  | { type: 'setTheme'; theme: Theme }
  | { type: 'setHighlight'; highlight: Highlight | null }
  | { type: 'setFocusedModule'; index: number | null }
  | { type: 'setForceMask'; mask: number | null }
  | { type: 'setSelectedMask'; mask: number | null }
  | { type: 'toggleMaskFeatures' }
  | { type: 'damage'; indices: number[] }
  | { type: 'setNoise'; noise: number }
  | { type: 'repair'; indices: number[]; standing: number[] }
  | { type: 'clearDamage' };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'setInput':
      // A new input invalidates every view-state layered on the old build.
      return {
        ...state,
        input: action.input,
        highlight: null,
        damage: [],
        noise: 0,
        focusedModule: null,
      };
    case 'setEcLevel':
      return {
        ...state,
        ecLevel: action.ecLevel,
        highlight: null,
        damage: [],
        noise: 0,
        forceMask: null,
      };
    case 'setStage':
      return {
        ...state,
        stage: Math.min(STAGE_COUNT, Math.max(1, action.stage)),
        stageTouched: true,
        // Moving through the stages means the reader wants the stages back.
        view: 'stages',
      };
    case 'setRendering':
      return { ...state, rendering: action.rendering };
    case 'setTouring':
      return { ...state, touring: action.touring };
    case 'setIsolatedRole':
      return { ...state, isolatedRole: action.role };
    case 'setView':
      // A highlight made in one view means nothing in the other.
      return { ...state, view: action.view, highlight: null };
    case 'setLocale':
      return { ...state, locale: action.locale };
    case 'setTheme':
      return { ...state, theme: action.theme };
    case 'setHighlight':
      return { ...state, highlight: action.highlight };
    case 'setFocusedModule':
      return { ...state, focusedModule: action.index };
    case 'setForceMask':
      return { ...state, forceMask: action.mask, damage: [] };
    case 'setSelectedMask':
      return { ...state, selectedMask: action.mask };
    case 'toggleMaskFeatures':
      return { ...state, showMaskFeatures: !state.showMaskFeatures };
    case 'damage': {
      const next = new Set(state.damage);
      for (const i of action.indices) next.add(i);
      return { ...state, damage: [...next] };
    }
    case 'setNoise':
      return { ...state, noise: Math.min(1, Math.max(0, action.noise)) };
    /*
     * Repair has to settle the noise as well as the brush. Noise damage is
     * derived from `noise` on every read rather than stored, so filtering
     * `damage` alone left every noise-selected module standing and the button
     * looked dead on the likeliest route to stage 9's payoff. So: take the
     * damage standing at the moment of repair, drop what the decoder fixed,
     * and keep the rest as painted damage with the slider back at zero.
     */
    case 'repair': {
      const repaired = new Set(action.indices);
      return {
        ...state,
        damage: action.standing.filter((i) => !repaired.has(i)),
        noise: 0,
      };
    }
    case 'clearDamage':
      return { ...state, damage: [], noise: 0 };
    default:
      return state;
  }
}

/**
 * Read the input and EC level from the URL. Only ever written back for
 * non-QRIS payloads (PRD §9): a merchant identifier must not end up in a link
 * someone shares without thinking.
 */
function initialState(): AppState {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get('t');
  const ecParam = params.get('ec') as EcLevel | null;
  const langParam = params.get('lang');
  return {
    input: fromUrl ?? SAMPLES[0].payload,
    ecLevel: ecParam && EC_LEVELS.includes(ecParam) ? ecParam : 'M',
    forceMask: null,
    stage: 1,
    stageTouched: false,
    rendering: 'printed',
    view: 'stages',
    isolatedRole: null,
    touring: false,
    locale: langParam === 'en' ? 'en' : 'id',
    theme: initialTheme(),
    highlight: null,
    focusedModule: null,
    damage: [],
    showMaskFeatures: true,
    selectedMask: null,
    noise: 0,
  };
}

/**
 * Follow the system unless the reader has said otherwise. The stored
 * preference is a localStorage read, which is not a network request.
 */
function initialTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {
    // Private browsing, or storage disabled. The system preference stands.
  }
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

const THEME_KEY = 'anatomi-qris:theme';

export interface Store {
  state: AppState;
  dispatch: (action: Action) => void;
  /** The one Build everything else is derived from. Null when it cannot fit. */
  build: Build | null;
  /** Why the build is null, when it is. */
  buildError: 'tooLong' | 'empty' | null;
  qris: QrisDetection | null;
  /** True when the payload parses as EMVCo Merchant-Presented Mode. */
  lensActive: boolean;
  /** The view actually showing: 'payload' only while the lens is on. */
  view: View;
  linkable: boolean;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);

  // One Build from one input plus options. Everything else is view state.
  const { build, buildError } = useMemo(() => {
    if (state.input.length === 0) {
      return { build: null, buildError: 'empty' as const };
    }
    if (!canEncode(state.input, state.ecLevel)) {
      return { build: null, buildError: 'tooLong' as const };
    }
    return {
      build: encode(state.input, {
        ecLevel: state.ecLevel,
        ...(state.forceMask !== null ? { forceMask: state.forceMask } : {}),
      }),
      buildError: null,
    };
  }, [state.input, state.ecLevel, state.forceMask]);

  const qris = useMemo(() => inspectQris(state.input), [state.input]);
  const lensActive = qris.isQris;

  // The theme is a document-level attribute so every token block switches at
  // once, including inside popovers and portals.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.theme);
    try {
      window.localStorage.setItem(THEME_KEY, state.theme);
    } catch {
      // Nothing to do; the choice lasts for this session only.
    }
  }, [state.theme]);

  useEffect(() => {
    // Serialise typed text and samples, never a QRIS payload.
    const url = new URL(window.location.href);
    if (lensActive) {
      url.searchParams.delete('t');
      url.searchParams.delete('ec');
    } else {
      url.searchParams.set('t', state.input);
      url.searchParams.set('ec', state.ecLevel);
    }
    /*
     * The locale rides in the URL because it is something the reader changes
     * and nothing about it is sensitive — it is not a merchant identifier, so
     * the reason PRD section 9 suppresses the payload does not apply here.
     * Without it the English half of a bilingual app cannot be linked, shared
     * or indexed, and there is no second URL for hreflang to point at.
     */
    if (state.locale === 'id') url.searchParams.delete('lang');
    else url.searchParams.set('lang', state.locale);
    window.history.replaceState(null, '', url);
  }, [state.input, state.ecLevel, state.locale, lensActive]);

  /*
   * <html lang> was a static "id" while the interface could be entirely in
   * English — wrong for a screen reader, a translation tool and a crawler
   * alike. It follows the locale now.
   */
  useEffect(() => {
    document.documentElement.lang = state.locale;
  }, [state.locale]);

  const value = useMemo<Store>(
    () => ({
      state,
      dispatch,
      build,
      buildError,
      qris,
      lensActive,
      view: lensActive ? state.view : 'stages',
      linkable: !lensActive,
    }),
    [state, build, buildError, qris, lensActive],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside StoreProvider');
  return store;
}

/** Convenience for the common "set one field" calls. */
export function useActions() {
  const { dispatch } = useStore();
  return useMemo(
    () => ({
      setInput: (input: string) => dispatch({ type: 'setInput', input }),
      setEcLevel: (ecLevel: EcLevel) => dispatch({ type: 'setEcLevel', ecLevel }),
      setStage: (stage: number) => dispatch({ type: 'setStage', stage }),
      setRendering: (rendering: 'printed' | 'anatomy') =>
        dispatch({ type: 'setRendering', rendering }),
      setView: (view: View) => dispatch({ type: 'setView', view }),
      setIsolatedRole: (role: RoleKey | null) => dispatch({ type: 'setIsolatedRole', role }),
      setTouring: (touring: boolean) => dispatch({ type: 'setTouring', touring }),
      setLocale: (locale: Locale) => dispatch({ type: 'setLocale', locale }),
      setTheme: (theme: Theme) => dispatch({ type: 'setTheme', theme }),
      setHighlight: (highlight: Highlight | null) => dispatch({ type: 'setHighlight', highlight }),
      setFocusedModule: (index: number | null) => dispatch({ type: 'setFocusedModule', index }),
      setForceMask: (mask: number | null) => dispatch({ type: 'setForceMask', mask }),
      setSelectedMask: (mask: number | null) => dispatch({ type: 'setSelectedMask', mask }),
      toggleMaskFeatures: () => dispatch({ type: 'toggleMaskFeatures' }),
      damage: (indices: number[]) => dispatch({ type: 'damage', indices }),
      setNoise: (noise: number) => dispatch({ type: 'setNoise', noise }),
      repair: (indices: number[], standing: number[]) =>
        dispatch({ type: 'repair', indices, standing }),
      clearDamage: () => dispatch({ type: 'clearDamage' }),
    }),
    [dispatch],
  );
}

/** Modules highlighted right now, as a Set for O(1) lookup while rendering. */
export function useHighlightSet(): Set<number> {
  const { state } = useStore();
  return useMemo(() => new Set(state.highlight?.modules ?? []), [state.highlight]);
}

/**
 * Painted damage plus whatever the noise slider currently selects.
 *
 * Noise draws from a fixed shuffle of the data-region modules, so a given
 * slider position always picks the same modules and dragging the slider back
 * removes damage rather than leaving it behind. That is what makes the slider
 * a direct mapping rather than an accumulator (DESIGN.md §6.1).
 */
export function useDamageSet(): Set<number> {
  const { state, build } = useStore();
  const shuffled = useMemo(() => (build ? shuffledDataModules(build) : []), [build]);
  return useMemo(() => {
    const out = new Set(state.damage);
    const count = Math.round(state.noise * shuffled.length);
    for (let i = 0; i < count; i++) out.add(shuffled[i]);
    return out;
  }, [state.damage, state.noise, shuffled]);
}

/** A deterministic shuffle. The engine stays pure; randomness lives here. */
function shuffledDataModules(build: Build): number[] {
  const indices: number[] = [];
  for (const m of build.modules) {
    if (m.role.kind === 'data' || m.role.kind === 'ecc') indices.push(m.y * build.size + m.x);
  }
  let seed = build.size * 2654435761;
  for (let i = indices.length - 1; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const j = seed % (i + 1);
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices;
}

/** Build a Highlight from data codeword indices, via the provenance map. */
export function highlightFromCodewords(
  build: Build,
  codewords: number[],
  source: Highlight['source'],
  label: string,
  charRange: [number, number] | null = null,
): Highlight {
  const modules: number[] = [];
  for (const c of codewords) {
    for (const [x, y] of build.byCodeword.get(`data:${c}`) ?? []) {
      modules.push(y * build.size + x);
    }
  }
  return { source, modules, codewords, charRange, label };
}

export { useCallback };
