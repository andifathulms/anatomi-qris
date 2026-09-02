import { useMemo } from 'react';
import { LocaleContext, translator, useCopy } from './copy';
import { StoreProvider, useActions, useStore } from './state/store';
import { Matrix } from './views/Matrix/Matrix';
import { Toggle } from './ui/Toggle';
import { InputBar } from './ui/InputBar';
import { StageScrubber, stageIntroKey, stageNameKey } from './ui/StageScrubber';
import { Legend } from './ui/Legend';
import { StagePanel } from './stages/StagePanel';
import { blockTintFor } from './views/Interleave/blockTint';
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
  const { state, build } = useStore();
  const { setRendering, setLocale } = useActions();
  const { t, locale } = useCopy();

  // At the interleave stage the matrix carries the same block tints as the
  // grid beside it. That is where the coffee-stain argument actually lands:
  // adjacent modules are visibly different colours.
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

          <Matrix tint={tint} />

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
        </section>

        <section className="shell__panel panel">
          <StagePanel />
        </section>
      </main>

      <footer className="shell__footer">
        <StageScrubber />
        <InputBar />
      </footer>
    </div>
  );
}
