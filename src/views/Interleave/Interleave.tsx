import { useEffect, useMemo, useRef, useState } from 'react';
import { useCopy } from '../../copy';
import { useStore } from '../../state/store';
import { duration, prefersReducedMotion } from '../../ui/useTimedValue';
import { toHex } from '../Bitstream/Bitstream';
import { blockTints } from './blockTint';
import './interleave.css';

/**
 * Data blocks as rows of a grid, with a read head sweeping down each column in
 * turn, lifting one byte from each block into the output stream below.
 *
 * The animation is the argument (PRD §7.4), so this view does not also explain
 * interleaving in a paragraph. The matrix beside it carries the same block
 * tints in place, which is where the point actually lands.
 */
export function Interleave() {
  const { build } = useStore();
  const { t } = useCopy();
  const [column, setColumn] = useState<number | null>(null);
  const frame = useRef(0);

  const tints = useMemo(() => (build ? blockTints(build.blocks.length) : null), [build]);
  const maxColumn = useMemo(() => {
    if (!build) return 0;
    return Math.max(...build.blocks.map((b) => b.data.length)) + build.blockPlan.eccPerBlock;
  }, [build]);

  useEffect(() => {
    if (column === null || column >= maxColumn) return;
    const per = duration('--dur-interleave-col', 90);
    if (per <= 0 || prefersReducedMotion()) {
      // Reduced motion: the sweep becomes a single state change.
      setColumn(maxColumn);
      return;
    }
    const started = performance.now();
    const from = column;
    const tick = (now: number) => {
      const next = from + Math.floor((now - started) / per);
      setColumn(Math.min(maxColumn, next));
      if (next < maxColumn) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [column, maxColumn]);

  if (!build || !tints) return null;

  const swept = column ?? maxColumn;
  const dealt = countDealt(build, swept);

  return (
    <div className="interleave">
      <div className="stage__controls">
        <button type="button" className="button" onClick={() => setColumn(0)}>
          {t('interleave.sweep')}
        </button>
        <button type="button" className="button" onClick={() => setColumn(null)}>
          {t('interleave.reset')}
        </button>
      </div>

      <div className="interleave__grid" role="table" aria-label={t('interleave.heading')}>
        {build.blocks.map((block) => (
          <div className="interleave__row" role="row" key={block.index}>
            <span className="interleave__row-label label" role="rowheader">
              {t('interleave.block')} {block.index}
            </span>
            <div className="interleave__cells">
              {Array.from(block.data, (byte, i) => (
                <span
                  key={`d${i}`}
                  className="interleave__cell"
                  data-lifted={i < swept || undefined}
                  style={{ background: tints.data[block.index] }}
                  role="cell"
                >
                  {toHex(byte)}
                </span>
              ))}
              {Array.from(block.ecc, (byte, i) => (
                <span
                  key={`e${i}`}
                  className="interleave__cell"
                  data-lifted={
                    i + Math.max(...build.blocks.map((b) => b.data.length)) < swept || undefined
                  }
                  style={{ background: tints.ecc[block.index] }}
                  role="cell"
                >
                  {toHex(byte)}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="interleave__output">
        <span className="label">{t('interleave.output')}</span>
        <div className="interleave__cells interleave__cells--output">
          {Array.from(build.interleaved.subarray(0, dealt), (byte, i) => {
            const source = build.blockPlan.sources[i];
            const ramp = source.kind === 'data' ? tints.data : tints.ecc;
            return (
              <span
                key={i}
                className="interleave__cell"
                style={{ background: ramp[source.block] }}
              >
                {toHex(byte)}
              </span>
            );
          })}
        </div>
        <p className="label">
          {dealt} / {build.interleaved.length} {t('summary.codewords')}
        </p>
      </div>
    </div>
  );
}

/** How many output codewords the sweep has produced after `columns` columns. */
function countDealt(
  build: ReturnType<typeof useStore>['build'],
  columns: number,
): number {
  if (!build) return 0;
  let count = 0;
  const maxData = Math.max(...build.blocks.map((b) => b.data.length));
  for (let col = 0; col < Math.min(columns, maxData); col++) {
    for (const block of build.blocks) if (col < block.data.length) count++;
  }
  for (let col = maxData; col < columns; col++) count += build.blocks.length;
  return Math.min(count, build.interleaved.length);
}
