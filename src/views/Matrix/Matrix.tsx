import { useCallback, useMemo, useRef, useState } from 'react';
import type { Build } from '../../engine/encode';
import type { ModuleInfo } from '../../engine/provenance';
import { useCopy } from '../../copy';
import { STAGE_COUNT, useActions, useDamageSet, useHighlightSet, useStore } from '../../state/store';
import { duration, useTimedValue } from '../../ui/useTimedValue';
import { useMatrixPainter, type PaintState } from './useMatrixPainter';
import { roleLabelKey } from './roleLabel';
import './matrix.css';

const QUIET = 4;

export interface MatrixProps {
  /** Called for each module the brush passes over, while the pointer is down. */
  onPaint?: (index: number, wide: boolean) => void;
  offences?: Set<number>;
  repaired?: Set<number>;
  overrideGrid?: Uint8Array | null;
  tint?: ((index: number) => string | null) | null;
}

/**
 * The matrix. Fixed size and position at every stage, because that is what
 * makes nine stages read as one object being transformed rather than nine
 * illustrations in a row (DESIGN.md §4.1).
 *
 * One pointer listener on the group, hit-tested by dividing coordinates by the
 * module size. Never one listener per module — at version 15 that is 5,929
 * listeners and it stalls on a phone (CLAUDE.md §6).
 */
export function Matrix({
  onPaint,
  offences,
  repaired,
  overrideGrid = null,
  tint = null,
}: MatrixProps) {
  const { state, build } = useStore();
  const { setFocusedModule } = useActions();
  const { t } = useCopy();
  const highlight = useHighlightSet();
  const damage = useDamageSet();
  const rects = useRef<Array<SVGRectElement | null>>([]);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const pointerDown = useRef(false);

  const size = build?.size ?? 21;
  const extent = size + QUIET * 2;

  // Until the reader moves the rail, the specimen shows the finished symbol.
  // Stage one is genuinely a bare skeleton — that is what the stage means —
  // but a stranger landing on an empty frame reads it as a broken render, and
  // the app's whole claim is that this thing can be taken apart.
  const stageProgress = useStageProgress(state.stageTouched ? state.stage : STAGE_COUNT);
  const anatomyProgress = useTimedValue(
    state.rendering === 'anatomy' ? 1 : 0,
    duration('--dur-anatomy', 480),
  );

  const paint: PaintState = {
    ...stageProgress,
    // The interleave argument needs the codewords visible where they land:
    // adjacent modules in different colours is the whole point, and it cannot
    // be made against an empty data region. So a tinted matrix shows the walk
    // already complete, one stage before the walk is the subject.
    ...(tint ? { placeProgress: 1 } : {}),
    anatomyProgress,
    highlight,
    damage,
    repaired: repaired ?? EMPTY,
    focused: state.focusedModule ?? hovered,
    offences: offences ?? EMPTY,
    overrideGrid,
    tint,
    paletteKey: state.theme,
  };
  useMatrixPainter(build, rects, paint);

  const hitTest = useCallback(
    (event: React.PointerEvent<SVGSVGElement>): number | null => {
      const svg = svgRef.current;
      if (!svg || !build) return null;
      const box = svg.getBoundingClientRect();
      const unit = box.width / extent;
      const x = Math.floor((event.clientX - box.left) / unit) - QUIET;
      const y = Math.floor((event.clientY - box.top) / unit) - QUIET;
      if (x < 0 || y < 0 || x >= build.size || y >= build.size) return null;
      return y * build.size + x;
    },
    [build, extent],
  );

  const handleMove = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      const index = hitTest(event);
      setHovered(index);
      if (pointerDown.current && index !== null && onPaint) onPaint(index, event.shiftKey);
    },
    [hitTest, onPaint],
  );

  const handleDown = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      const index = hitTest(event);
      if (index === null) return;
      pointerDown.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      setFocusedModule(index);
      if (onPaint) onPaint(index, event.shiftKey);
    },
    [hitTest, onPaint, setFocusedModule],
  );

  const handleUp = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    pointerDown.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const handleKey = useCallback(
    (event: React.KeyboardEvent<SVGSVGElement>) => {
      if (!build) return;
      const current = state.focusedModule ?? 0;
      let x = current % build.size;
      let y = Math.floor(current / build.size);
      switch (event.key) {
        case 'ArrowLeft': x--; break;
        case 'ArrowRight': x++; break;
        case 'ArrowUp': y--; break;
        case 'ArrowDown': y++; break;
        case 'Home': x = 0; break;
        case 'End': x = build.size - 1; break;
        case 'PageUp': y = 0; break;
        case 'PageDown': y = build.size - 1; break;
        // The damage lab was pointer-only, while its own hint told the reader
        // to drag across the matrix. On a keyboard this is the better
        // instrument anyway: one module, exactly, which the 3 x 3 brush
        // cannot do.
        case 'Enter':
        case ' ':
          if (onPaint) {
            event.preventDefault();
            onPaint(current, event.shiftKey);
          }
          return;
        default: return;
      }
      event.preventDefault();
      x = Math.min(build.size - 1, Math.max(0, x));
      y = Math.min(build.size - 1, Math.max(0, y));
      setFocusedModule(y * build.size + x);
    },
    [build, state.focusedModule, setFocusedModule, onPaint],
  );

  // Focus has to land on a module, not on an abstraction. Without this the
  // readout says "none" until an arrow key arrives, which for a screen-reader
  // user may be never.
  const handleFocus = useCallback(() => {
    if (state.focusedModule === null) setFocusedModule(0);
  }, [state.focusedModule, setFocusedModule]);

  // Rects are created once per build and never remounted, so the matrix reads
  // as one persistent object across every stage.
  const cells = useMemo(() => {
    if (!build) return null;
    rects.current = new Array(build.size * build.size).fill(null);
    return build.modules.map((m, i) => (
      <rect
        key={i}
        ref={(el) => {
          rects.current[i] = el;
        }}
        x={m.x + QUIET}
        y={m.y + QUIET}
        width={1}
        height={1}
        shapeRendering="crispEdges"
        strokeWidth={0.12}
        fill="#ffffff"
      />
    ));
  }, [build]);

  const readoutIndex = state.focusedModule ?? hovered;
  const readout = build && readoutIndex !== null ? build.modules[readoutIndex] : null;

  return (
    <figure className="matrix">
      <svg
        ref={svgRef}
        className="matrix__svg"
        viewBox={`0 0 ${extent} ${extent}`}
        /* role="application", not role="img": an img prunes its descendants
           and is not a widget, so a screen reader in browse mode swallowed
           the arrow keys and this navigation never ran. DESIGN.md 8 promises
           it works, so it has to be a widget. */
        role="application"
        tabIndex={0}
        aria-label={`${t('matrix.caption')} ${size}×${size}`}
        aria-describedby="matrix-readout"
        onFocus={handleFocus}
        onPointerMove={handleMove}
        onPointerLeave={() => setHovered(null)}
        data-paintable={onPaint ? '' : undefined}
        onPointerDown={handleDown}
        onPointerUp={handleUp}
        onPointerCancel={handleUp}
        onKeyDown={handleKey}
      >
        <rect x={0} y={0} width={extent} height={extent} fill="#ffffff" />
        <g>{cells}</g>
      </svg>
      <figcaption className="matrix__readout" id="matrix-readout" role="status">
        {readout && build ? <Readout module={readout} build={build} /> : (
          <span className="label">{t('matrix.none')}</span>
        )}
      </figcaption>
    </figure>
  );
}

const EMPTY: Set<number> = new Set();

function Readout({ module, build }: { module: ModuleInfo; build: Build }) {
  const { t } = useCopy();
  const role = module.role;
  const carries =
    role.kind === 'data' || role.kind === 'ecc'
      ? `${t(roleLabelKey(role))} ${role.codeword}, ${t('matrix.bit')} ${role.bit}`
      : role.kind === 'format' || role.kind === 'version'
        ? `${t(roleLabelKey(role))} ${t('matrix.bit')} ${role.bit}`
        : t(roleLabelKey(role));

  return (
    <dl className="readout">
      <div>
        <dt>{t('matrix.coord')}</dt>
        <dd>{module.x},{module.y}</dd>
      </div>
      <div>
        <dt>{t('matrix.role')}</dt>
        <dd>{t(roleLabelKey(role))}</dd>
      </div>
      <div>
        <dt>{t('matrix.value')}</dt>
        <dd>{module.value ? t('matrix.dark') : t('matrix.light')}</dd>
      </div>
      <div>
        <dt>{t('matrix.maskFlipped')}</dt>
        <dd>{module.masked ? t('matrix.yes') : t('matrix.no')}</dd>
      </div>
      <div>
        <dt>{t('matrix.carries')}</dt>
        <dd>{carries}</dd>
      </div>
      {/* Always rendered, even for function patterns, so every role fills the
          same six cells and the strip cannot grow under the pointer. */}
      <div>
        <dt>{t('matrix.placementOrder')}</dt>
        <dd>
          {module.placementOrder !== null
            ? `${module.placementOrder} / ${build.size * build.size}`
            : '—'}
        </dd>
      </div>
    </dl>
  );
}

/**
 * Map the continuous stage position onto the three things the matrix animates.
 * Scrubbing halfway between "place" and "mask" shows the zigzag complete and
 * the mask half applied, which is what makes the scrubber an instrument rather
 * than a row of tabs (DESIGN.md §4.2).
 */
export function useStageProgress(stage: number) {
  return useMemo(
    () => ({
      placeProgress: clamp01(stage - 5),
      maskProgress: clamp01(stage - 6),
      infoProgress: clamp01(stage - 7),
    }),
    [stage],
  );
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

export { QUIET };
