import { useMemo } from 'react';
import type { Build } from '../../engine/encode';
import type { BitSpan } from '../../engine/segments';
import { useCopy, type CopyKey } from '../../copy';
import { highlightFromCodewords, useActions, useStore } from '../../state/store';
import './bitstream.css';

const KIND_LABEL: Record<BitSpan['kind'], CopyKey> = {
  mode: 'bitstream.mode',
  count: 'bitstream.count',
  payload: 'bitstream.payload',
  terminator: 'bitstream.terminator',
  padBits: 'bitstream.padBits',
  padBytes: 'bitstream.padBytes',
};

export type Grouping = 'bits' | 'codewords';

/**
 * A horizontal run of bit cells at the 8 px module grid, so a byte here is
 * visually the same width as a byte anywhere else in the app.
 *
 * The cells never remount between stages — they regroup — so a reader can
 * follow an individual bit across the transformation (DESIGN.md §5.2).
 * Binding to the matrix is instant and unanimated: this is a query, not a
 * transition.
 */
export function Bitstream({ grouping }: { grouping: Grouping }) {
  const { build, state } = useStore();
  const { setHighlight } = useActions();
  const { t } = useCopy();

  const bits = useMemo(() => (build ? unpack(build) : []), [build]);
  if (!build) return null;

  const selectCodeword = (codeword: number) => {
    setHighlight(
      highlightFromCodewords(build, [codeword], 'bits', `codeword ${codeword}`),
    );
  };

  const selected = new Set(state.highlight?.codewords ?? []);

  return (
    <div className="bitstream">
      <ol className="bitstream__legend">
        {dedupeKinds(build.segmentation.spans).map((kind) => (
          <li key={kind} className="bitstream__legend-item">
            <span className="bitstream__legend-swatch" data-kind={kind} aria-hidden="true" />
            {t(KIND_LABEL[kind])}
          </li>
        ))}
      </ol>

      <div className="bitstream__ribbon" data-grouping={grouping}>
        {chunk(bits, 8).map((group, codeword) => (
          <button
            key={codeword}
            type="button"
            className="bitstream__codeword"
            aria-pressed={selected.has(codeword)}
            title={`${codeword}: ${toHex(build.dataCodewords[codeword])}`}
            onClick={() => selectCodeword(codeword)}
          >
            {group.map((bit) => (
              <span key={bit.index} className="bitstream__bit" data-kind={bit.kind}>
                {bit.value ? '1' : '0'}
              </span>
            ))}
            {grouping === 'codewords' && (
              <span className="bitstream__hex">{toHex(build.dataCodewords[codeword])}</span>
            )}
          </button>
        ))}
      </div>

      <p className="label">
        {build.bitLength} {t('bitstream.bits')} · {build.dataCodewords.length}{' '}
        {t('summary.codewords')}
      </p>
    </div>
  );
}

interface BitCell {
  index: number;
  value: boolean;
  kind: BitSpan['kind'];
}

/**
 * Expand the packed bitstream into cells, each tagged with the span it belongs
 * to. The spans come from the encoder, so the ribbon's grouping is the
 * encoder's own record rather than a second reading of the bits.
 */
function unpack(build: Build): BitCell[] {
  const kinds = new Array<BitSpan['kind']>(build.dataCodewords.length * 8).fill('padBytes');
  for (const span of build.segmentation.spans) {
    for (let i = 0; i < span.length; i++) kinds[span.start + i] = span.kind;
  }
  const cells: BitCell[] = [];
  for (let i = 0; i < build.dataCodewords.length * 8; i++) {
    const byte = build.dataCodewords[i >> 3];
    cells.push({ index: i, value: ((byte >>> (7 - (i & 7))) & 1) === 1, kind: kinds[i] });
  }
  return cells;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function dedupeKinds(spans: BitSpan[]): BitSpan['kind'][] {
  const seen: BitSpan['kind'][] = [];
  for (const span of spans) if (!seen.includes(span.kind)) seen.push(span.kind);
  return seen;
}

export function toHex(byte: number): string {
  return byte.toString(16).toUpperCase().padStart(2, '0');
}
