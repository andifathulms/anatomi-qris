import { useCopy } from '../copy';
import { Interleave } from '../views/Interleave/Interleave';
import { CITATIONS, Cite } from '../ui/Cite';

/** Stage 5. */
export function InterleaveStage() {
  const { t } = useCopy();
  return (
    <div className="stage">
      <h3 className="subheading">{t('interleave.heading')}</h3>
      <p className="gloss">
        {t('interleave.gloss')} <Cite citation={CITATIONS.interleave} />
      </p>
      <Interleave />
    </div>
  );
}
