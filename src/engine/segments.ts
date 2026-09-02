import {
  MAX_VERSION,
  MIN_VERSION,
  MODE_INDICATOR,
  alphanumericValue,
  charCountBits,
  dataCodewordCount,
  type EcLevel,
  type Mode,
} from './tables';

/**
 * A labelled run of bits in the pre-codeword bitstream. The Bitstream view
 * renders these; the byte-to-codeword map in provenance.ts reads the payload
 * span's offset from here rather than recomputing the header width.
 */
export interface BitSpan {
  kind: 'mode' | 'count' | 'payload' | 'terminator' | 'padBits' | 'padBytes';
  start: number;
  length: number;
  label: string;
  /** For payload spans: index of the source character or byte. */
  sourceIndex?: number;
}

export interface Segmentation {
  mode: Mode;
  version: number;
  ecLevel: EcLevel;
  /** The payload as the mode encodes it: UTF-8 bytes, or characters. */
  units: number[];
  /** Packed pre-codeword bits, MSB first. */
  bits: Uint8Array;
  bitLength: number;
  spans: BitSpan[];
  /** Bit offset at which the payload proper begins. */
  payloadBitOffset: number;
  dataCodewords: Uint8Array;
}

const PAD_BYTES = [0xec, 0x11];

/** Pure UTF-8 encoder — the engine may not reach for TextEncoder or the DOM. */
export function utf8Bytes(text: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < text.length; i++) {
    let code = text.codePointAt(i)!;
    if (code > 0xffff) i++;
    if (code < 0x80) {
      out.push(code);
    } else if (code < 0x800) {
      out.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      out.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }
  return out;
}

export function isNumeric(text: string): boolean {
  return text.length > 0 && /^[0-9]+$/.test(text);
}

export function isAlphanumeric(text: string): boolean {
  if (text.length === 0) return false;
  for (const ch of text) if (alphanumericValue(ch) < 0) return false;
  return true;
}

/** The narrowest mode that can carry the whole string. No mixed segments in v1. */
export function chooseMode(text: string): Mode {
  if (isNumeric(text)) return 'numeric';
  if (isAlphanumeric(text)) return 'alphanumeric';
  return 'byte';
}

/** Bits the payload occupies, excluding mode indicator and count. */
export function payloadBits(text: string, mode: Mode): number {
  if (mode === 'numeric') {
    const groups = Math.floor(text.length / 3);
    const rest = text.length % 3;
    return groups * 10 + (rest === 2 ? 7 : rest === 1 ? 4 : 0);
  }
  if (mode === 'alphanumeric') {
    return Math.floor(text.length / 2) * 11 + (text.length % 2) * 6;
  }
  return utf8Bytes(text).length * 8;
}

/** Character count as the count indicator expresses it. */
export function characterCount(text: string, mode: Mode): number {
  return mode === 'byte' ? utf8Bytes(text).length : text.length;
}

export function chooseVersion(
  text: string,
  mode: Mode,
  ecLevel: EcLevel,
  minVersion = MIN_VERSION,
): number {
  const version = versionFor(text, mode, ecLevel, minVersion);
  if (version === null) {
    throw new Error(
      `input of ${text.length} characters does not fit in version ${MAX_VERSION} at level ${ecLevel}`,
    );
  }
  return version;
}

/**
 * The lowest version that can carry this input, or null if it does not fit at
 * all. QRIS payloads run 150-350 characters, so the longer ones genuinely do
 * not fit at level H within versions 1-15; the UI has to say so rather than
 * throw.
 */
export function versionFor(
  text: string,
  mode: Mode,
  ecLevel: EcLevel,
  minVersion = MIN_VERSION,
): number | null {
  const body = payloadBits(text, mode);
  for (let v = Math.max(MIN_VERSION, minVersion); v <= MAX_VERSION; v++) {
    if (4 + charCountBits(v, mode) + body <= dataCodewordCount(v, ecLevel) * 8) return v;
  }
  return null;
}

export function canEncode(text: string, ecLevel: EcLevel, minVersion = MIN_VERSION): boolean {
  return versionFor(text, chooseMode(text), ecLevel, minVersion) !== null;
}

class BitWriter {
  private bytes: number[] = [];
  length = 0;

  push(value: number, width: number): void {
    for (let i = width - 1; i >= 0; i--) {
      const bit = (value >>> i) & 1;
      const byteIndex = this.length >> 3;
      if (byteIndex === this.bytes.length) this.bytes.push(0);
      if (bit) this.bytes[byteIndex] |= 0x80 >>> (this.length & 7);
      this.length++;
    }
  }

  toUint8Array(): Uint8Array {
    return Uint8Array.from(this.bytes);
  }
}

/**
 * Assemble the full data bitstream: mode indicator, character count, payload,
 * terminator, bit padding to the byte boundary, then alternating pad bytes.
 * Every run is recorded as a BitSpan as it is written, so the view and the
 * bitstream are the same object.
 */
export function buildSegmentation(
  text: string,
  mode: Mode,
  version: number,
  ecLevel: EcLevel,
): Segmentation {
  const w = new BitWriter();
  const spans: BitSpan[] = [];
  const countWidth = charCountBits(version, mode);
  const count = characterCount(text, mode);

  spans.push({ kind: 'mode', start: 0, length: 4, label: `mode ${mode}` });
  w.push(MODE_INDICATOR[mode], 4);

  spans.push({ kind: 'count', start: w.length, length: countWidth, label: `count ${count}` });
  w.push(count, countWidth);

  const payloadBitOffset = w.length;
  const units: number[] = [];

  if (mode === 'numeric') {
    for (let i = 0; i < text.length; i += 3) {
      const chunk = text.slice(i, i + 3);
      const width = chunk.length === 3 ? 10 : chunk.length === 2 ? 7 : 4;
      spans.push({
        kind: 'payload',
        start: w.length,
        length: width,
        label: chunk,
        sourceIndex: i,
      });
      w.push(Number(chunk), width);
      for (const ch of chunk) units.push(Number(ch));
    }
  } else if (mode === 'alphanumeric') {
    for (let i = 0; i < text.length; i += 2) {
      const chunk = text.slice(i, i + 2);
      const a = alphanumericValue(chunk[0]);
      if (chunk.length === 2) {
        const b = alphanumericValue(chunk[1]);
        spans.push({
          kind: 'payload', start: w.length, length: 11, label: chunk, sourceIndex: i,
        });
        w.push(a * 45 + b, 11);
        units.push(a, b);
      } else {
        spans.push({
          kind: 'payload', start: w.length, length: 6, label: chunk, sourceIndex: i,
        });
        w.push(a, 6);
        units.push(a);
      }
    }
  } else {
    const bytes = utf8Bytes(text);
    for (let i = 0; i < bytes.length; i++) {
      spans.push({
        kind: 'payload',
        start: w.length,
        length: 8,
        label: text[i] ?? '',
        sourceIndex: i,
      });
      w.push(bytes[i], 8);
      units.push(bytes[i]);
    }
  }

  const capacityBits = dataCodewordCount(version, ecLevel) * 8;
  const terminator = Math.min(4, capacityBits - w.length);
  if (terminator > 0) {
    spans.push({ kind: 'terminator', start: w.length, length: terminator, label: 'terminator' });
    w.push(0, terminator);
  }

  const toByteBoundary = (8 - (w.length % 8)) % 8;
  if (toByteBoundary > 0) {
    spans.push({
      kind: 'padBits', start: w.length, length: toByteBoundary, label: 'pad to byte',
    });
    w.push(0, toByteBoundary);
  }

  let padIndex = 0;
  while (w.length < capacityBits) {
    const pad = PAD_BYTES[padIndex % 2];
    spans.push({
      kind: 'padBytes',
      start: w.length,
      length: 8,
      label: pad === 0xec ? '11101100' : '00010001',
    });
    w.push(pad, 8);
    padIndex++;
  }

  const bits = w.toUint8Array();
  const dataCodewords = new Uint8Array(capacityBits / 8);
  dataCodewords.set(bits.subarray(0, dataCodewords.length));

  return {
    mode,
    version,
    ecLevel,
    units,
    bits,
    bitLength: w.length,
    spans,
    payloadBitOffset,
    dataCodewords,
  };
}
