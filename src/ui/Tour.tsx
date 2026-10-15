import { useEffect, useRef } from 'react';
import { useCopy } from '../copy';
import { STAGE_COUNT, useActions, useStore } from '../state/store';
import { duration, easeStandard, prefersReducedMotion } from './useTimedValue';

/** Transitions between stages; the zigzag gets its own, longer one. */
const MOVE_MS = 900;

/**
 * The guided tour: the same stage slider, moved by a timer. Each stage holds
 * long enough to read its intro, then the slider scrubs to the next one —
 * continuously, so the zigzag draws itself and the mask washes in on the way.
 * Pausing leaves the reader on a real stage, because it is a real stage.
 *
 * Any stage change the tour did not make (a frame clicked, an arrow key, the
 * next button) hands control back to the reader and stops it.
 *
 * Mounted once. Under reduced motion the loop never runs: the button steps
 * one stage per press instead.
 */
export function TourController() {
  const { state } = useStore();
  const { setStage, setTouring } = useActions();
  // The last few values the tour wrote. A render can trail the loop by a
  // frame, so the check below compares against recent writes, not only the
  // latest one.
  const recent = useRef<number[]>([]);
  const frame = useRef(0);

  useEffect(() => {
    if (!state.touring) {
      recent.current = [];
      return;
    }
    const hold = duration('--dur-tour-step', 6200);
    const zigzag = duration('--dur-zigzag', 2400);
    let stage = Math.round(state.stage) >= STAGE_COUNT ? 1 : Math.max(1, Math.round(state.stage));
    let phase: 'hold' | 'move' = 'hold';
    let t0 = performance.now();

    const set = (value: number) => {
      recent.current = [value, ...recent.current].slice(0, 6);
      setStage(value);
    };
    set(stage);

    const tick = (now: number) => {
      if (phase === 'hold') {
        if (now - t0 >= hold) {
          if (stage >= STAGE_COUNT) {
            setTouring(false);
            return;
          }
          phase = 'move';
          t0 = now;
        }
      } else {
        const span = stage === 5 ? zigzag : MOVE_MS;
        const p = Math.min(1, (now - t0) / span);
        set(stage + easeStandard(p));
        if (p >= 1) {
          stage += 1;
          phase = 'hold';
          t0 = now;
        }
      }
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
    // The loop owns the stage while it runs; it reads it once, at the start.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.touring]);

  // Someone else moved the slider: the reader has taken over.
  useEffect(() => {
    if (!state.touring || recent.current.length === 0) return;
    if (!recent.current.some((v) => Math.abs(state.stage - v) < 1e-6)) setTouring(false);
  }, [state.stage, state.touring, setTouring]);

  // A tour that ends in the payload view is not a tour of the stages.
  useEffect(() => {
    if (state.touring && state.view === 'payload') setTouring(false);
  }, [state.view, state.touring, setTouring]);

  return null;
}

export function TourButton() {
  const { state } = useStore();
  const { setStage, setTouring } = useActions();
  const { t } = useCopy();
  const reduced = prefersReducedMotion();
  const stage = Math.round(state.stage);

  if (reduced) {
    return (
      <button
        type="button"
        className="button tour-button"
        onClick={() => setStage(stage >= STAGE_COUNT ? 1 : stage + 1)}
      >
        <span className="tour-button__icon" aria-hidden="true">▸</span>
        {t('tour.step')}
      </button>
    );
  }

  return (
    <button
      type="button"
      className="button tour-button"
      aria-pressed={state.touring}
      onClick={() => setTouring(!state.touring)}
    >
      <span className="tour-button__icon" aria-hidden="true">{state.touring ? '❚❚' : '▶'}</span>
      {state.touring ? `${t('tour.pause')} · ${stage}/${STAGE_COUNT}` : t('tour.play')}
    </button>
  );
}
