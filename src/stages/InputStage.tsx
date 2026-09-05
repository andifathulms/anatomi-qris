import { useCopy } from '../copy';
import { useStore } from '../state/store';
import { blockSpec, dataCodewordCount } from '../engine/tables';

/**
 * Stage 1. The mode, version and correction level are not settings — they are
 * consequences of the text, and this panel shows the decision being made.
 */
export function InputStage() {
  const { build } = useStore();
  const { t } = useCopy();
  if (!build) return null;

  const spec = blockSpec(build.version, build.ecLevel);
  const blocks = spec.group1Blocks + spec.group2Blocks;
  const repairCapacity = blocks * Math.floor(spec.eccPerBlock / 2);

  /*
   * What the payload actually needs: mode indicator, character count and the
   * payload bits. Not build.bitLength, which is already padded out to fill the
   * version and would make this row say "needs 1728, holds 1728".
   */
  const neededBits = build.segmentation.spans
    .filter((span) => span.kind === 'mode' || span.kind === 'count' || span.kind === 'payload')
    .reduce((sum, span) => sum + span.length, 0);

  // What the next version down would have held, which is why it was not used.
  const previousCapacity =
    build.version > 1
      ? dataCodewordCount(build.version - 1, build.ecLevel) * 8
      : null;

  return (
    <div className="stage">
      <p className="gloss">{t('ec.gloss')}</p>

      <dl className="figures">
        <Figure label={t('summary.version')} value={String(build.version)} />
        <Figure label={t('summary.mode')} value={t(`mode.${build.mode}`)} />
        <Figure label={t('summary.ec')} value={build.ecLevel} />
        <Figure label={t('summary.mask')} value={String(build.chosenMask)} />
      </dl>

      <table className="data-table">
        <tbody>
          {/* The version is the one number on this panel that arrives as a
              verdict. This is the rule behind it: bits needed against what the
              version below holds and what this one holds. */}
          <tr>
            <th scope="row">{t('summary.fit')}</th>
            <td>
              {t('summary.fitDetail', {
                needed: neededBits,
                previous:
                  previousCapacity === null
                    ? t('summary.fitNoSmaller')
                    : `${t('summary.version')} ${build.version - 1} — ${previousCapacity}`,
                chosen: build.dataCodewords.length * 8,
              })}
            </td>
          </tr>
          <tr>
            <th scope="row">{t('summary.size')}</th>
            <td>{build.size} × {build.size} {t('summary.modules')}</td>
          </tr>
          <tr>
            <th scope="row">{t('summary.dataCodewords')}</th>
            <td>{build.dataCodewords.length}</td>
          </tr>
          <tr>
            <th scope="row">{t('summary.eccCodewords')}</th>
            <td>{build.eccCodewords.length}</td>
          </tr>
          <tr>
            <th scope="row">{t('summary.blocks')}</th>
            <td>{blocks}</td>
          </tr>
          <tr>
            <th scope="row">{t('summary.capacity')}</th>
            <td>{repairCapacity} {t('summary.codewords')}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="figures__item">
      <dt className="eyebrow">{label}</dt>
      <dd className="figure">{value}</dd>
    </div>
  );
}
