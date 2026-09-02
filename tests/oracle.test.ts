import { describe, it, expect } from 'vitest';
import QRCode, { type QRCodeMaskPattern } from 'qrcode';
import { createRequire } from 'module';
import { encode, toGrid } from '../src/engine/encode';
import { chooseMode, chooseVersion } from '../src/engine/segments';
import { EC_LEVELS, MAX_VERSION, dataCodewordCount, charCountBits } from '../src/engine/tables';
import { SAMPLES } from '../samples/index';

/**
 * `qrcode` accepts a single-mode segment list, which is how we stop it from
 * splitting the input into mixed segments we do not emit. Its own types insist
 * byte data is a buffer, so the segment list is cast at this one boundary.
 */
function segment(text: string, mode: string) {
  return [{ data: text, mode }] as unknown as Parameters<typeof QRCode.create>[0];
}

/**
 * The reference matrix, as `qrcode` builds it with our mode and mask forced.
 *
 * The mask is forced because the two implementations disagree on penalty rule
 * 4 and only on rule 4: `qrcode` rates the dark-module deviation with
 * `ceil(|pct - 50| / 5)`, while ISO/IEC 18004 Table 11 — and ZXing — use the
 * floor. At 51.7% dark the spec charges nothing and `qrcode` charges 10, which
 * is enough to change which mask wins. Our engine follows the spec, so instead
 * of agreeing on one mask we agree on all eight, which is a strictly stronger
 * claim about the construction. Mask *selection* is checked separately below.
 */
function oracleGrid(text: string, ec: 'L' | 'M' | 'Q' | 'H', mask: number) {
  const qr = QRCode.create(segment(text, chooseMode(text)), {
    errorCorrectionLevel: ec,
    maskPattern: mask as QRCodeMaskPattern,
  });
  const size = qr.modules.size;
  const grid: boolean[][] = [];
  for (let y = 0; y < size; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < size; x++) row.push(qr.modules.data[y * size + x] === 1);
    grid.push(row);
  }
  return { grid, version: qr.version, mask: qr.maskPattern, size };
}

function assertAgrees(text: string, ec: 'L' | 'M' | 'Q' | 'H') {
  for (let mask = 0; mask < 8; mask++) {
    const ours = encode(text, { ecLevel: ec, forceMask: mask });
    const ref = oracleGrid(text, ec, mask);
    const where = `${JSON.stringify(text.slice(0, 24))} @${ec} mask ${mask}`;
    expect(ours.version, `version for ${where}`).toBe(ref.version);
    expect(ours.size, `size for ${where}`).toBe(ref.size);
    const mine = toGrid(ours);
    for (let y = 0; y < ref.size; y++) {
      for (let x = 0; x < ref.size; x++) {
        if (mine[y][x] !== ref.grid[y][x]) {
          throw new Error(`module ${x},${y} differs for ${where} v${ref.version}`);
        }
      }
    }
  }
}

/** A string of `length` characters that will encode in `mode`. */
function stringOfMode(mode: 'numeric' | 'alphanumeric' | 'byte', length: number): string {
  if (mode === 'numeric') {
    return Array.from({ length }, (_, i) => String(i % 10)).join('');
  }
  if (mode === 'alphanumeric') {
    const set = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 $%*+-./:';
    return Array.from({ length }, (_, i) => set[i % set.length]).join('');
  }
  const set = 'abcdefghijklmnopqrstuvwxyz{}[]|~^`@#!?,;()_=';
  return Array.from({ length }, (_, i) => set[i % set.length]).join('');
}

/** The longest string of this mode that still fits in `version`. */
function capacityChars(version: number, ec: 'L' | 'M' | 'Q' | 'H', mode: 'numeric' | 'alphanumeric' | 'byte'): number {
  const bits = dataCodewordCount(version, ec) * 8 - 4 - charCountBits(version, mode);
  if (mode === 'numeric') {
    const whole = Math.floor(bits / 10) * 3;
    const rest = bits % 10;
    return whole + (rest >= 7 ? 2 : rest >= 4 ? 1 : 0);
  }
  if (mode === 'alphanumeric') {
    return Math.floor(bits / 11) * 2 + (bits % 11 >= 6 ? 1 : 0);
  }
  return Math.floor(bits / 8);
}

describe('oracle agreement with qrcode', () => {
  const MODES = ['numeric', 'alphanumeric', 'byte'] as const;

  it('matches on every bundled sample at every EC level', () => {
    for (const sample of SAMPLES) {
      for (const ec of EC_LEVELS) {
        const mode = chooseMode(sample.payload);
        if (chooseVersion(sample.payload, mode, ec) > MAX_VERSION) continue;
        assertAgrees(sample.payload, ec);
      }
    }
  });

  it('matches on every version boundary, both sides, all modes and levels', () => {
    for (let v = 1; v <= MAX_VERSION; v++) {
      for (const ec of EC_LEVELS) {
        for (const mode of MODES) {
          const max = capacityChars(v, ec, mode);
          if (max <= 0) continue;
          // Exactly full at v, and one character more, which must roll to v+1.
          assertAgrees(stringOfMode(mode, max), ec);
          if (v < MAX_VERSION) assertAgrees(stringOfMode(mode, max + 1), ec);
        }
      }
    }
  });

  it('matches on short and empty-adjacent inputs', () => {
    const inputs = ['0', '1', 'A', 'a', ' ', '00', 'AB', 'ab', '  ', '0A'];
    for (const text of inputs) {
      for (const ec of EC_LEVELS) assertAgrees(text, ec);
    }
  });

  it('matches on non-ASCII Indonesian text', () => {
    const inputs = [
      'Warung Ibu Éni',
      'Kopi — enak, murah, dekat',
      'Rp25.000 sekali seruput ☕',
      'Jalan Cikini Raya №5',
    ];
    for (const text of inputs) {
      for (const ec of EC_LEVELS) assertAgrees(text, ec);
    }
  });

  it('scores rules 1 to 3 identically to the reference on all eight masks', () => {
    const require = createRequire(import.meta.url);
    const penalties = require('qrcode/lib/core/mask-pattern.js');
    for (const sample of SAMPLES.slice(0, 4)) {
      for (const ec of EC_LEVELS) {
        for (let mask = 0; mask < 8; mask++) {
          const ours = encode(sample.payload, { ecLevel: ec, forceMask: mask });
          const ref = QRCode.create(segment(sample.payload, chooseMode(sample.payload)), {
            errorCorrectionLevel: ec,
            maskPattern: mask as QRCodeMaskPattern,
          });
          const score = ours.maskScores[mask];
          const where = `${sample.id} @${ec} mask ${mask}`;
          expect(score.rule1, `rule 1, ${where}`).toBe(penalties.getPenaltyN1(ref.modules));
          expect(score.rule2, `rule 2, ${where}`).toBe(penalties.getPenaltyN2(ref.modules));
          expect(score.rule3, `rule 3, ${where}`).toBe(penalties.getPenaltyN3(ref.modules));
        }
      }
    }
  });

  it('picks the lowest-penalty mask, ties going to the lower number', () => {
    for (const sample of SAMPLES) {
      for (const ec of EC_LEVELS) {
        const build = encode(sample.payload, { ecLevel: ec });
        const totals = build.maskScores.map((s) => s.total);
        const best = Math.min(...totals);
        expect(totals[build.chosenMask]).toBe(best);
        expect(build.chosenMask).toBe(totals.indexOf(best));
      }
    }
  });

  it('rates the dark-module deviation in whole 5% steps, as Table 11 states', () => {
    // Guards the one place we knowingly depart from `qrcode`.
    const build = encode('Anatomi QRIS', { ecLevel: 'M' });
    for (const score of build.maskScores) {
      const percent = score.darkRatio * 100;
      expect(score.rule4).toBe(Math.floor(Math.abs(percent - 50) / 5) * 10);
      expect(score.rule4 % 10).toBe(0);
    }
  });
});
