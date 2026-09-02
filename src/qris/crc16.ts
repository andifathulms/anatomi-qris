/**
 * CRC-16/CCITT-FALSE: polynomial 0x1021, initial value 0xFFFF, no input or
 * output reflection, no final XOR. This is the checksum EMVCo puts under
 * tag 63, computed over the whole payload including the "6304" header of the
 * tag itself.
 */
const POLYNOMIAL = 0x1021;
const INITIAL = 0xffff;

export function crc16(input: string): number {
  let crc = INITIAL;
  for (let i = 0; i < input.length; i++) {
    crc ^= (input.charCodeAt(i) & 0xff) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ POLYNOMIAL) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc & 0xffff;
}

export function crc16Hex(input: string): string {
  return crc16(input).toString(16).toUpperCase().padStart(4, '0');
}

export interface CrcCheck {
  ok: boolean;
  expected: string;
  found: string;
  /** Index in the raw payload where the four checksum characters start. */
  at: number;
}

/**
 * Validate tag 63. The checksum covers everything up to and including "6304",
 * so the last four characters are excluded from the computation and compared
 * against it.
 */
export function validateCrc(payload: string): CrcCheck {
  const marker = payload.lastIndexOf('6304');
  if (marker < 0 || marker + 8 !== payload.length) {
    return { ok: false, expected: '', found: '', at: -1 };
  }
  const body = payload.slice(0, marker + 4);
  const expected = crc16Hex(body);
  const found = payload.slice(marker + 4).toUpperCase();
  return { ok: expected === found, expected, found, at: marker + 4 };
}
