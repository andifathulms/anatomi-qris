export type EcLevel = 'L' | 'M' | 'Q' | 'H';
export type Mode = 'numeric' | 'alphanumeric' | 'byte';

export const EC_LEVELS: EcLevel[] = ['L', 'M', 'Q', 'H'];

/** Versions 1–15 only. See PRD §3: QRIS payloads land well under version 15. */
export const MIN_VERSION = 1;
export const MAX_VERSION = 15;

/** Two-bit EC indicator as it appears in the format information. */
export const EC_INDICATOR: Record<EcLevel, number> = { L: 1, M: 0, Q: 3, H: 2 };

export const MODE_INDICATOR: Record<Mode, number> = {
  numeric: 0b0001,
  alphanumeric: 0b0010,
  byte: 0b0100,
};

export interface BlockSpec {
  /** EC codewords per block. Every block in a version/EC pair has the same count. */
  eccPerBlock: number;
  group1Blocks: number;
  group1DataCodewords: number;
  group2Blocks: number;
  group2DataCodewords: number;
}

/**
 * The one table that genuinely has to be transcribed (CLAUDE.md §8.2).
 * Rows are versions 1–15; each holds L, M, Q, H as
 * [eccPerBlock, g1Blocks, g1Data, g2Blocks, g2Data].
 * The oracle test catches any transcription error immediately.
 */
const RS_BLOCKS: Record<EcLevel, ReadonlyArray<readonly number[]>> = {
  L: [
    [7, 1, 19, 0, 0], [10, 1, 34, 0, 0], [15, 1, 55, 0, 0], [20, 1, 80, 0, 0],
    [26, 1, 108, 0, 0], [18, 2, 68, 0, 0], [20, 2, 78, 0, 0], [24, 2, 97, 0, 0],
    [30, 2, 116, 0, 0], [18, 2, 68, 2, 69], [20, 4, 81, 0, 0], [24, 2, 92, 2, 93],
    [26, 4, 107, 0, 0], [30, 3, 115, 1, 116], [22, 5, 87, 1, 88],
  ],
  M: [
    [10, 1, 16, 0, 0], [16, 1, 28, 0, 0], [26, 1, 44, 0, 0], [18, 2, 32, 0, 0],
    [24, 2, 43, 0, 0], [16, 4, 27, 0, 0], [18, 4, 31, 0, 0], [22, 2, 38, 2, 39],
    [22, 3, 36, 2, 37], [26, 4, 43, 1, 44], [30, 1, 50, 4, 51], [22, 6, 36, 2, 37],
    [22, 8, 37, 1, 38], [24, 4, 40, 5, 41], [24, 5, 41, 5, 42],
  ],
  Q: [
    [13, 1, 13, 0, 0], [22, 1, 22, 0, 0], [18, 2, 17, 0, 0], [26, 2, 24, 0, 0],
    [18, 2, 15, 2, 16], [24, 4, 19, 0, 0], [18, 2, 14, 4, 15], [22, 4, 18, 2, 19],
    [20, 4, 16, 4, 17], [24, 6, 19, 2, 20], [28, 4, 22, 4, 23], [26, 4, 20, 6, 21],
    [24, 8, 20, 4, 21], [20, 11, 16, 5, 17], [30, 5, 24, 7, 25],
  ],
  H: [
    [17, 1, 9, 0, 0], [28, 1, 16, 0, 0], [22, 2, 13, 0, 0], [16, 4, 9, 0, 0],
    [22, 2, 11, 2, 12], [28, 4, 15, 0, 0], [26, 4, 13, 1, 14], [26, 4, 14, 2, 15],
    [24, 4, 12, 4, 13], [28, 6, 15, 2, 16], [24, 3, 12, 8, 13], [28, 7, 14, 4, 15],
    [22, 12, 11, 4, 12], [24, 11, 12, 5, 13], [24, 11, 12, 7, 13],
  ],
};

export function blockSpec(version: number, ec: EcLevel): BlockSpec {
  assertVersion(version);
  const row = RS_BLOCKS[ec][version - 1];
  return {
    eccPerBlock: row[0],
    group1Blocks: row[1],
    group1DataCodewords: row[2],
    group2Blocks: row[3],
    group2DataCodewords: row[4],
  };
}

export function matrixSize(version: number): number {
  return 4 * version + 17;
}

export function assertVersion(version: number): void {
  if (!Number.isInteger(version) || version < MIN_VERSION || version > MAX_VERSION) {
    throw new Error(`version ${version} is outside the supported range 1–${MAX_VERSION}`);
  }
}

/** Data codewords available at this version and EC level. */
export function dataCodewordCount(version: number, ec: EcLevel): number {
  const s = blockSpec(version, ec);
  return s.group1Blocks * s.group1DataCodewords + s.group2Blocks * s.group2DataCodewords;
}

export function blockCount(version: number, ec: EcLevel): number {
  const s = blockSpec(version, ec);
  return s.group1Blocks + s.group2Blocks;
}

export function eccCodewordCount(version: number, ec: EcLevel): number {
  const s = blockSpec(version, ec);
  return s.eccPerBlock * blockCount(version, ec);
}

export function totalCodewords(version: number, ec: EcLevel): number {
  return dataCodewordCount(version, ec) + eccCodewordCount(version, ec);
}

/**
 * Remainder bits: data-region bits left over after the last whole codeword.
 * ISO/IEC 18004 Table 1. Zero for versions 1 and 7–13 in our range.
 */
export function remainderBits(version: number): number {
  assertVersion(version);
  if (version === 1) return 0;
  if (version <= 6) return 7;
  if (version <= 13) return 0;
  return 3;
}

/**
 * Alignment pattern centres, computed rather than transcribed.
 * Version 1 has none; otherwise floor(v/7)+2 coordinates, first at 6, last at
 * size-7, the rest evenly spaced on an even step.
 */
export function alignmentCentres(version: number): number[] {
  assertVersion(version);
  if (version === 1) return [];
  const count = Math.floor(version / 7) + 2;
  const size = matrixSize(version);
  const last = size - 7;
  const step = Math.ceil((last - 6) / (count - 1) / 2) * 2;
  const out: number[] = [6];
  for (let i = count - 2; i >= 0; i--) out.push(last - i * step);
  return out;
}

/** Character count indicator width, ISO/IEC 18004 Table 3, versions 1–15. */
export function charCountBits(version: number, mode: Mode): number {
  assertVersion(version);
  const small = version <= 9;
  if (mode === 'numeric') return small ? 10 : 12;
  if (mode === 'alphanumeric') return small ? 9 : 11;
  return small ? 8 : 16;
}

/*
 * BCH codes. Format information is BCH(15,5); version information is
 * BCH(18,6). Both are computed — copying 68 literal bit strings is exactly the
 * kind of transcription CLAUDE.md §8.2 rules out.
 */

export const FORMAT_GENERATOR = 0b101_0011_0111; // x^10 + x^8 + x^5 + x^4 + x^2 + x + 1
export const FORMAT_XOR = 0b101_0100_0001_0010;
const VERSION_GENERATOR = 0b1_1111_0010_0101; // x^12 + x^11 + … + x^2 + 1

export function bchRemainder(value: number, generator: number, degree: number): number {
  let rest = value;
  const genBits = bitLength(generator);
  for (let i = bitLength(rest); i > degree; i--) {
    if (rest & (1 << (i - 1))) rest ^= generator << (i - genBits);
  }
  return rest;
}

function bitLength(n: number): number {
  let len = 0;
  while (n >>> len) len++;
  return len;
}

/** The 15-bit format information for an EC level and mask, already XOR-masked. */
export function formatInfo(ec: EcLevel, mask: number): number {
  const data = (EC_INDICATOR[ec] << 3) | mask;
  const rest = bchRemainder(data << 10, FORMAT_GENERATOR, 10);
  return ((data << 10) | rest) ^ FORMAT_XOR;
}

/** The 18-bit version information. Only versions 7 and up carry it. */
export function versionInfo(version: number): number {
  assertVersion(version);
  const rest = bchRemainder(version << 12, VERSION_GENERATOR, 12);
  return (version << 12) | rest;
}

export function hasVersionInfo(version: number): boolean {
  return version >= 7;
}

export const ALPHANUMERIC_CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

export function alphanumericValue(ch: string): number {
  return ALPHANUMERIC_CHARSET.indexOf(ch);
}
