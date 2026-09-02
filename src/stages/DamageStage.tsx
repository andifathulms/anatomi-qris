import { useCopy } from '../copy';
import { DamageLab } from '../views/DamageLab/DamageLab';

/** Stage 9 — the payoff. */
export function DamageStage() {
  const { t } = useCopy();
  return (
    <div className="stage">
      <h3 className="subheading">{t('damage.heading')}</h3>
      <p className="gloss">{t('damage.gloss')}</p>
      <DamageLab />
    </div>
  );
}
