import { useMemo } from 'react';
import type { TlvNode } from '../../qris/tlv';
import { glossFor } from '../../qris/dictionary';
import { useCopy } from '../../copy';
import { highlightFromCodewords, useActions, useStore } from '../../state/store';
import { CITATIONS, Cite } from '../../ui/Cite';
import './payload-tree.css';

/**
 * The QRIS payload as a tree, and the same payload as a string, at once.
 *
 * Selecting a node resolves its character range to data codewords through the
 * provenance map and lights exactly the modules carrying those bytes. That
 * mapping is the product (PRD §1); everything else here is in service of it.
 */
const CRC_LABEL = 'crc:covered';

export function PayloadTree() {
  const { build, qris, state } = useStore();
  const { setHighlight } = useActions();
  const { t } = useCopy();

  const selectedPath = state.highlight?.source === 'tlv' ? state.highlight.label : null;

  const select = (node: TlvNode) => {
    if (!build) return;
    if (selectedPath === node.path) {
      setHighlight(null);
      return;
    }
    const codewords = build.resolver.rangeToCodewords(node.start, node.end);
    setHighlight(
      highlightFromCodewords(build, codewords, 'tlv', node.path, [node.start, node.end]),
    );
  };

  /*
   * The checksum was the one computed value in the app you had to take on
   * faith: everything else is reachable in raw form, and this said "CRC
   * cocok" and stopped. Selecting it marks exactly the characters it covers
   * in the raw string below and lights their modules in the matrix — which
   * shows the part people get wrong by hand, that the range runs to the end
   * of "6304" and excludes only the four digits after it.
   */
  const crcRange: [number, number] | null =
    qris && qris.crcOk !== null && qris.expectedCrc ? [0, state.input.lastIndexOf('6304') + 4] : null;
  const crcSelected = state.highlight?.source === 'tlv' && state.highlight.label === CRC_LABEL;

  const selectCrc = () => {
    if (!build || !crcRange || crcRange[1] <= 3) return;
    if (crcSelected) {
      setHighlight(null);
      return;
    }
    const codewords = build.resolver.rangeToCodewords(crcRange[0], crcRange[1]);
    setHighlight(highlightFromCodewords(build, codewords, 'tlv', CRC_LABEL, crcRange));
  };

  const rows = useMemo(() => (qris ? flattenRows(qris.nodes) : []), [qris]);
  if (!qris || !qris.isQris) return null;

  const range = state.highlight?.charRange ?? null;

  return (
    <div className="tlv">
      <div className="tlv__head">
        <h3 className="subheading">{t('tlv.heading')}</h3>
        <p className={qris.crcOk ? 'label' : 'tlv__crc-bad'}>
          <button
            type="button"
            className="tlv__crc-button"
            aria-pressed={crcSelected}
            onClick={selectCrc}
            title={t('tlv.crcCoversHint')}
          >
            {qris.crcOk ? t('tlv.crcOk') : t('tlv.crcBad')}
          </button>{' '}
          <Cite citation={CITATIONS.crc} />
          {!qris.crcOk && qris.expectedCrc && (
            <>
              {' '}
              {t('tlv.crcDetail', {
                found: `6304${qris.foundCrc}`,
                expected: `6304${qris.expectedCrc}`,
              })}
            </>
          )}
        </p>
      </div>
      <p className="gloss">{t('tlv.gloss')} <Cite citation={CITATIONS.emvco} /></p>

      {qris.failedAt !== null && (
        <p className="tlv__crc-bad">
          {t('tlv.parseFailed', { at: qris.failedAt, reason: qris.failure ?? '' })}
        </p>
      )}

      <table className="tlv__table">
        <thead>
          <tr>
            <th scope="col">{t('tlv.tag')}</th>
            <th scope="col">{t('tlv.length')}</th>
            <th scope="col">{t('tlv.value')}</th>
            <th scope="col">{t('tlv.meaning')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((node) => {
            const gloss = glossFor(node.path, node.value);
            const isSelected = selectedPath === node.path;
            return (
              <tr
                key={node.path + node.start}
                className="tlv__row"
                data-selected={isSelected || undefined}
                onClick={() => select(node)}
              >
                <th scope="row" style={{ paddingLeft: `calc(${node.depth} * var(--unit))` }}>
                  <button
                    type="button"
                    className="tlv__button"
                    aria-pressed={isSelected}
                    onClick={() => select(node)}
                  >
                    {node.depth > 0 && <span className="tlv__connector" aria-hidden="true" />}
                    {node.tag}
                  </button>
                </th>
                <td>{String(node.length).padStart(2, '0')}</td>
                <td className="tlv__value">
                  {node.children && node.children.length > 0 ? '…' : node.value}
                </td>
                <td className="tlv__meaning">
                  {node.meaning ?? '—'}
                  {gloss && <span className="tlv__gloss"> · {gloss}</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="tlv__raw">
        <span className="eyebrow">{t('tlv.raw')}</span>
        <p className="tlv__raw-string">
          {range ? (
            <>
              <span>{state.input.slice(0, range[0])}</span>
              <mark className="tlv__mark">{state.input.slice(range[0], range[1])}</mark>
              <span>{state.input.slice(range[1])}</span>
            </>
          ) : (
            state.input
          )}
        </p>
        {state.highlight && (
          <p className="label">
            {t('tlv.position')} {range?.[0]}–{range?.[1]} ·{' '}
            {t('tlv.codewords')} {state.highlight.codewords.join(', ') || '—'} ·{' '}
            {t('tlv.modulesHighlighted', { count: state.highlight.modules.length })}
          </p>
        )}
      </div>
    </div>
  );
}

function flattenRows(nodes: TlvNode[]): TlvNode[] {
  const out: TlvNode[] = [];
  const walk = (list: TlvNode[]) => {
    for (const node of list) {
      out.push(node);
      if (node.children) walk(node.children);
    }
  };
  walk(nodes);
  return out;
}
