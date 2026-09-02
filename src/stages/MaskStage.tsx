import { useCopy } from '../copy';
import { MaskGallery } from '../views/MaskGallery/MaskGallery';

/** Stage 7. */
export function MaskStage() {
  const { t } = useCopy();
  return (
    <div className="stage">
      <h2 className="panel__heading">{t('mask.heading')}</h2>
      <p className="gloss">{t('mask.gloss')}</p>
      <MaskGallery />
    </div>
  );
}
