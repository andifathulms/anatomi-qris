import { useMemo } from 'react';
import { decode } from '../../engine/decode';
import { toGrid } from '../../engine/encode';
import { blockSpec } from '../../engine/tables';
import { useCopy } from '../../copy';
import { useActions, useDamageSet, useStore } from '../../state/store';
import './damage-lab.css';

/**
 * The damage lab. Everything here reads the provenance map: which modules were
 * hit resolves straight to which codewords are corrupt, with no second
 * geometry calculation anywhere.
 */
export function useDamageReport() {
  const { build } = useStore();
  const damage = useDamageSet();

  return useMemo(() => {
    if (!build) return null;
    const spec = blockSpec(build.version, build.ecLevel);
    const perBlock = Math.floor(spec.eccPerBlock / 2);
    const capacity = build.blocks.length * perBlock;

    // Damaged modules to corrupt codewords, through the roles recorded at
    // placement. Nothing recomputes geometry.
    const corruptByBlock = new Map<number, Set<number>>();
    const corrupt = new Set<number>();
    for (const index of damage) {
      const role = build.modules[index]?.role;
      if (!role || (role.kind !== 'data' && role.kind !== 'ecc')) continue;
      corrupt.add(role.streamIndex);
      let set = corruptByBlock.get(role.block);
      if (!set) {
        set = new Set();
        corruptByBlock.set(role.block, set);
      }
      set.add(role.streamIndex);
    }

    const grid = toGrid(build);
    for (const index of damage) {
      const y = Math.floor(index / build.size);
      const x = index % build.size;
      grid[y][x] = !grid[y][x];
    }

    const result = decode(grid, build.version, build.ecLevel, build.chosenMask);

    const repairedModules = new Set<number>();
    for (const streamIndex of result.errorPositions) {
      for (const [x, y] of build.byStreamIndex.get(streamIndex) ?? []) {
        repairedModules.add(y * build.size + x);
      }
    }

    return {
      modulesHit: damage.size,
      corruptCodewords: corrupt.size,
      capacity,
      perBlock,
      used: Math.min(capacity, corrupt.size),
      result,
      repairedModules,
      overBudgetBlocks: [...corruptByBlock.entries()]
        .filter(([, set]) => set.size > perBlock)
        .map(([block]) => block),
    };
  }, [build, damage]);
}

export function DamageLab() {
  const { state, build } = useStore();
  const { setNoise, clearDamage, repair } = useActions();
  const { t } = useCopy();
  const report = useDamageReport();

  if (!build || !report) return null;

  const { result } = report;
  const clean = report.modulesHit === 0;
  const ratio = report.capacity === 0 ? 0 : Math.min(1, report.corruptCodewords / report.capacity);

  return (
    <div className="damage">
      <p className="label">{t('damage.hint')}</p>

      <label className="damage__slider">
        <span className="eyebrow">{t('damage.noise')}</span>
        <input
          type="range"
          min={0}
          max={0.5}
          step={0.002}
          value={state.noise}
          onChange={(event) => setNoise(Number(event.target.value))}
        />
        <span className="mono">{(state.noise * 100).toFixed(1)}%</span>
      </label>

      <div className="stage__controls">
        <button
          type="button"
          className="button"
          onClick={() => repair([...report.repairedModules])}
          disabled={clean || result.failed}
        >
          {t('damage.repair')}
        </button>
        <button type="button" className="button" onClick={clearDamage} disabled={clean}>
          {t('damage.clear')}
        </button>
      </div>

      {/*
        The capacity meter is the one element in the app that should draw the
        eye. It fills as the user paints (DESIGN.md §5.6).
      */}
      <div className="damage__meter">
        <div className="damage__meter-head">
          <span className="eyebrow">{t('damage.capacityUsed')}</span>
          <span className="figure">
            {report.corruptCodewords} / {report.capacity}
          </span>
        </div>
        <div className="damage__meter-track">
          <div
            className="damage__meter-fill"
            data-over={result.failed || undefined}
            style={{ width: `${ratio * 100}%` }}
          />
        </div>
      </div>

      <table className="data-table">
        <tbody>
          <tr>
            <th scope="row">{t('damage.modulesHit')}</th>
            <td>{report.modulesHit}</td>
          </tr>
          <tr>
            <th scope="row">{t('damage.codewordsCorrupt')}</th>
            <td>{report.corruptCodewords}</td>
          </tr>
          <tr>
            <th scope="row">{t('damage.capacityLeft')}</th>
            <td>{Math.max(0, report.capacity - report.corruptCodewords)}</td>
          </tr>
          <tr>
            <th scope="row">{t('damage.syndromes')}</th>
            <td className="damage__positions">
              {result.syndromesByBlock
                .map((s, block) => `${block}: ${[...s].every((v) => v === 0) ? '0' : '≠0'}`)
                .join(' · ')}
            </td>
          </tr>
          <tr>
            <th scope="row">{t('damage.errorPositions')}</th>
            <td className="damage__positions">
              {result.errorPositions.length > 0 ? result.errorPositions.join(', ') : '—'}
            </td>
          </tr>
        </tbody>
      </table>

      <p className="damage__headline" data-failed={result.failed || undefined}>
        {clean ? t('damage.clean') : result.failed ? t('damage.failed') : t('damage.recovered')}
      </p>

      <p className={result.failed ? 'damage__failed' : 'gloss'} role="status">
        {clean
          ? t('damage.clean')
          : result.failed
            ? t('damage.failedDetail', {
                blocks: report.overBudgetBlocks.join(', ') || result.failedBlocks.join(', '),
                capacity: report.perBlock,
              })
            : t('damage.recoveredDetail', { count: result.corrected })}
      </p>
    </div>
  );
}
