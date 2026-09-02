import { useCopy } from '../copy';
import { ROLE_KEYS } from '../views/Matrix/palette';
import { roleKindKey } from '../views/Matrix/roleLabel';
import './legend.css';

const CSS_VAR: Record<string, string> = {
  finder: '--role-finder',
  separator: '--role-separator',
  timing: '--role-timing',
  alignment: '--role-alignment',
  darkModule: '--role-darkmodule',
  format: '--role-format',
  version: '--role-version',
  data: '--role-data',
  ecc: '--role-ecc',
  remainder: '--role-remainder',
};

/** The ten roles, warm half then cool half — structure, then content. */
export function Legend() {
  const { t } = useCopy();
  return (
    <div className="legend">
      <h3 className="label">{t('role.legend')}</h3>
      <p className="gloss legend__gloss">{t('role.legendGloss')}</p>
      <ul className="legend__list">
        {ROLE_KEYS.map((key) => (
          <li key={key} className="legend__item">
            <span
              className="legend__swatch"
              style={{ background: `var(${CSS_VAR[key]})` }}
              aria-hidden="true"
            />
            {t(roleKindKey(key === 'darkModule' ? 'darkModule' : key))}
          </li>
        ))}
      </ul>
    </div>
  );
}
