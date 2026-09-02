import { useCallback, useMemo, useRef, useState } from 'react';
import type { Build } from '../../engine/encode';
import type { ModuleInfo } from '../../engine/provenance';
import { useCopy } from '../../copy';
import { useActions, useDamageSet, useHighlightSet, useStore } from '../../state/store';
import { duration, useTimedValue } from '../../ui/useTimedValue';
import { useMatrixPainter, type PaintState } from './useMatrixPainter';
import { roleLabelKey } from './roleLabel';
import './matrix.css';

const QUIET = 4;

export interface MatrixProps {
  /** Modules the user is currently painting damage onto. */
  onPaint?: (index: number) => void;
  painting?: boolean;
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
  painting = false,
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

  const size = build?.size ?? 21;
  const extent = size + QUIET * 2;

  const stageProgress = useStageProgress(state.stage);
  const anatomyProgress = useTimedValue(
    state.rendering === 'anatomy' ? 1 : 0,
    duration('--dur-anatomy', 480),
  );

  const paint: PaintState = {
    ...stageProgress,
    anatomyProgress,
    highlight,
    damage,
    repaired: repaired ?? EMPTY,
    focused: state.focusedModule ?? hovered,
    offences: offences ?? EMPTY,
    overrideGrid,
    tint,
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
      if (painting && index !== null && onPaint) onPaint(index);
    },
    [hitTest, painting, onPaint],
  );

  const handleDown = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      const index = hitTest(event);
      if (index === null) return;
      setFocusedModule(index);
      if (onPaint) onPaint(index);
    },
    [hitTest, onPaint, setFocusedModule],
  );

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
        default: return;
      }
      event.preventDefault();
      x = Math.min(build.size - 1, Math.max(0, x));
      y = Math.min(build.size - 1, Math.max(0, y));
      setFocusedModule(y * build.size + x);
    },
    [build, state.focusedModule, setFocusedModule],
  );

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
        role="img"
        tabIndex={0}
        aria-label={`${t('matrix.caption')} ${size}×${size}`}
        onPointerMove={handleMove}
        onPointerLeave={() => setHovered(null)}
        onPointerDown={handleDown}
        onKeyDown={handleKey}
      >
        <rect x={0} y={0} width={extent} height={extent} fill="#ffffff" />
        <g>{cells}</g>
      </svg>
      <figcaption className="matrix__readout" aria-live="polite">
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
      {module.placementOrder !== null && (
        <div>
          <dt>{t('matrix.placementOrder')}</dt>
          <dd>{module.placementOrder} / {build.size * build.size}</dd>
        </div>
      )}
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
