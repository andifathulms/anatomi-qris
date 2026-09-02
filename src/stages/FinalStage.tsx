import { useCopy } from '../copy';
import { useStore } from '../state/store';
import { formatInfo, hasVersionInfo, versionInfo } from '../engine/tables';
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
  const version = hasVersionInfo(build.version) ? versionInfo(build.version) : null;

  return (
    <div className="stage">
      <p className="gloss">{t('final.gloss')} <Cite citation={CITATIONS.format} /></p>

      <dl className="figures">
        <Figure label={t('summary.version')} value={String(build.version)} />
        <Figure label={t('summary.mask')} value={String(build.chosenMask)} />
        <Figure label={t('summary.ec')} value={build.ecLevel} />
      </dl>

      <table className="data-table">
        <tbody>
          <tr>
            <th scope="row">{t('role.format')}</th>
            <td className="mono-bits">{format.toString(2).padStart(15, '0')}</td>
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
