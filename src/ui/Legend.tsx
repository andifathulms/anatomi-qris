import { useMemo } from 'react';
import { useCopy } from '../copy';
import { useActions, useStore } from '../state/store';
import { ROLE_KEYS, roleKey, type RoleKey } from '../views/Matrix/palette';
import { roleKindKey } from '../views/Matrix/roleLabel';
import './legend.css';

const CSS_VAR: Record<RoleKey, string> = {
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

/**
 * The ten roles as a module budget, drawn to scale: every module in the
 * symbol is counted once, from the provenance map, so the bar is also an
 * answer to "where do the modules go". Each role is a toggle; picking one
 * isolates it in the matrix, which answers "where are the format bits?" in
 * one tap.
 *
 * Warm half then cool half — structure, then content. Roles with no modules
 * at this version (version information below 7, remainder bits at some
 * versions) are left out rather than shown as zero.
 */
export function Legend() {
  const { build, state } = useStore();
  const { setIsolatedRole } = useActions();
  const { t, locale } = useCopy();

  const counts = useMemo(() => {
    const out = Object.fromEntries(ROLE_KEYS.map((k) => [k, 0])) as Record<RoleKey, number>;
    if (build) for (const m of build.modules) out[roleKey(m.role)]++;
    return out;
  }, [build]);

  if (!build) return null;
  const present = ROLE_KEYS.filter((k) => counts[k] > 0);
  const isolated = state.isolatedRole;

  return (
    <div className="legend">
      <div className="legend__head">
        <h3 className="eyebrow">{t('role.legend')}</h3>
        <p className="legend__gloss">{t('role.legendGloss')}</p>
      </div>
      <div className="legend__bar" aria-hidden="true">
        {present.map((key) => (
          <span
            key={key}
            className="legend__segment"
            data-dim={(isolated && isolated !== key) || undefined}
            style={{ flexGrow: counts[key], background: `var(${CSS_VAR[key]})` }}
          />
        ))}
      </div>
      <ul className="legend__list">
        {present.map((key) => (
          <li key={key}>
            <button
              type="button"
              className="legend__item"
              aria-pressed={isolated === key}
              onClick={() => setIsolatedRole(isolated === key ? null : key)}
            >
              <span
                className="legend__swatch"
                style={{ background: `var(${CSS_VAR[key]})` }}
                aria-hidden="true"
              />
              {t(roleKindKey(key))}
              <span className="legend__count">{counts[key].toLocaleString(locale === 'id' ? 'id-ID' : 'en-GB')}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
