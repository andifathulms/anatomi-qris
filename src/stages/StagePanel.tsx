import { useStore } from '../state/store';
import { InputStage } from './InputStage';
import { EncodeStage } from './EncodeStage';
import { PlaceStage } from './PlaceStage';
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
    case 6:
      return <PlaceStage />;
    default:
      return <InputStage />;
  }
}
