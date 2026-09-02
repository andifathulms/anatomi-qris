import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LocaleContext, translator, useCopy } from './copy';
import { StoreProvider, useActions, useStore } from './state/store';
import { Matrix } from './views/Matrix/Matrix';
import { Toggle } from './ui/Toggle';
import { InputBar } from './ui/InputBar';
import { StageScrubber, stageIntroKey, stageNameKey } from './ui/StageScrubber';
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
  const { setRendering, setLocale, damage } = useActions();
  const { t, locale } = useCopy();

  // At the interleave stage the matrix carries the same block tints as the
  // grid beside it. That is where the coffee-stain argument actually lands:
  // adjacent modules are visibly different colours.
  const offences = useOffences();
  const report = useDamageReport();
  const inDamageLab = Math.round(state.stage) === 9;

  // The brush: one module wide by default, widened by holding shift.
  const paint = useCallback(
    (index: number) => {
      if (!inDamageLab || !build) return;
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

  return (
    <div className="shell">
      <a className="skip-link" href="#matrix">{t('app.skipToMatrix')}</a>

      <header className="shell__header">
        <div>
          <h1 className="shell__title">{t('app.title')}</h1>
          <p className="label">{t('app.tagline')}</p>
        </div>
        <div className="shell__header-right">
          <button
            type="button"
            className="button"
            onClick={() => setLocale(locale === 'id' ? 'en' : 'id')}
          >
            {t('app.locale')}
          </button>
          <p className="shell__offline label">{t('app.offline')} ✓</p>
        </div>
      </header>

      <main className="shell__main">
        <section className="shell__stage" id="matrix">
          <h2 className="display">{t(stageNameKey(state.stage))}</h2>
          <p className="prose shell__intro">{t(stageIntroKey(state.stage))}</p>

          <Matrix
            tint={tint}
            offences={offences}
            overrideGrid={overrideGrid}
            repaired={repaired}
            {...(inDamageLab ? { onPaint: paint } : {})}
          />

          <div className="matrix__controls">
            <p className="matrix__summary">
              {build ? (
                <>
                  <span>{t('summary.version')} <b>{build.version}</b></span>
                  <span>{t('summary.ec')} <b>{build.ecLevel}</b></span>
                  <span>{t('summary.mode')} <b>{t(`mode.${build.mode}`)}</b></span>
                  <span>{t('summary.mask')} <b>{build.chosenMask}</b></span>
                  <span>{build.size}×{build.size} {t('summary.modules')}</span>
                </>
              ) : null}
            </p>
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

          {state.rendering === 'anatomy' && <Legend />}

          <CodewordTable />
        </section>

        <section className="shell__panel panel">
          <StagePanel />
        </section>
      </main>

      {/* Present at every stage when the lens is active: the payload's meaning
          does not change as the encoding proceeds, only its representation. */}
      {lensActive && (
        <section className="shell__tree panel">
          <PayloadTree />
        </section>
      )}

      <footer className="shell__footer">
        <StageScrubber />
        <InputBar />
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
