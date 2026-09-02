import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { id, type CopyKey } from '../src/copy/id';
import { en } from '../src/copy/en';
import { translator } from '../src/copy';

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const SOURCE = walk('src')
  .filter((p) => !p.startsWith('src/copy/'))
  .map((p) => readFileSync(p, 'utf8'))
  .join('\n');

const KEYS = Object.keys(id) as CopyKey[];

describe('copy', () => {
  it('has an English string for every Indonesian one, and no extras', () => {
    expect(Object.keys(en).sort()).toEqual(KEYS.slice().sort());
  });

  it('uses every key it defines', () => {
    // Dead copy drifts out of date silently, and a missing key shows as the
    // key itself in the interface.
    const unused = KEYS.filter((key) => {
      if (SOURCE.includes(`'${key}'`)) return false;
      // Some keys are reached by template literal rather than by name, e.g.
      // `mode.${build.mode}` and `stage.${n}.name`. Count the template as a
      // use of every key under that prefix.
      const head = key.split('.')[0];
      if (SOURCE.includes(`\`${head}.\${`)) return false;
      if (/^stage\.\d\.(name|intro)$/.test(key) && SOURCE.includes('stage.${')) return false;
      return true;
    });
    expect(unused).toEqual([]);
  });

  it('keeps the register: sentence case, no exclamation marks, no all-caps', () => {
    for (const dict of [id, en]) {
      for (const [key, text] of Object.entries(dict)) {
        expect(text.includes('!'), `${key} has an exclamation mark`).toBe(false);
        for (const word of text.split(/\s+/)) {
          const letters = word.replace(/[^A-Za-z]/g, '');
          if (letters.length < 3) continue;
          // Acronyms and terms of art are allowed; running words are not.
          const allowed = ['QRIS', 'CRC', 'ISO', 'IEC', 'EMVCo', 'MCC', 'TLV', 'GF'];
          if (allowed.some((a) => word.includes(a))) continue;
          expect(letters === letters.toUpperCase(), `${key} shouts "${word}"`).toBe(false);
        }
      }
    }
  });

  it('interpolates the variables each template names', () => {
    const t = translator('id');
    expect(t('tlv.crcDetail', { found: '6304ABCD', expected: '6304A13F' })).toBe(
      'Ditemukan 6304ABCD, seharusnya 6304A13F.',
    );
    expect(t('damage.failedDetail', { blocks: '0', capacity: 5 })).toContain('Blok 0');
    for (const [key, text] of Object.entries(id)) {
      const vars = [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
      const englishVars = [...en[key as CopyKey].matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
      expect(englishVars.sort(), `${key} placeholders differ between locales`).toEqual(
        vars.sort(),
      );
    }
  });

  it('falls back to Indonesian rather than showing a raw key', () => {
    const t = translator('en');
    expect(t('app.title')).toBe('Anatomi QRIS');
    expect(t('nonsense.key' as CopyKey)).toBe('nonsense.key');
  });
});
