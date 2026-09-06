import { useMemo } from 'react';
import { useCopy } from '../copy';
import { useStore } from '../state/store';
import {
  EC_INDICATOR,
  FORMAT_GENERATOR,
  FORMAT_XOR,
  bchRemainder,
  formatInfo,
  hasVersionInfo,
  versionInfo,
} from '../engine/tables';
import { Figure } from './InputStage';
import { CITATIONS, Cite } from '../ui/Cite';

/**
 * Stage 8. Format and version information are written last, outside the mask,
 * because a scanner has to read them before it knows which mask was used.
 */
export function FinalStage() {
  const { build } = useStore();
  const { t } = useCopy();
  if (!build) return null;

  const format = formatInfo(build.ecLevel, build.chosenMask);

  /*
   * The working behind that fifteen-bit string. It was printed as a fact while
   * the division next door showed every step of its own arithmetic. Recomputed
   * here from the engine's own constants rather than a second copy of them, so
   * the display cannot drift from what was written into the matrix.
   */
  const fmtData = (EC_INDICATOR[build.ecLevel] << 3) | build.chosenMask;
  const fmtRemainder = bchRemainder(fmtData << 10, FORMAT_GENERATOR, 10);
  const fmtRaw = (fmtData << 10) | fmtRemainder;
  const bits = (n: number, width: number) => n.toString(2).padStart(width, '0');
  const version = hasVersionInfo(build.version) ? versionInfo(build.version) : null;

  return (
    <div className="stage">
      <p className="gloss">{t('final.gloss')} <Cite citation={CITATIONS.format} /></p>

      <dl className="figures">
        <Figure label={t('summary.version')} value={String(build.version)} />
        <Figure label={t('summary.mask')} value={String(build.chosenMask)} />
        <Figure label={t('summary.ec')} value={build.ecLevel} />
      </dl>

      <ModuleBudget />

      <table className="data-table">
        <tbody>
          <tr>
            <th scope="row">{t('final.formatData')}</th>
            <td className="mono-bits">
              {bits(fmtData, 5)}
              <span className="data-table__gloss">
                {t('final.formatDataGloss', {
                  ec: build.ecLevel,
                  ecBits: bits(EC_INDICATOR[build.ecLevel], 2),
                  mask: build.chosenMask,
                  maskBits: bits(build.chosenMask, 3),
                })}
              </span>
            </td>
          </tr>
          <tr>
            <th scope="row">{t('final.formatBch')}</th>
            <td className="mono-bits">
              {bits(fmtRemainder, 10)}
              <span className="data-table__gloss">
                {t('final.formatBchGloss', { generator: bits(FORMAT_GENERATOR, 11) })}
              </span>
            </td>
          </tr>
          <tr>
            <th scope="row">{t('role.format')}</th>
            <td className="mono-bits">
              {bits(format, 15)}
              <span className="data-table__gloss">
                {t('final.formatXorGloss', {
                  raw: bits(fmtRaw, 15),
                  mask: bits(FORMAT_XOR, 15),
                })}
              </span>
            </td>
          </tr>
          <tr>
            <th scope="row">{t('role.version')}</th>
            <td className="mono-bits">
              {version === null ? '—' : version.toString(2).padStart(18, '0')}
            </td>
          </tr>
          <tr>
            <th scope="row">{t('role.remainder')}</th>
            <td>{build.remainderBits}</td>
          </tr>
          <tr>
            <th scope="row">{t('summary.size')}</th>
            <td>{build.size} × {build.size} {t('summary.modules')}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/**
 * Where the picture actually goes. Almost everyone assumes a QR code is mostly
 * the thing it encodes; it is mostly machinery, and the payload proper — the
 * bytes a reader typed or a merchant registered — is a small minority of a
 * large grid. The bar reuses the anatomy palette, so it needs no legend of its
 * own: these are the same colours those roles wear in the matrix.
 */
function ModuleBudget() {
  const { build } = useStore();
  const { t } = useCopy();

  const parts = useMemo(() => {
    if (!build) return null;
    let fn = 0;
    let info = 0;
    let data = 0;
    let ecc = 0;
    let rest = 0;
    let payload = 0;
    for (const m of build.modules) {
      switch (m.role.kind) {
        case 'format':
        case 'version':
          info++;
          break;
        case 'data':
          data++;
          // A data codeword that resolves to no payload unit is header,
          // terminator or padding — structure wearing the data colour.
          if (build.resolver.codewordToUnits(m.role.codeword).length > 0) payload++;
          break;
        case 'ecc':
          ecc++;
          break;
        case 'remainder':
          rest++;
          break;
        default:
          fn++;
      }
    }
    const total = build.modules.length;
    return { fn, info, data, ecc, rest, payload, total };
  }, [build]);

  if (!parts) return null;

  const rows: Array<[string, number, string]> = [
    [t('summary.functionPatterns'), parts.fn, 'var(--role-finder)'],
    [t('summary.infoBits'), parts.info, 'var(--role-format)'],
    [t('role.data'), parts.data, 'var(--role-data)'],
    [t('role.ecc'), parts.ecc, 'var(--role-ecc)'],
    [t('role.remainder'), parts.rest, 'var(--role-remainder)'],
  ];
  const pct = (n: number) => ((n / parts.total) * 100).toFixed(1);

  return (
    <div className="budget">
      <p className="eyebrow">{t('summary.budget')}</p>
      <div className="budget__bar" role="presentation">
        {rows.map(([label, count, colour]) => (
          <span
            key={label}
            className="budget__segment"
            style={{ background: colour, width: `${(count / parts.total) * 100}%` }}
          />
        ))}
      </div>
      <dl className="budget__rows">
        {rows.map(([label, count, colour]) => (
          <div key={label} className="budget__row">
            <dt>
              <span className="budget__swatch" style={{ background: colour }} aria-hidden="true" />
              {label}
            </dt>
            <dd>{count} · {pct(count)}%</dd>
          </div>
        ))}
      </dl>
      <p className="label">
        {t('summary.budgetPayload', { count: parts.payload, percent: pct(parts.payload) })}
      </p>
    </div>
  );
}
