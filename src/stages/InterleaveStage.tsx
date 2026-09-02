import { useCopy } from '../copy';
import { Interleave } from '../views/Interleave/Interleave';
import { CITATIONS, Cite } from '../ui/Cite';

/** Stage 5. */
export function InterleaveStage() {
  const { t } = useCopy();
  return (
    <div className="stage">
      <h2 className="panel__heading">{t('interleave.heading')}</h2>
      <p className="gloss">
        {t('interleave.gloss')} <Cite citation={CITATIONS.interleave} />
      </p>
      <Interleave />
    </div>
  );
}
