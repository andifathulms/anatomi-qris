import { useCallback, useRef } from 'react';
import { useCopy } from '../copy';
import { STAGE_COUNT, useActions, useStore } from '../state/store';
import type { CopyKey } from '../copy';
import './scrubber.css';

const STAGE_NAME_KEYS: CopyKey[] = [
  'stage.1.name', 'stage.2.name', 'stage.3.name', 'stage.4.name', 'stage.5.name',
  'stage.6.name', 'stage.7.name', 'stage.8.name', 'stage.9.name',
];

export function stageNameKey(stage: number): CopyKey {
  return STAGE_NAME_KEYS[Math.min(STAGE_COUNT, Math.max(1, Math.round(stage))) - 1];
}

export function stageIntroKey(stage: number): CopyKey {
  return `stage.${Math.min(STAGE_COUNT, Math.max(1, Math.round(stage)))}.intro` as CopyKey;
}

/**
 * Nine stations along a track. Dragging moves through them continuously,
 * clicking jumps. A continuous control maps the pointer directly with zero
 * easing (DESIGN.md §6.1) — that is what makes it feel like an instrument, and
 * it is why encode() has to stay inside 8 ms.
 */
export function StageScrubber() {
  const { state } = useStore();
  const { setStage } = useActions();
  const { t } = useCopy();
  const trackRef = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);

  const stageFromPointer = useCallback((clientX: number) => {
    const track = trackRef.current;
    if (!track) return null;
    const box = track.getBoundingClientRect();
    const ratio = (clientX - box.left) / box.width;
    return 1 + Math.min(1, Math.max(0, ratio)) * (STAGE_COUNT - 1);
  }, []);

  const handleDown = (event: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    const next = stageFromPointer(event.clientX);
    if (next !== null) setStage(next);
  };

  const handleMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const next = stageFromPointer(event.clientX);
    if (next !== null) setStage(next);
  };

  const handleUp = (event: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handleKey = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      event.preventDefault();
      setStage(Math.round(state.stage) - 1);
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      event.preventDefault();
      setStage(Math.round(state.stage) + 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setStage(1);
    } else if (event.key === 'End') {
      event.preventDefault();
      setStage(STAGE_COUNT);
    }
  };

  const fraction = (state.stage - 1) / (STAGE_COUNT - 1);

  return (
    <div className="scrubber">
      <div
        ref={trackRef}
        className="scrubber__track"
        role="slider"
        tabIndex={0}
        aria-label={t('stage.scrubber')}
        aria-valuemin={1}
        aria-valuemax={STAGE_COUNT}
        aria-valuenow={Math.round(state.stage)}
        aria-valuetext={t(stageNameKey(state.stage))}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onKeyDown={handleKey}
      >
        <div className="scrubber__rail" />
        <div className="scrubber__fill" style={{ width: `${fraction * 100}%` }} />
        {STAGE_NAME_KEYS.map((key, i) => {
          const at = i / (STAGE_COUNT - 1);
          const active = Math.round(state.stage) === i + 1;
          return (
            <button
              key={key}
              type="button"
              className="scrubber__station"
              style={{ left: `${at * 100}%` }}
              aria-current={active ? 'step' : undefined}
              onClick={(event) => {
                event.stopPropagation();
                setStage(i + 1);
              }}
            >
              <span className="scrubber__dot" data-active={active} />
              <span className="scrubber__label">{t(key)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The stage steppers live in the input row rather than above the track: the
 * footer is sticky, and anything stacked above the track floats over the stage
 * panel behind it.
 */
export function StageSteps() {
  const { state } = useStore();
  const { setStage } = useActions();
  const { t } = useCopy();
  const stage = Math.round(state.stage);

  return (
    <div className="scrubber__steps">
      <button
        type="button"
        className="button"
        onClick={() => setStage(stage - 1)}
        disabled={stage <= 1}
      >
        {t('stage.previous')}
      </button>
      <button
        type="button"
        className="button"
        onClick={() => setStage(stage + 1)}
        disabled={stage >= STAGE_COUNT}
      >
        {t('stage.next')}
      </button>
    </div>
  );
}
