import { useMemo, useState } from 'react';
import { log } from '../../engine/gf256';
import { generatorPoly, rsEncode, type DivisionStep } from '../../engine/reed-solomon';
import { useCopy } from '../../copy';
import { useStore } from '../../state/store';
import { Toggle } from '../../ui/Toggle';
import './division.css';

type Notation = 'hex' | 'alpha';

/**
 * Polynomial long division over GF(256), stepped term by term.
 *
 * This view renders build.divisionTrace directly and never recomputes it, on
 * the same rule as the seat-award trace in Suara ke Kursi: the display and the
 * computation are the same object, so they cannot drift. Selecting a different
 * block produces that block's record from the encoder rather than a
 * re-enactment of it.
 *
 * Both notations are offered because the multiplication only makes sense in
 * exponent form and the XOR only makes sense in hex (DESIGN.md §5.3).
 */
export function Division() {
  const { build } = useStore();
  const { t } = useCopy();
  const [notation, setNotation] = useState<Notation>('hex');
  const [block, setBlock] = useState(0);
  const [visible, setVisible] = useState<number | null>(null);

  const trace = useMemo<DivisionStep[]>(() => {
    if (!build) return [];
    if (block === build.blockPlan.tracedBlock) return build.divisionTrace;
    const source = build.blocks[block];
    return rsEncode(source.data, build.blockPlan.eccPerBlock, true).trace;
  }, [build, block]);

  if (!build) return null;

  const generator = generatorPoly(build.blockPlan.eccPerBlock);
  const shown = visible === null ? trace.length : Math.min(trace.length, visible);

  return (
    <div className="division">
      <div className="division__controls">
        <Toggle<Notation>
          label={t('division.hex')}
          value={notation}
          onChange={setNotation}
          options={[
            { value: 'hex', label: t('division.hex') },
            { value: 'alpha', label: t('division.alpha') },
          ]}
        />
        {build.blocks.length > 1 && (
          <label className="division__block label">
            {t('division.block')}
            <select
              className="input-bar__select"
              value={block}
              onChange={(event) => {
                setBlock(Number(event.target.value));
                setVisible(null);
              }}
            >
              {build.blocks.map((b) => (
                <option key={b.index} value={b.index}>{b.index}</option>
              ))}
            </select>
          </label>
        )}
        <button
          type="button"
          className="button"
          onClick={() => setVisible((v) => Math.min(trace.length, (v ?? 0) + 1))}
        >
          {t('division.stepForward')}
        </button>
        <button type="button" className="button" onClick={() => setVisible(null)}>
          {t('interleave.reset')}
        </button>
      </div>

      <div className="division__generator">
        <span className="eyebrow">{t('division.generator')}</span>
        <Poly bytes={generator} notation={notation} />
      </div>

      <ol className="division__steps scroll-well">
        {trace.slice(0, shown).map((step) => (
          <li key={step.iteration} className="division__step">
            <div className="division__step-head">
              <span className="label">
                {t('division.step')} {step.iteration + 1}
              </span>
              <span className="label">
                {t('division.leadTerm')} <b>{format(step.leadTerm, notation)}</b>
              </span>
            </div>
            <Row
              label={t('division.before')}
              bytes={step.remainderBefore}
              notation={notation}
            />
            <Row
              label={t('division.multiple')}
              bytes={step.generatorMultiple.slice(1)}
              notation={notation}
            />
            <Row
              label={t('division.after')}
              bytes={step.remainderAfter}
              notation={notation}
              changedAgainst={step.remainderBefore}
            />
          </li>
        ))}
      </ol>

      {shown >= trace.length && <p className="gloss">{t('division.result')}</p>}
    </div>
  );
}

function Row({
  label,
  bytes,
  notation,
  changedAgainst,
}: {
  label: string;
  bytes: Uint8Array;
  notation: Notation;
  changedAgainst?: Uint8Array;
}) {
  return (
    <div className="division__row">
      <span className="label division__row-label">{label}</span>
      <Poly bytes={bytes} notation={notation} changedAgainst={changedAgainst} />
    </div>
  );
}

function Poly({
  bytes,
  notation,
  changedAgainst,
}: {
  bytes: Uint8Array;
  notation: Notation;
  changedAgainst?: Uint8Array;
}) {
  return (
    <span className="poly">
      {Array.from(bytes, (byte, i) => {
        // The register shifts by one each step, so compare like with like.
        const before = changedAgainst?.[i + 1];
        const changed = changedAgainst !== undefined && before !== byte;
        return (
          <span key={i} className="poly__term" data-changed={changed || undefined}>
            {format(byte, notation)}
          </span>
        );
      })}
    </span>
  );
}

function format(byte: number, notation: Notation): string {
  if (notation === 'hex') return byte.toString(16).toUpperCase().padStart(2, '0');
  if (byte === 0) return '0';
  return `α${superscript(log(byte))}`;
}

const SUPERSCRIPTS = '⁰¹²³⁴⁵⁶⁷⁸⁹';

function superscript(n: number): string {
  return String(n).split('').map((d) => SUPERSCRIPTS[Number(d)]).join('');
}
