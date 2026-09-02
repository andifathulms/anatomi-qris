import { useEffect, useRef, useState } from 'react';
import { useCopy } from '../copy';
import { useActions, useStore } from '../state/store';
import { duration, easeStandard, prefersReducedMotion } from '../ui/useTimedValue';
import { CITATIONS, Cite } from '../ui/Cite';

/**
 * Stage 6, the zigzag — the app's first orchestrated moment (DESIGN.md §6.3).
 *
 * Play animates the stage value itself from 5 to 6, so the scrubber and the
 * animation are the same control rather than two that can disagree. Under
 * reduced motion, play is replaced by stepping: each press writes one batch
 * immediately.
 */
export function PlaceStage() {
  const { state, build } = useStore();
  const { setStage } = useActions();
  const { t } = useCopy();
  const [playing, setPlaying] = useState(false);
  const frame = useRef(0);
  const reduced = prefersReducedMotion();

  useEffect(() => {
    if (!playing) return;
    const total = duration('--dur-zigzag', 2400);
    const start = performance.now();
    setStage(5);
    const tick = (now: number) => {
      const t0 = Math.min(1, (now - start) / total);
      setStage(5 + easeStandard(t0));
      if (t0 < 1) frame.current = requestAnimationFrame(tick);
      else setPlaying(false);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [playing, setStage]);

  if (!build) return null;

  const placed = Math.max(0, Math.min(1, state.stage - 5));
  const total = build.modules.filter((m) => m.placementOrder !== null).length;

  return (
    <div className="stage">
      <p className="gloss">
        <Cite citation={CITATIONS.placement} />
      </p>

      <dl className="figures">
        <div className="figures__item">
          <dt className="label">{t('matrix.placementOrder')}</dt>
          <dd className="figure">{Math.round(placed * total)}</dd>
        </div>
        <div className="figures__item">
          <dt className="label">{t('summary.modules')}</dt>
          <dd className="figure">{total}</dd>
        </div>
      </dl>

      <div className="stage__controls">
        {reduced ? (
          <button
            type="button"
            className="button"
            onClick={() => setStage(Math.min(6, state.stage + 1 / 24))}
          >
            {t('division.stepForward')}
          </button>
        ) : (
          <button type="button" className="button" onClick={() => setPlaying((p) => !p)}>
            {playing ? t('division.pause') : t('division.play')}
          </button>
        )}
        <button type="button" className="button" onClick={() => setStage(5)}>
          {t('interleave.reset')}
        </button>
      </div>
    </div>
  );
}
