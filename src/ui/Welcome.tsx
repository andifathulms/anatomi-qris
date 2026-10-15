import { useEffect, useRef, useState } from 'react';
import { useCopy } from '../copy';
import { useActions } from '../state/store';
import { SAMPLES } from '../../samples/index';
import './welcome.css';

const WELCOMED_KEY = 'anatomi-qris:welcomed';

/**
 * First visit only: the app's two questions, as two ways in.
 *
 * Not a fork. Both lead into the same view of the same build — one loads the
 * QRIS sample and opens the receipt, the other starts the guided tour of the
 * stages. Dismissing it, either way, is remembered in localStorage, which is
 * not a network request. Someone arriving on a shared link (?t=…) came for
 * that payload and never sees it.
 */
export function Welcome() {
  const { t } = useCopy();
  const { setInput, setView, setTouring } = useActions();
  const [open, setOpen] = useState(shouldWelcome);
  const first = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    first.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  function close() {
    try {
      window.localStorage.setItem(WELCOMED_KEY, '1');
    } catch {
      // Storage refused; the welcome may show again next visit.
    }
    setOpen(false);
  }

  const openReceipt = () => {
    setInput(SAMPLES[0].payload);
    setView('payload');
    close();
  };

  const startTour = () => {
    setTouring(true);
    close();
  };

  return (
    <div className="welcome" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <div className="welcome__card">
        <div className="welcome__hello">
          <h2 className="welcome__title" id="welcome-title">{t('welcome.title')}</h2>
          <p className="welcome__lede">{t('welcome.lede')}</p>
        </div>
        <div className="welcome__doors">
          <button ref={first} type="button" className="welcome__door welcome__door--main" onClick={openReceipt}>
            <span className="welcome__q">{t('welcome.qrisQ')}</span>
            <span className="welcome__body">{t('welcome.qrisBody')}</span>
            <span className="welcome__go">{t('welcome.qrisGo')} →</span>
          </button>
          <button type="button" className="welcome__door" onClick={startTour}>
            <span className="welcome__q">{t('welcome.buildQ')}</span>
            <span className="welcome__body">{t('welcome.buildBody')}</span>
            <span className="welcome__go">{t('welcome.buildGo')} →</span>
          </button>
        </div>
        <div className="welcome__foot">
          <p className="welcome__offline">
            <span className="topbar__offline-dot" aria-hidden="true" />
            {t('app.offlineNote')}
          </p>
          <button type="button" className="button button--quiet" onClick={close}>
            {t('welcome.skip')}
          </button>
        </div>
      </div>
    </div>
  );
}

function shouldWelcome(): boolean {
  if (typeof window === 'undefined') return false;
  if (new URLSearchParams(window.location.search).has('t')) return false;
  try {
    return window.localStorage.getItem(WELCOMED_KEY) === null;
  } catch {
    return false;
  }
}
