import { useCopy } from '../copy';
import { useStore } from '../state/store';
import { Bitstream, type Grouping } from '../views/Bitstream/Bitstream';

/** Stages 2 and 3. The same ribbon, regrouped rather than rebuilt. */
export function EncodeStage({ grouping }: { grouping: Grouping }) {
  const { build } = useStore();
  const { t } = useCopy();
  if (!build) return null;

  const stage = grouping === 'bits' ? '2' : '3';

  return (
    <div className="stage">
      <h2 className="panel__heading">{t(`stage.${stage}.name` as 'stage.2.name')}</h2>
      <p className="gloss">{t('bitstream.gloss')}</p>
      <Bitstream grouping={grouping} />
    </div>
  );
}
