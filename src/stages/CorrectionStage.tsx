import { useCopy } from '../copy';
import { Division } from '../views/Division/Division';
import { CITATIONS, Cite } from '../ui/Cite';

/** Stage 4. */
export function CorrectionStage() {
  const { t } = useCopy();
  return (
    <div className="stage">
      <p className="gloss">
        {t('division.gloss')} <Cite citation={CITATIONS.errorCorrection} />
      </p>
      {/* The most alien idea in the app arrived as a given. It says what the
          division is over, never what that is or why it is used. */}
      <p className="gloss">{t('division.fieldGloss')}</p>
      <Division />
    </div>
  );
}
