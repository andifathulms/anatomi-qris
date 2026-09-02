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

export const STAGE_COUNT = 9;

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
  rendering: 'printed' | 'anatomy';
  locale: Locale;
  highlight: Highlight | null;
  focusedModule: number | null;
  /** Row-major indices of modules the user has flipped in the damage lab. */
  damage: number[];
  showMaskFeatures: boolean;
  selectedMask: number | null;
}

type Action =
  | { type: 'setInput'; input: string }
  | { type: 'setEcLevel'; ecLevel: EcLevel }
  | { type: 'setStage'; stage: number }
  | { type: 'setRendering'; rendering: 'printed' | 'anatomy' }
  | { type: 'setLocale'; locale: Locale }
  | { type: 'setHighlight'; highlight: Highlight | null }
  | { type: 'setFocusedModule'; index: number | null }
  | { type: 'setForceMask'; mask: number | null }
  | { type: 'setSelectedMask'; mask: number | null }
  | { type: 'toggleMaskFeatures' }
  | { type: 'damage'; indices: number[] }
  | { type: 'clearDamage' };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'setInput':
      // A new input invalidates every view-state layered on the old build.
      return { ...state, input: action.input, highlight: null, damage: [], focusedModule: null };
    case 'setEcLevel':
      return { ...state, ecLevel: action.ecLevel, highlight: null, damage: [], forceMask: null };
    case 'setStage':
      return { ...state, stage: Math.min(STAGE_COUNT, Math.max(1, action.stage)) };
    case 'setRendering':
      return { ...state, rendering: action.rendering };
    case 'setLocale':
      return { ...state, locale: action.locale };
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
    case 'clearDamage':
      return { ...state, damage: [] };
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
  return {
    input: fromUrl ?? SAMPLES[0].payload,
    ecLevel: ecParam && EC_LEVELS.includes(ecParam) ? ecParam : 'M',
    forceMask: null,
    stage: 1,
    rendering: 'printed',
    locale: 'id',
    highlight: null,
    focusedModule: null,
    damage: [],
    showMaskFeatures: true,
    selectedMask: null,
  };
}

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
    window.history.replaceState(null, '', url);
  }, [state.input, state.ecLevel, lensActive]);

  const value = useMemo<Store>(
    () => ({ state, dispatch, build, buildError, qris, lensActive, linkable: !lensActive }),
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
      setLocale: (locale: Locale) => dispatch({ type: 'setLocale', locale }),
      setHighlight: (highlight: Highlight | null) => dispatch({ type: 'setHighlight', highlight }),
      setFocusedModule: (index: number | null) => dispatch({ type: 'setFocusedModule', index }),
      setForceMask: (mask: number | null) => dispatch({ type: 'setForceMask', mask }),
      setSelectedMask: (mask: number | null) => dispatch({ type: 'setSelectedMask', mask }),
      toggleMaskFeatures: () => dispatch({ type: 'toggleMaskFeatures' }),
      damage: (indices: number[]) => dispatch({ type: 'damage', indices }),
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

export function useDamageSet(): Set<number> {
  const { state } = useStore();
  return useMemo(() => new Set(state.damage), [state.damage]);
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
