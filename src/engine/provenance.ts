import type { BitSpan, Segmentation } from './segments';
import type { EcLevel, Mode } from './tables';

export type ModuleRole =
  | { kind: 'finder'; corner: 'tl' | 'tr' | 'bl' }
  | { kind: 'separator' }
  | { kind: 'timing'; axis: 'row' | 'col' }
  | { kind: 'alignment'; index: number }
  | { kind: 'darkModule' }
  | { kind: 'format'; bit: number; copy: 0 | 1 }
  | { kind: 'version'; bit: number; copy: 0 | 1 }
  | { kind: 'data'; codeword: number; bit: number; block: number; streamIndex: number }
  | { kind: 'ecc'; codeword: number; bit: number; block: number; streamIndex: number }
  | { kind: 'remainder'; index: number };

export interface ModuleInfo {
  x: number;
  y: number;
  /** Final value after masking and after format/version are written. */
  value: boolean;
  /** Value before the mask was applied. Equal to `value` outside the data region. */
  preMask: boolean;
  masked: boolean;
  role: ModuleRole;
  placementOrder: number | null;
}

/** A key into `byCodeword`, e.g. "data:12" or "ecc:3". */
export type CodewordKey = string;

export function codewordKey(kind: 'data' | 'ecc', index: number): CodewordKey {
  return `${kind}:${index}`;
}

/** Group modules by the codeword they carry. Built once, read everywhere. */
export function buildByCodeword(
  modules: ModuleInfo[],
): Map<CodewordKey, Array<[number, number]>> {
  const map = new Map<CodewordKey, Array<[number, number]>>();
  for (const m of modules) {
    if (m.role.kind !== 'data' && m.role.kind !== 'ecc') continue;
    const key = codewordKey(m.role.kind, m.role.codeword);
    let list = map.get(key);
    if (!list) {
      list = [];
      map.set(key, list);
    }
    list.push([m.x, m.y]);
  }
  return map;
}

/** Stream index (position in the interleaved codeword stream) to module coords. */
export function buildByStreamIndex(modules: ModuleInfo[]): Map<number, Array<[number, number]>> {
  const map = new Map<number, Array<[number, number]>>();
  for (const m of modules) {
    if (m.role.kind !== 'data' && m.role.kind !== 'ecc') continue;
    const key = m.role.streamIndex;
    let list = map.get(key);
    if (!list) {
      list = [];
      map.set(key, list);
    }
    list.push([m.x, m.y]);
  }
  return map;
}

export interface SourceResolver {
  /** Payload unit (byte in byte mode, character otherwise) to data codewords. */
  unitToCodewords(unitIndex: number): number[];
  /** An inclusive-exclusive range of payload units to data codewords. */
  rangeToCodewords(start: number, end: number): number[];
  /** The bit span in the pre-codeword bitstream covering a payload unit. */
  unitToBitSpan(unitIndex: number): { start: number; length: number } | null;
  /**
   * The inverse of unitToCodewords: which payload units a data codeword
   * carries some part of. Empty for codewords holding only the mode header,
   * the terminator, or padding.
   */
  codewordToUnits(codeword: number): number[];
}

/**
 * Resolve payload positions to data codewords using the spans the encoder
 * recorded. Byte mode is one span per byte; alphanumeric packs two characters
 * into 11 bits and numeric packs three into 10, so a character there resolves
 * to its whole group. Nothing here recomputes the header width — it reads the
 * offsets the bitstream writer already produced.
 */
export function buildSourceResolver(seg: Segmentation): SourceResolver {
  const payloadSpans: BitSpan[] = seg.spans.filter((s) => s.kind === 'payload');
  const groupSize = seg.mode === 'numeric' ? 3 : seg.mode === 'alphanumeric' ? 2 : 1;

  const spanFor = (unitIndex: number): BitSpan | null => {
    if (unitIndex < 0) return null;
    const idx = Math.floor(unitIndex / groupSize);
    return payloadSpans[idx] ?? null;
  };

  const codewordsForBits = (start: number, length: number): number[] => {
    const first = Math.floor(start / 8);
    const last = Math.floor((start + length - 1) / 8);
    const out: number[] = [];
    for (let c = first; c <= last; c++) {
      if (c < seg.dataCodewords.length) out.push(c);
    }
    return out;
  };

  /*
   * The reverse index, built from the same spans the forward direction reads,
   * so the two cannot drift. A codeword straddles a unit boundary far more
   * often than not, so this is many-to-many in both directions.
   *
   * Built on first use rather than at encode time. Measured at 0.85 ms on a
   * version-11 symbol, which is a fifth of the 8 ms typing budget spent on
   * every keystroke for an index only the QRIS lens ever reads.
   */
  let unitsByCodeword: Map<number, number[]> | null = null;

  const reverseIndex = (): Map<number, number[]> => {
    if (unitsByCodeword) return unitsByCodeword;
    const map = new Map<number, number[]>();
    for (let group = 0; group < payloadSpans.length; group++) {
      const span = payloadSpans[group];
      for (const c of codewordsForBits(span.start, span.length)) {
        let list = map.get(c);
        if (!list) {
          list = [];
          map.set(c, list);
        }
        for (let k = 0; k < groupSize; k++) {
          const unit = group * groupSize + k;
          if (unit < seg.units.length) list.push(unit);
        }
      }
    }
    unitsByCodeword = map;
    return map;
  };

  return {
    unitToBitSpan(unitIndex) {
      const span = spanFor(unitIndex);
      return span ? { start: span.start, length: span.length } : null;
    },
    unitToCodewords(unitIndex) {
      const span = spanFor(unitIndex);
      return span ? codewordsForBits(span.start, span.length) : [];
    },
    codewordToUnits(codeword) {
      return reverseIndex().get(codeword) ?? [];
    },
    rangeToCodewords(start, end) {
      const seen = new Set<number>();
      for (let u = start; u < end; u++) {
        for (const c of this.unitToCodewords(u)) seen.add(c);
      }
      return [...seen].sort((a, b) => a - b);
    },
  };
}

export interface ProvenanceSummary {
  version: number;
  ecLevel: EcLevel;
  mode: Mode;
  dataCodewords: number;
  eccCodewords: number;
  blocks: number;
}
