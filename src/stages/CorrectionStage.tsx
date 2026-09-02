import { useCopy } from '../copy';
import { Division } from '../views/Division/Division';
import { CITATIONS, Cite } from '../ui/Cite';

/** Stage 4. */
export function CorrectionStage() {
  const { t } = useCopy();
  return (
    <div className="stage">
      <h2 className="panel__heading">{t('stage.4.name')}</h2>
      <p className="gloss">
        {t('division.gloss')} <Cite citation={CITATIONS.errorCorrection} />
      </p>
      <Division />
    </div>
  );
}
