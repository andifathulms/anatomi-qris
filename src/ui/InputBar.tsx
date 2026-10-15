import { useEffect, useRef, useState } from 'react';
import { useCopy } from '../copy';
import { useActions, useStore } from '../state/store';
import { EC_LEVELS, type EcLevel } from '../engine/tables';
import { SAMPLES } from '../../samples/index';
import { Toggle } from './Toggle';
import type { CopyKey } from '../copy';
import './input-bar.css';

/**
 * The tray: where the specimen comes from. It sits at the top of the page,
 * under the identity, because it is the first thing a visitor should touch
 * and the thing every view below is derived from.
 *
 * The badge in the field says what the engine made of the text — the mode
 * for plain text, or that the QRIS lens is on — so typing gets an answer
 * before the reader has looked anywhere else.
 */
export function InputBar() {
  const { state, build, buildError, linkable, lensActive, qris } = useStore();
  const { setInput, setEcLevel } = useActions();
  const { t } = useCopy();
  const [copied, setCopied] = useState(false);
  const field = useRef<HTMLInputElement | null>(null);

  // Show the start of the payload rather than its tail: the first thing in a
  // QRIS string is the part that identifies it. Not focused on load — the
  // tray is at the top now, and a focused field on a phone opens a keyboard
  // over the specimen before the reader has seen it.
  useEffect(() => {
    const el = field.current;
    if (!el) return;
    el.setSelectionRange(0, 0);
    el.scrollLeft = 0;
  }, []);

  const activeSample = SAMPLES.find((s) => s.payload === state.input) ?? null;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard refused; the address bar still holds the link.
    }
  };

  const badge = lensActive
    ? `${t('lens.on')}${qris?.crcOk ? ` · ${t('tlv.crcOk')}` : ''}`
    : build
      ? `${t('summary.mode')} ${t(`mode.${build.mode}`)} · ${t('summary.version')} ${build.version}`
      : null;

  return (
    <div className="input-bar">
      <div className="input-bar__main">
        <div className="input-bar__field">
          <label className="visually-hidden" htmlFor="payload">{t('input.label')}</label>
          <div className="input-bar__well" data-lens={lensActive || undefined}>
            <input
              id="payload"
              ref={field}
              className="input-bar__input"
              type="text"
              autoComplete="off"
              spellCheck={false}
              placeholder={t('input.placeholder')}
              value={state.input}
              onChange={(event) => setInput(event.target.value)}
            />
            {badge && (
              <span className="input-bar__badge" data-lens={lensActive || undefined}>
                {lensActive && <span className="input-bar__badge-dot" aria-hidden="true" />}
                {badge}
              </span>
            )}
          </div>
        </div>

        <div className="input-bar__group">
          <Toggle<EcLevel>
            label={t('ec.label')}
            value={state.ecLevel}
            onChange={setEcLevel}
            options={EC_LEVELS.map((ec) => ({ value: ec, label: ec }))}
          />
        </div>
      </div>

      <div className="input-bar__meta">
        <div className="input-bar__samples" role="group" aria-label={t('input.samples')}>
          <span className="input-bar__samples-label">{t('input.samples')}</span>
          {SAMPLES.map((sample) => (
            <button
              key={sample.id}
              type="button"
              className="input-bar__sample"
              aria-pressed={activeSample?.id === sample.id}
              title={`${sample.note} ${t('input.chars', { n: sample.payload.length })}`}
              onClick={() => setInput(sample.payload)}
            >
              {sample.label}
            </button>
          ))}
        </div>

        <div className="input-bar__link">
          {linkable ? (
            <button type="button" className="button button--quiet" onClick={copyLink}>
              {copied ? t('input.copied') : t('input.copyLink')}
            </button>
          ) : (
            <p className="input-bar__suppressed label" title={t('input.linkSuppressedWhy')}>
              {t('input.linkSuppressed')}
            </p>
          )}
        </div>
      </div>

      <p className="input-bar__note label">
        {/* Every sample carries a sentence saying what it demonstrates; it
            belongs next to the thing it explains. */}
        {activeSample && <span className="input-bar__sample-note">{activeSample.note} · </span>}
        {t(`ec.${state.ecLevel}` as 'ec.L')}
        <span className="input-bar__guarantee"> · {t('app.offlineNote')}</span>
      </p>

      {buildError && (
        <p className="input-bar__error" role="status">
          {t(`input.${buildError}` as CopyKey)}
        </p>
      )}
    </div>
  );
}
