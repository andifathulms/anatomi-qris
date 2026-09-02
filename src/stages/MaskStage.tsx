import { useCopy } from '../copy';
import { MaskGallery } from '../views/MaskGallery/MaskGallery';
import { CITATIONS, Cite } from '../ui/Cite';

/** Stage 7. */
export function MaskStage() {
  const { t } = useCopy();
  return (
    <div className="stage">
      <h3 className="subheading">{t('mask.heading')}</h3>
      <p className="gloss">{t('mask.gloss')} <Cite citation={CITATIONS.mask} /></p>
      <MaskGallery />
    </div>
  );
}
