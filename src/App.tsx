import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LocaleContext, translator, useCopy } from './copy';
import { STAGE_COUNT, StoreProvider, useActions, useStore, type Theme } from './state/store';
import { Matrix } from './views/Matrix/Matrix';
import { Toggle } from './ui/Toggle';
import { BrandMark } from './ui/BrandMark';
import { InputBar } from './ui/InputBar';
import { MakerSignature } from './ui/MakerSignature';
import { StageScrubber, StageSteps, stageIntroKey, stageNameKey } from './ui/StageScrubber';
import { chapterOf } from './ui/chapters';
import { Legend } from './ui/Legend';
import { CodewordTable } from './ui/CodewordTable';
import { StagePanel } from './stages/StagePanel';
import { PayloadTree } from './views/PayloadTree/PayloadTree';
import { blockTintFor } from './views/Interleave/blockTint';
import { useOffences } from './views/MaskGallery/MaskGallery';
import { useDamageReport } from './views/DamageLab/DamageLab';
import { duration, prefersReducedMotion } from './ui/useTimedValue';
import './styles/app.css';

export function App() {
  return (
    <StoreProvider>
      <Localised>
        <Shell />
      </Localised>
    </StoreProvider>
  );
}

function Localised({ children }: { children: React.ReactNode }) {
  const { state } = useStore();
  const value = useMemo(
    () => ({ locale: state.locale, t: translator(state.locale) }),
    [state.locale],
  );
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

function Shell() {
  const { state, build, lensActive } = useStore();
  const { setRendering, setLocale, setTheme, damage } = useActions();
  const { t, locale } = useCopy();

  // At the interleave stage the matrix carries the same block tints as the
  // grid beside it. That is where the coffee-stain argument actually lands:
  // adjacent modules are visibly different colours.
  const offences = useOffences();
  const report = useDamageReport();
  const inDamageLab = Math.round(state.stage) === 9;

  // The brush: one module wide by default, widened to 3 x 3 by holding shift.
  // One module is the pedagogically important size — it is how you show that
  // a single broken module corrupts exactly one codeword — and it was the
  // documented behaviour long before it was the implemented one.
  const paint = useCallback(
    (index: number, wide: boolean) => {
      if (!inDamageLab || !build) return;
      if (!wide) {
        damage([index]);
        return;
      }
      const x = index % build.size;
      const y = Math.floor(index / build.size);
      const hit: number[] = [];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= build.size || ny >= build.size) continue;
          hit.push(ny * build.size + nx);
        }
      }
      damage(hit);
    },
    [inDamageLab, build, damage],
  );

  // The repair pulse: corrected modules flash --repair for its duration, then
  // snap to their true values. Under reduced motion it is a one-frame set.
  const repaired = useRepairPulse(report?.repairedModules ?? null, inDamageLab);


  // A selected mask card shows that candidate on the main matrix, with its
  // penalty geometry marked in place.
  const overrideGrid =
    build && Math.round(state.stage) === 7 && state.selectedMask !== null
      ? build.maskGrids[state.selectedMask]
      : null;

  const tint = useMemo(
    () => (build && Math.round(state.stage) === 5 ? blockTintFor(build) : null),
    [build, state.stage],
  );

  const stage = Math.round(state.stage);
  const chapter = chapterOf(state.stage);

  return (
    <div className="shell">
      <a className="skip-link" href="#matrix">{t('app.skipToMatrix')}</a>

      <header className="topbar">
        <div className="topbar__identity">
          <BrandMark />
          <h1 className="topbar__wordmark">{t('app.title')}</h1>
          <p className="topbar__tagline">{t('app.tagline')}</p>
        </div>
        <div className="topbar__controls">
          {/* A statement of fact, not a badge. This is where someone pastes a
              real payment payload. */}
          <p className="topbar__offline">
            <span className="topbar__offline-dot" aria-hidden="true" />
            {t('app.offline')}
          </p>
          <Toggle<Theme>
            label={t('app.theme')}
            value={state.theme}
            onChange={setTheme}
            options={[
              { value: 'dark', label: t('app.themeDark') },
              { value: 'light', label: t('app.themeLight') },
            ]}
          />
          <button
            type="button"
            className="button button--quiet"
            onClick={() => setLocale(locale === 'id' ? 'en' : 'id')}
          >
            {t('app.locale')}
          </button>
        </div>
      </header>

      {/* The tray: where the specimen comes from, so it comes first. */}
      <div className="tray">
        <InputBar />
      </div>

      <main className="workbench">
        {/* The specimen never moves. Nine stages must read as one object being
            transformed, not nine illustrations in a row. DESIGN.md §4.1.
            Named by its own heading rather than a duplicate aria-label. */}
        <section className="specimen" id="matrix" aria-labelledby="specimen-heading">
          <div className="specimen__head">
            <h2 className="visually-hidden" id="specimen-heading">{t('app.specimen')}</h2>
            {build && (
              <p className="chips">
                <span className="chip">{t('summary.version')} <b>{build.version}</b></span>
                <span className="chip">{t('summary.ec')} <b>{build.ecLevel}</b></span>
                <span className="chip">{t('summary.mode')} <b>{t(`mode.${build.mode}`)}</b></span>
                <span className="chip">{t('summary.mask')} <b>{build.chosenMask}</b></span>
                <span className="chip">
                  {t('summary.size')} <b>{build.size}×{build.size}</b>
                </span>
              </p>
            )}
            <Toggle<'printed' | 'anatomy'>
              label={t('matrix.caption')}
              value={state.rendering}
              onChange={setRendering}
              options={[
                { value: 'printed', label: t('matrix.asPrinted') },
                { value: 'anatomy', label: t('matrix.anatomy') },
              ]}
            />
          </div>

          <div className="specimen__paper">
            <Matrix
              tint={tint}
              offences={offences}
              overrideGrid={overrideGrid}
              repaired={repaired}
              {...(inDamageLab ? { onPaint: paint } : {})}
            />
          </div>

          {state.rendering === 'anatomy' && <Legend />}

          <CodewordTable />
        </section>

        <div className="workbench__column">
          <section className="panel card" aria-labelledby="stage-heading">
            <header className="panel__head">
              <p className="panel__chapter">
                {t('chapter.label', { n: chapter.numeral })} · {t(chapter.name)}
              </p>
              <h2 className="panel__step" id="stage-heading">
                <span className="panel__index">
                  {String(stage).padStart(2, '0')}
                  <span className="panel__index-total">
                    /{String(STAGE_COUNT).padStart(2, '0')}
                  </span>
                </span>
                <span className="panel__step-name">{t(stageNameKey(state.stage))}</span>
              </h2>
              {/* The largest slot on the page states what the app is, on the
                  one stage a first-time visitor arrives at. */}
              {!state.stageTouched && stage === 1 && (
                <p className="panel__lede">{t('app.lede')}</p>
              )}
              <p className="prose panel__intro">{t(stageIntroKey(state.stage))}</p>
            </header>
            <div className="panel__body">
              <StagePanel />
            </div>
            <footer className="panel__foot">
              <StageSteps />
            </footer>
          </section>

          {/* Present at every stage when the lens is active: the payload's
              meaning does not change as the encoding proceeds, only its
              representation. */}
          {lensActive && (
            <section className="card">
              <PayloadTree />
            </section>
          )}
        </div>
      </main>

      {/* The filmstrip: the spine of the app, along the bottom edge where a
          timeline lives. DESIGN.md §4.2. */}
      <nav className="filmstrip" aria-label={t('app.stages')}>
        <StageScrubber />
      </nav>

      {/* The maker's mark: personal credit, kept away from the offline
          guarantee it must not be mistaken for. */}
      <footer className="colophon">
        <MakerSignature />
      </footer>
    </div>
  );
}

/**
 * Hold the repair highlight for the duration of the pulse, then let go. The
 * set is recomputed on every brush movement, so this keeps the flash from
 * restarting on each frame.
 */
function useRepairPulse(source: Set<number> | null, active: boolean): Set<number> {
  const [pulse, setPulse] = useState<Set<number>>(EMPTY_SET);
  const timer = useRef(0);
  const signature = source ? [...source].sort((a, b) => a - b).join(',') : '';

  useEffect(() => {
    if (!active || !source || source.size === 0) {
      setPulse(EMPTY_SET);
      return;
    }
    setPulse(source);
    if (prefersReducedMotion()) return;
    timer.current = window.setTimeout(
      () => setPulse(EMPTY_SET),
      duration('--dur-repair', 300),
    );
    return () => window.clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, active]);

  return pulse;
}

const EMPTY_SET: Set<number> = new Set();
