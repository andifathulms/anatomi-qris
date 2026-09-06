import { useMemo } from 'react';
import { decode } from '../../engine/decode';
import { toGrid } from '../../engine/encode';
import { blockSpec } from '../../engine/tables';
import { useCopy } from '../../copy';
import { nodesCovering } from '../../qris/detect';
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
    // Data codewords carry payload; correction codewords carry none. Keeping
    // the block against each one is what separates "hit" from "lost" below.
    const hitDataCodewords = new Map<number, number>();
    for (const index of damage) {
      const role = build.modules[index]?.role;
      if (!role || (role.kind !== 'data' && role.kind !== 'ecc')) continue;
      corrupt.add(role.streamIndex);
      if (role.kind === 'data') hitDataCodewords.set(role.codeword, role.block);
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

    /*
     * Which payload units the damage touched, and which of them sit in a block
     * correction could not rescue. The difference between the two is the whole
     * point: a field that was hit and recovered is a demonstration, a field in
     * a failed block is actually gone, and the copy must never blur them.
     */
    const failedBlocks = new Set(result.failedBlocks);
    const hitUnits = new Set<number>();
    const lostUnits = new Set<number>();
    for (const [codeword, block] of hitDataCodewords) {
      for (const unit of build.resolver.codewordToUnits(codeword)) {
        hitUnits.add(unit);
        if (failedBlocks.has(block)) lostUnits.add(unit);
      }
    }

    return {
      modulesHit: damage.size,
      hitUnits,
      lostUnits,
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
  const { state, build, qris, lensActive } = useStore();
  const { setNoise, clearDamage, repair } = useActions();
  const { t } = useCopy();
  const report = useDamageReport();
  // The damage standing right now, brush and slider together. Repair needs it
  // to settle the slider's share rather than leave it to regenerate.
  const standing = useDamageSet();

  if (!build || !report) return null;

  const { result } = report;
  const clean = report.modulesHit === 0;
  const ratio = report.capacity === 0 ? 0 : Math.min(1, report.corruptCodewords / report.capacity);

  return (
    <div className="damage">
      <p className="label">{t('damage.hint')}</p>

      <div className="damage__slider">
        <label className="eyebrow" htmlFor="noise">{t('damage.noise')}</label>
        <input
          id="noise"
          type="range"
          min={0}
          max={0.5}
          step={0.002}
          value={state.noise}
          /* The raw value runs 0 to 0.5 and means nothing said aloud. The
             percentage is what the number beside it shows. */
          aria-valuetext={`${(state.noise * 100).toFixed(1)}%`}
          onChange={(event) => setNoise(Number(event.target.value))}
        />
        <span className="mono" aria-hidden="true">{(state.noise * 100).toFixed(1)}%</span>
      </div>

      <div className="stage__controls">
        <button
          type="button"
          className="button"
          onClick={() => repair([...report.repairedModules], [...standing])}
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
          <span className="eyebrow" id="capacity-label">{t('damage.capacityUsed')}</span>
          {/*
            The one number the payoff stage exists to deliver, and it used to
            change in silence. <output> is the native element for a calculated
            result and already maps to role="status", so it announces politely
            without an aria-live that would only repeat what the tag says.
          */}
          <output className="figure" htmlFor="noise" aria-labelledby="capacity-label">
            {report.corruptCodewords} / {report.capacity}
          </output>
        </div>
        <div className="damage__meter-track">
          <div
            className="damage__meter-fill"
            data-over={result.failed || undefined}
            style={{ width: `${ratio * 100}%` }}
          />
        </div>
      </div>

      {/*
        The two layers meeting at the moment of failure. Correction protects
        this merchant's name, not "data" in the abstract, and when it runs out
        something nameable is gone.
      */}
      {lensActive && qris && report.hitUnits.size > 0 && (
        <div className="damage__fields">
          <p className="eyebrow">{t('damage.fieldsHit')}</p>
          {/* One list, with the losses marked inside it. Two lists said the
              same names twice at heavy damage and buried the arithmetic. */}
          <p className="damage__field-list">
            {nodesCovering(qris.nodes, report.hitUnits).map((node, i, all) => {
              const lost = [...report.lostUnits].some(
                (u) => u >= node.start && u < node.end,
              );
              return (
                <span key={node.path + node.start}>
                  <span data-lost={lost || undefined}>
                    {node.meaning ?? `${t('tlv.tag')} ${node.tag}`}
                  </span>
                  {i < all.length - 1 ? <span className="damage__sep"> · </span> : ''}
                </span>
              );
            })}
          </p>
          <p className="label">
            {report.lostUnits.size > 0 ? t('damage.fieldsLostKey') : t('damage.fieldsHeld')}
          </p>
        </div>
      )}

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

      {/* The headline already says "no damage yet"; the detail line says what
          that means, or stays quiet until there is something to report. */}
      <p className={result.failed ? 'damage__failed' : 'gloss'} role="status">
        {clean
          ? t('damage.cleanDetail')
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
