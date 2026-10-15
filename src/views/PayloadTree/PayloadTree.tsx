import { useMemo } from 'react';
import type { TlvNode } from '../../qris/tlv';
import { glossFor } from '../../qris/dictionary';
import { findNode } from '../../qris/detect';
import { useCopy } from '../../copy';
import { highlightFromCodewords, useActions, useStore } from '../../state/store';
import { CITATIONS, Cite } from '../../ui/Cite';
import './payload-tree.css';

/**
 * The QRIS payload, read back as a receipt.
 *
 * Indonesians already know how to read a struk, so the payload is laid out
 * as one: the merchant's name is the headline and each EMVCo tag is a line
 * item. Selecting a line resolves its character range to data codewords
 * through the provenance map and lights exactly the modules carrying those
 * bytes — field, bytes, codewords, modules, spelled out as a chain. That
 * mapping is the product (PRD §1); everything else here serves it.
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
   * The checksum is the one computed value you would otherwise take on faith.
   * Selecting it marks exactly the characters it covers — the range runs to
   * the end of "6304" and excludes only the four digits after it, which is
   * the part people get wrong by hand.
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
  const merchant = findNode(qris.nodes, '59');
  const city = findNode(qris.nodes, '60');
  const postal = findNode(qris.nodes, '61');
  const initiation = findNode(qris.nodes, '01');
  const selectedNode =
    selectedPath && selectedPath !== CRC_LABEL ? rows.find((n) => n.path === selectedPath) ?? null : null;

  return (
    <div className="tlv">
      <header className="tlv__head">
        <p className={qris.crcOk ? 'tlv__verdict' : 'tlv__verdict tlv__crc-bad'}>
          <span className="tlv__verdict-dot" aria-hidden="true">{qris.crcOk ? '✓' : '!'}</span>
          <span className="tlv__crc">
            <button
              type="button"
              className="tlv__crc-button"
              aria-pressed={crcSelected}
              onClick={selectCrc}
              title={t('tlv.crcCoversHint')}
            >
              {qris.crcOk ? t('tlv.crcOk') : t('tlv.crcBad')}
            </button>
          </span>
          <Cite citation={CITATIONS.crc} />
        </p>
        {!qris.crcOk && qris.expectedCrc && (
          <p className="tlv__crc-bad">
            {t('tlv.crcDetail', {
              found: `6304${qris.foundCrc}`,
              expected: `6304${qris.expectedCrc}`,
            })}
          </p>
        )}
        <h3 className="tlv__merchant">{merchant?.value || t('tlv.heading')}</h3>
        <p className="chips">
          {city && <span className="chip">{city.meaning ?? city.tag} <b>{city.value}</b></span>}
          {postal && <span className="chip">{postal.meaning ?? postal.tag} <b>{postal.value}</b></span>}
          {initiation && (
            <span className="chip">
              {glossFor(initiation.path, initiation.value) ?? initiation.meaning} <b>{initiation.value}</b>
            </span>
          )}
        </p>
      </header>

      <p className="gloss tlv__gloss-line">{t('tlv.gloss')} <Cite citation={CITATIONS.emvco} /></p>

      {qris.failedAt !== null && (
        <p className="tlv__crc-bad">
          {t('tlv.parseFailed', { at: qris.failedAt, reason: qris.failure ?? '' })}
        </p>
      )}

      {/* The chain: the whole product in four steps, read off the provenance
          map for whatever line is selected. */}
      {state.highlight && range && (
        <ol className="tlv__chain" aria-live="polite">
          <li className="tlv__link">
            <span className="tlv__link-dot">{selectedNode?.tag ?? 'CRC'}</span>
            <div>
              <b>{selectedNode?.meaning ?? t('tlv.crcOk')}</b>
              <span>
                {selectedNode
                  ? `${t('tlv.tag')} ${selectedNode.tag} · ${t('tlv.length')} ${selectedNode.length}`
                  : t('tlv.crcCoversHint')}
              </span>
            </div>
          </li>
          <li className="tlv__link">
            <span className="tlv__link-dot">B</span>
            <div>
              <b>{t('tlv.chainBytes', { n: range[1] - range[0] })}</b>
              <span>{t('tlv.position')} {range[0]}–{range[1]}</span>
              <code>{hexOf(state.input.slice(range[0], range[1]))}</code>
            </div>
          </li>
          <li className="tlv__link">
            <span className="tlv__link-dot">C</span>
            <div>
              <b>{t('tlv.chainCodewords', { n: state.highlight.codewords.length })}</b>
              <code>{t('tlv.codewords')} {state.highlight.codewords.join(', ') || '—'}</code>
            </div>
          </li>
          <li className="tlv__link">
            <span className="tlv__link-dot">M</span>
            <div>
              <b>{t('tlv.modulesHighlighted', { count: state.highlight.modules.length })}</b>
            </div>
          </li>
        </ol>
      )}
      {!state.highlight && <p className="tlv__hint label">{t('tlv.chainHint')}</p>}


      <ul className="tlv__list" aria-label={t('tlv.heading')}>
        {rows.map((node) => {
          const gloss = glossFor(node.path, node.value);
          const isSelected = selectedPath === node.path;
          const isTemplate = !!node.children && node.children.length > 0;
          return (
            <li
              key={node.path + node.start}
              className="tlv__row"
              data-selected={isSelected || undefined}
              data-depth={node.depth}
              data-template={isTemplate || undefined}
            >
              <button
                type="button"
                className="tlv__button"
                aria-pressed={isSelected}
                onClick={() => select(node)}
              >
                <span className="tlv__tag">{node.tag}</span>
                <span className="tlv__name">
                  {node.meaning ?? `${t('tlv.tag')} ${node.tag}`}
                  {gloss && <span className="tlv__gloss">{gloss}</span>}
                </span>
                <span className="tlv__value">
                  {isTemplate ? `${node.children!.length} ▾` : node.value}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

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
      </div>
    </div>
  );
}

/** Up to sixteen bytes in hex; an EMVCo payload is ASCII, so char = byte. */
function hexOf(text: string): string {
  const bytes = [...text.slice(0, 16)].map((c) =>
    c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0'),
  );
  return bytes.join(' ') + (text.length > 16 ? ' …' : '');
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
