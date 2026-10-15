import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useCopy } from '../copy';
import { STAGE_COUNT, useActions, useStore } from '../state/store';
import type { CopyKey } from '../copy';
import { CHAPTERS, chapterOf, endsChapter } from './chapters';
import { paintStageThumb } from './stageThumb';
import { readPalette } from '../views/Matrix/palette';
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

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * The spine of the app: nine frames in four chapters, along the bottom edge.
 * Each frame is a live thumbnail of the symbol at the end of that stage, so
 * the control explains itself — you can see what each stage does before you
 * go there.
 *
 * It is still a slider, not a row of tabs. Dragging anywhere on the strip
 * moves through stages continuously, and fractional positions are real:
 * halfway between "place" and "mask" shows the zigzag complete and the mask
 * half applied. Because the frames sit in chapter groups they are not evenly
 * spaced, so the pointer is mapped piecewise between frame centres rather
 * than across the strip's width. A continuous control maps the pointer
 * directly with zero easing (DESIGN.md §6.1).
 */
export function StageScrubber() {
  const { state, build } = useStore();
  const { setStage } = useActions();
  const { t } = useCopy();
  const trackRef = useRef<HTMLDivElement | null>(null);
  const frameRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const canvasRefs = useRef<Array<HTMLCanvasElement | null>>([]);
  const dragging = useRef(false);
  const [centres, setCentres] = useState<number[]>([]);

  // Frame centres along the track, in track coordinates. Measured, because
  // CSS alone decides how wide frames and chapter gaps are at each width.
  useLayoutEffect(() => {
    const measure = () => {
      const track = trackRef.current;
      if (!track) return;
      const left = track.getBoundingClientRect().left;
      setCentres(
        frameRefs.current.map((el) => {
          if (!el) return 0;
          const box = el.getBoundingClientRect();
          return box.left - left + box.width / 2;
        }),
      );
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Frames repaint when the build or the theme changes, never per stage.
  useLayoutEffect(() => {
    if (!build) return;
    const palette = readPalette();
    canvasRefs.current.forEach((canvas, i) => {
      if (canvas) paintStageThumb(canvas, build, i + 1, palette);
    });
  }, [build, state.theme]);

  const stageFromPointer = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track || centres.length !== STAGE_COUNT) return null;
      const x = clientX - track.getBoundingClientRect().left;
      if (x <= centres[0]) return 1;
      if (x >= centres[STAGE_COUNT - 1]) return STAGE_COUNT;
      for (let i = 0; i < STAGE_COUNT - 1; i++) {
        if (x < centres[i + 1]) {
          const span = centres[i + 1] - centres[i] || 1;
          return i + 1 + (x - centres[i]) / span;
        }
      }
      return STAGE_COUNT;
    },
    [centres],
  );

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
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleKey = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      setStage(Math.round(state.stage) - 1);
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
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

  const current = Math.round(state.stage);
  const currentChapter = chapterOf(state.stage);

  // The playhead sits between frame centres at fractional stages.
  const lower = Math.max(1, Math.min(STAGE_COUNT, Math.floor(state.stage)));
  const upper = Math.min(STAGE_COUNT, lower + 1);
  const playhead =
    centres.length === STAGE_COUNT
      ? centres[lower - 1] + (centres[upper - 1] - centres[lower - 1]) * (state.stage - lower)
      : null;

  return (
    <div className="film">
      {/* On a narrow strip the chapter names come off the groups; this one
          line names where the reader is instead. */}
      <p className="film__now" aria-hidden="true">
        <span className="film__numeral">{currentChapter.numeral}</span>
        {t(currentChapter.name)} · {t(stageNameKey(state.stage))}
      </p>
      <div
        ref={trackRef}
        className="film__track scrubber__track"
        role="slider"
        tabIndex={0}
        aria-label={t('stage.scrubber')}
        aria-valuemin={1}
        aria-valuemax={STAGE_COUNT}
        aria-valuenow={current}
        aria-valuetext={`${t('chapter.label', { n: currentChapter.numeral })} · ${t(stageNameKey(state.stage))}`}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={handleUp}
        onKeyDown={handleKey}
      >
        {CHAPTERS.map((chapter) => (
          <div
            key={chapter.n}
            className="film__chapter"
            data-active={chapter.n === currentChapter.n || undefined}
            title={t(chapter.question)}
          >
            <span className="film__chapter-name" aria-hidden="true">
              <span className="film__numeral">{chapter.numeral}</span>
              {t(chapter.name)}
            </span>
            <div className="film__frames">
              {chapter.stages.map((n) => {
                const status = n === current ? 'current' : n < current ? 'passed' : 'ahead';
                return (
                  <button
                    key={n}
                    ref={(el) => {
                      frameRefs.current[n - 1] = el;
                    }}
                    type="button"
                    className="film__frame scrubber__station"
                    data-status={status}
                    /* The track is the control and carries the only tab stop.
                       A slider prunes its own descendants from the
                       accessibility tree; pointer users still click. */
                    tabIndex={-1}
                    aria-current={n === current ? 'step' : undefined}
                    onClick={(event) => {
                      event.stopPropagation();
                      setStage(n);
                    }}
                  >
                    <canvas
                      ref={(el) => {
                        canvasRefs.current[n - 1] = el;
                      }}
                      className="film__thumb"
                      aria-hidden="true"
                    />
                    <span className="film__label">{t(STAGE_NAME_KEYS[n - 1])}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {playhead !== null && (
          <span className="film__playhead" style={{ left: `${playhead}px` }} aria-hidden="true" />
        )}
      </div>
      <p className="film__hint">{t('app.stagesHint')}</p>
    </div>
  );
}

/**
 * Previous and next, at the foot of the stage panel. Each names where it
 * goes, and the last stage of a chapter says the chapter is done and names
 * the next one — the small change that turns a control panel into a story.
 */
export function StageSteps() {
  const { state } = useStore();
  const { setStage } = useActions();
  const { t } = useCopy();
  const stage = Math.round(state.stage);
  const next = Math.min(STAGE_COUNT, stage + 1);
  const previous = Math.max(1, stage - 1);
  const closing = endsChapter(stage) && stage < STAGE_COUNT;
  const nextChapter = chapterOf(next);

  return (
    <div className="steps">
      {stage > 1 ? (
        <button
          type="button"
          className="button steps__button"
          onClick={() => setStage(previous)}
          aria-label={`${t('stage.previous')}: ${t(stageNameKey(previous))}`}
        >
          <span aria-hidden="true">←</span>
          <span className="steps__text">
            <small>{`${pad(previous)} · ${t('nav.previous')}`}</small>
            {t(stageNameKey(previous))}
          </span>
        </button>
      ) : (
        <span />
      )}
      {stage < STAGE_COUNT && (
        <button
          type="button"
          className="button button--accent steps__button steps__button--next"
          onClick={() => setStage(next)}
          aria-label={`${t('stage.next')}: ${t(stageNameKey(next))}`}
        >
          <span className="steps__text">
            <small>
              {closing
                ? `${t('nav.chapterDone', { n: chapterOf(stage).numeral })} · ${t('chapter.label', { n: nextChapter.numeral })}`
                : `${pad(next)} · ${t('nav.next')}`}
            </small>
            {closing ? t(nextChapter.name) : t(stageNameKey(next))}
          </span>
          <span aria-hidden="true">→</span>
        </button>
      )}
    </div>
  );
}
