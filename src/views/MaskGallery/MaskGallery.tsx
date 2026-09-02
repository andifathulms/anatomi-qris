import { useEffect, useMemo, useRef } from 'react';
import { collectPenaltyFeatures, type PenaltyRule } from '../../engine/mask';
import { useCopy, type CopyKey } from '../../copy';
import { useActions, useStore } from '../../state/store';
import './mask-gallery.css';

const RULE_SHORT: Record<PenaltyRule, CopyKey> = {
  1: 'mask.rule1Short',
  2: 'mask.rule2Short',
  3: 'mask.rule3Short',
  4: 'mask.rule4Short',
};

const RULE_FULL: Record<PenaltyRule, CopyKey> = {
  1: 'mask.rule1',
  2: 'mask.rule2',
  3: 'mask.rule3',
  4: 'mask.rule4',
};

/**
 * Eight candidate matrices as small multiples, each with its penalty broken
 * into the four rules. Nobody visualizes mask selection; this is one of the
 * app's two novel views (PRD §7.5).
 *
 * The winner carries a filled marker and nothing else — no trophy, no glow, no
 * colour change. The score is the argument.
 */
export function MaskGallery() {
  const { build, state } = useStore();
  const { setSelectedMask, setForceMask, toggleMaskFeatures } = useActions();
  const { t } = useCopy();

  if (!build) return null;
  const selected = state.selectedMask;

  return (
    <div className="mask-gallery">
      <div className="stage__controls">
        <button
          type="button"
          className="button"
          aria-pressed={state.forceMask === null}
          onClick={() => setForceMask(null)}
        >
          {t('mask.auto')}
        </button>
        {selected !== null && (
          <button
            type="button"
            className="button"
            aria-pressed={state.forceMask === selected}
            onClick={() => setForceMask(state.forceMask === selected ? null : selected)}
          >
            {t('mask.forced')} {selected}
          </button>
        )}
        <button
          type="button"
          className="button"
          aria-pressed={state.showMaskFeatures}
          onClick={toggleMaskFeatures}
        >
          {t('mask.showFeatures')}
        </button>
      </div>
      <p className="label">{t('mask.forceHint')}</p>

      <ol className="mask-gallery__rules">
        {([1, 2, 3, 4] as PenaltyRule[]).map((rule) => (
          <li key={rule} className="label">{t(RULE_FULL[rule])}</li>
        ))}
      </ol>

      <ul className="mask-gallery__grid">
        {build.maskScores.map((score) => {
          const isWinner = score.mask === build.chosenMask;
          return (
            <li key={score.mask}>
              <button
                type="button"
                className="mask-card"
                aria-pressed={selected === score.mask}
                onClick={() => setSelectedMask(selected === score.mask ? null : score.mask)}
              >
                <span className="mask-card__head">
                  <span className="mask-card__marker" data-filled={isWinner || undefined} />
                  <span>{score.mask}</span>
                  <span className="mask-card__total">
                    <span className="visually-hidden">{t('mask.total')} </span>
                    {score.total}
                  </span>
                </span>
                <MaskThumbnail grid={build.maskGrids[score.mask]} size={build.size} />
                <span className="mask-card__rules">
                  <Rule label={t(RULE_SHORT[1])} value={score.rule1} />
                  <Rule label={t(RULE_SHORT[2])} value={score.rule2} />
                  <Rule label={t(RULE_SHORT[3])} value={score.rule3} />
                  <Rule label={t(RULE_SHORT[4])} value={score.rule4} />
                  <span className="mask-card__balance">
                    <span className="label">{t('mask.dark')}</span>
                    <span
                      className="mask-card__bar"
                      style={{ '--ratio': score.darkRatio } as React.CSSProperties}
                    />
                    <span className="mono mask-card__ratio">{(score.darkRatio * 100).toFixed(1)}%</span>
                  </span>
                </span>
                {isWinner && <span className="visually-hidden">{t('mask.winner')}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Rule({ label, value }: { label: string; value: number }) {
  return (
    <span className="mask-card__rule">
      <span className="label">{label}</span>
      <b>{value}</b>
    </span>
  );
}

/**
 * Eight 77x77 matrices would be 47,000 rects. These are decorative thumbnails
 * of numbers already given as text on the same card, so they go to canvas and
 * the rest of the app stays SVG (CLAUDE.md §6).
 */
function MaskThumbnail({ grid, size }: { grid: Uint8Array; size: number }) {
  const canvas = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    el.width = size;
    el.height = size;
    const ctx = el.getContext('2d');
    if (!ctx) return;
    const image = ctx.createImageData(size, size);
    for (let i = 0; i < size * size; i++) {
      const value = grid[i] === 1 ? 0 : 255;
      image.data[i * 4] = value;
      image.data[i * 4 + 1] = value;
      image.data[i * 4 + 2] = value;
      image.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
  }, [grid, size]);

  return <canvas ref={canvas} className="mask-card__thumb" aria-hidden="true" />;
}

/** The modules a selected mask's penalty rules are objecting to. */
export function useOffences(): Set<number> {
  const { build, state } = useStore();
  return useMemo(() => {
    const out = new Set<number>();
    if (!build || state.selectedMask === null || !state.showMaskFeatures) return out;
    const features = collectPenaltyFeatures(build.maskGrids[state.selectedMask], build.size);
    for (const feature of features) {
      // Rule 4 has no geometry — it is a property of the whole symbol.
      if (feature.rule === 4) continue;
      for (const [x, y] of feature.cells) out.add(y * build.size + x);
    }
    return out;
  }, [build, state.selectedMask, state.showMaskFeatures]);
}
