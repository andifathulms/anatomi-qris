import { deinterleave } from './blocks';
import { maskCondition } from './mask';
import {
  MatrixCanvas,
  drawFunctionPatterns,
  reserveInfoAreas,
} from './matrix';
import { rsDecode } from './reed-solomon';
import {
  ALPHANUMERIC_CHARSET,
  blockSpec,
  charCountBits,
  dataCodewordCount,
  type EcLevel,
  type Mode,
} from './tables';

export interface DecodeResult {
  bytes: Uint8Array;
  text: string;
  mode: Mode | null;
  /** Codewords repaired across all blocks. */
  corrected: number;
  /** Codewords repairable at this version and EC level. */
  capacity: number;
  failed: boolean;
  /** Indices into the interleaved stream that were repaired. */
  errorPositions: number[];
  /** Blocks that could not be corrected. */
  failedBlocks: number[];
  syndromesByBlock: Uint8Array[];
}

/** Which stream index and bit each data-region module carries, in walk order. */
export function readOrder(version: number): Array<[number, number]> {
  const canvas = new MatrixCanvas(version);
  drawFunctionPatterns(canvas);
  reserveInfoAreas(canvas);
  const size = canvas.size;
  const order: Array<[number, number]> = [];
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    const upward = ((right + 1) & 2) === 0;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const y = upward ? size - 1 - vert : vert;
        if (canvas.reserved[canvas.idx(x, y)]) continue;
        order.push([x, y]);
      }
    }
  }
  return order;
}

/**
 * Read a possibly damaged matrix back to bytes. The walk, the unmasking and
 * the deinterleave are the encoder's steps run backwards; only the Reed-Solomon
 * stage is new. `capacity` and `corrected` are what the damage lab's meter
 * reads, so they are returned even when the decode succeeds cleanly.
 */
export function decode(
  modules: boolean[][],
  version: number,
  ecLevel: EcLevel,
  mask: number,
): DecodeResult {
  const spec = blockSpec(version, ecLevel);
  const dataCount = dataCodewordCount(version, ecLevel);
  const totalCodewords = dataCount + spec.eccPerBlock * (spec.group1Blocks + spec.group2Blocks);

  const order = readOrder(version);
  const stream = new Uint8Array(totalCodewords);
  const bitCapacity = totalCodewords * 8;

  for (let i = 0; i < order.length && i < bitCapacity; i++) {
    const [x, y] = order[i];
    const raw = modules[y][x];
    const value = maskCondition(mask, x, y) ? !raw : raw;
    if (value) stream[i >> 3] |= 0x80 >>> (i & 7);
  }

  const { blocks } = deinterleave(stream, version, ecLevel);
  const capacity = blocks.length * Math.floor(spec.eccPerBlock / 2);

  const dataLengths = blocks.map((b) => b.length - spec.eccPerBlock);
  const repaired: Uint8Array[] = [];
  const failedBlocks: number[] = [];
  const syndromesByBlock: Uint8Array[] = [];
  let corrected = 0;
  const errorPositions: number[] = [];

  for (let b = 0; b < blocks.length; b++) {
    const result = rsDecode(blocks[b], spec.eccPerBlock);
    syndromesByBlock.push(result.syndromes);
    if (result.failed) {
      failedBlocks.push(b);
      repaired.push(blocks[b]);
      continue;
    }
    corrected += result.errorPositions.length;
    repaired.push(result.corrected);
    for (const pos of result.errorPositions) {
      errorPositions.push(streamIndexOf(b, pos, dataLengths));
    }
  }

  const dataCodewords = new Uint8Array(dataCount);
  let at = 0;
  for (let b = 0; b < repaired.length; b++) {
    dataCodewords.set(repaired[b].subarray(0, dataLengths[b]), at);
    at += dataLengths[b];
  }

  const failed = failedBlocks.length > 0;
  const parsed = failed
    ? { bytes: new Uint8Array(0), text: '', mode: null as Mode | null }
    : readBitstream(dataCodewords, version);

  return {
    bytes: parsed.bytes,
    text: parsed.text,
    mode: parsed.mode,
    corrected,
    capacity,
    failed,
    errorPositions: errorPositions.sort((a, b) => a - b),
    failedBlocks,
    syndromesByBlock,
  };
}

/** Where a block-local codeword sits in the interleaved stream. */
function streamIndexOf(
  block: number,
  position: number,
  dataLengths: number[],
): number {
  const blockCount = dataLengths.length;
  const maxData = Math.max(...dataLengths);
  if (position < dataLengths[block]) {
    let index = 0;
    for (let col = 0; col < maxData; col++) {
      for (let b = 0; b < blockCount; b++) {
        if (col >= dataLengths[b]) continue;
        if (b === block && col === position) return index;
        index++;
      }
    }
    return -1;
  }
  const eccOffset = position - dataLengths[block];
  const dataTotal = dataLengths.reduce((a, b) => a + b, 0);
  return dataTotal + eccOffset * blockCount + block;
}

class BitReader {
  private at = 0;
  constructor(private readonly bytes: Uint8Array) {}
  get remaining(): number {
    return this.bytes.length * 8 - this.at;
  }
  read(width: number): number {
    let value = 0;
    for (let i = 0; i < width; i++) {
      const bit = (this.bytes[this.at >> 3] >>> (7 - (this.at & 7))) & 1;
      value = (value << 1) | bit;
      this.at++;
    }
    return value;
  }
}

/** Parse the data codewords back to a string. Single-segment, as we encode. */
export function readBitstream(
  dataCodewords: Uint8Array,
  version: number,
): { bytes: Uint8Array; text: string; mode: Mode | null } {
  const reader = new BitReader(dataCodewords);
  const indicator = reader.read(4);
  const mode: Mode | null =
    indicator === 0b0001 ? 'numeric'
      : indicator === 0b0010 ? 'alphanumeric'
        : indicator === 0b0100 ? 'byte'
          : null;
  if (!mode) return { bytes: new Uint8Array(0), text: '', mode: null };

  const count = reader.read(charCountBits(version, mode));

  if (mode === 'byte') {
    const bytes = new Uint8Array(count);
    for (let i = 0; i < count; i++) bytes[i] = reader.read(8);
    return { bytes, text: utf8Decode(bytes), mode };
  }

  if (mode === 'numeric') {
    let text = '';
    let left = count;
    while (left >= 3) {
      text += String(reader.read(10)).padStart(3, '0');
      left -= 3;
    }
    if (left === 2) text += String(reader.read(7)).padStart(2, '0');
    else if (left === 1) text += String(reader.read(4));
    return { bytes: asciiBytes(text), text, mode };
  }

  let text = '';
  let left = count;
  while (left >= 2) {
    const pair = reader.read(11);
    text += ALPHANUMERIC_CHARSET[Math.floor(pair / 45)] + ALPHANUMERIC_CHARSET[pair % 45];
    left -= 2;
  }
  if (left === 1) text += ALPHANUMERIC_CHARSET[reader.read(6)];
  return { bytes: asciiBytes(text), text, mode };
}

function asciiBytes(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i);
  return out;
}

/** Pure UTF-8 decode; the engine may not reach for TextDecoder. */
export function utf8Decode(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i];
    let code: number;
    let width: number;
    if (b < 0x80) { code = b; width = 1; }
    else if ((b & 0xe0) === 0xc0) { code = b & 0x1f; width = 2; }
    else if ((b & 0xf0) === 0xe0) { code = b & 0x0f; width = 3; }
    else if ((b & 0xf8) === 0xf0) { code = b & 0x07; width = 4; }
    else { i++; continue; }
    if (i + width > bytes.length) break;
    for (let k = 1; k < width; k++) code = (code << 6) | (bytes[i + k] & 0x3f);
    out += String.fromCodePoint(code);
    i += width;
  }
  return out;
}
