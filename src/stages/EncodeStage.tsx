import { useCopy } from '../copy';
import { useStore } from '../state/store';
import { Bitstream, type Grouping } from '../views/Bitstream/Bitstream';
import { CITATIONS, Cite } from '../ui/Cite';

/** Stages 2 and 3. The same ribbon, regrouped rather than rebuilt. */
export function EncodeStage({ grouping }: { grouping: Grouping }) {
  const { build } = useStore();
  const { t } = useCopy();
  if (!build) return null;

  return (
    <div className="stage">
      <p className="gloss">
        {t('bitstream.gloss')}{' '}
        <Cite citation={grouping === 'bits' ? CITATIONS.mode : CITATIONS.padding} />
      </p>
      <Bitstream grouping={grouping} />
    </div>
  );
}
