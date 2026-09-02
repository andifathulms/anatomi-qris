import { useStore } from '../state/store';
import { InputStage } from './InputStage';
import { EncodeStage } from './EncodeStage';
import { CorrectionStage } from './CorrectionStage';
import { InterleaveStage } from './InterleaveStage';
import { MaskStage } from './MaskStage';
import { FinalStage } from './FinalStage';
import { PlaceStage } from './PlaceStage';
import { DamageStage } from './DamageStage';
import './stages.css';

/**
 * The stage panel: one component per pipeline stage, chosen by the scrubber.
 * The matrix does not live here — it stays where it is, and only this panel
 * changes.
 */
export function StagePanel() {
  const { state } = useStore();
  const stage = Math.round(state.stage);

  switch (stage) {
    case 2:
      return <EncodeStage grouping="bits" />;
    case 3:
      return <EncodeStage grouping="codewords" />;
    case 4:
      return <CorrectionStage />;
    case 5:
      return <InterleaveStage />;
    case 6:
      return <PlaceStage />;
    case 7:
      return <MaskStage />;
    case 8:
      return <FinalStage />;
    case 9:
      return <DamageStage />;
    default:
      return <InputStage />;
  }
}
