import { useState } from 'react';
import { useCopy } from '../copy';
import { useActions, useStore } from '../state/store';
import { EC_LEVELS, type EcLevel } from '../engine/tables';
import { SAMPLES } from '../../samples/index';
import { Toggle } from './Toggle';
import type { CopyKey } from '../copy';
import './input-bar.css';

/**
 * Input and stage are the two things a user changes constantly, so they share
 * the bottom bar and everything else lives in the stage panel (DESIGN.md §4.2).
 *
 * The offline guarantee sits here as a plain statement of fact rather than a
 * badge, because this is where someone pastes a real payment payload.
 */
export function InputBar() {
  const { state, buildError, linkable } = useStore();
  const { setInput, setEcLevel } = useActions();
  const { t } = useCopy();
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="input-bar">
      <div className="input-bar__field">
        <label className="label" htmlFor="payload">{t('input.label')}</label>
        <input
          id="payload"
          className="input-bar__input"
          type="text"
          autoComplete="off"
          spellCheck={false}
          autoFocus
          placeholder={t('input.placeholder')}
          value={state.input}
          onChange={(event) => setInput(event.target.value)}
        />
        <p className="input-bar__note">{t('app.offlineNote')}</p>
      </div>

      <div className="input-bar__controls">
        <div className="input-bar__group">
          <span className="label" id="ec-label">{t('ec.label')}</span>
          <Toggle<EcLevel>
            label={t('ec.label')}
            value={state.ecLevel}
            onChange={setEcLevel}
            options={EC_LEVELS.map((ec) => ({ value: ec, label: ec }))}
          />
        </div>

        <div className="input-bar__group">
          <label className="label" htmlFor="sample">{t('input.samples')}</label>
          <select
            id="sample"
            className="input-bar__select"
            value={SAMPLES.find((s) => s.payload === state.input)?.id ?? ''}
            onChange={(event) => {
              const sample = SAMPLES.find((s) => s.id === event.target.value);
              if (sample) setInput(sample.payload);
            }}
          >
            <option value="">—</option>
            {SAMPLES.map((sample) => (
              <option key={sample.id} value={sample.id}>{sample.label}</option>
            ))}
          </select>
        </div>

        {linkable ? (
          <button type="button" className="button" onClick={copyLink}>
            {copied ? t('input.copied') : t('input.copyLink')}
          </button>
        ) : (
          <p className="input-bar__suppressed label">{t('input.linkSuppressed')}</p>
        )}
      </div>

      {buildError && (
        <p className="input-bar__error" role="status">
          {t(`input.${buildError}` as CopyKey)}
        </p>
      )}
    </div>
  );
}
