import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Strip comments, so a rule is never tripped by prose describing the rule. */
function code(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const SRC = walk('src');
const ENGINE = SRC.filter((p) => p.startsWith('src/engine'));
const MAKER_MARK = join('src', 'ui', 'MakerSignature.tsx');

/**
 * The four non-negotiables in CLAUDE.md, as tests. They are easy to breach by
 * accident in a later change and expensive to notice by eye.
 */
describe('non-negotiables', () => {
  it('ships no QR library in src', () => {
    for (const path of SRC) {
      const source = readFileSync(path, 'utf8');
      for (const forbidden of ["'qrcode'", "'qrcode-generator'", "'jsqr'", '"qrcode"', '"jsqr"']) {
        expect(source.includes(forbidden), `${path} imports ${forbidden}`).toBe(false);
      }
    }
  });

  it('lists qrcode and jsqr as devDependencies only', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(Object.keys(pkg.dependencies)).not.toContain('qrcode');
    expect(Object.keys(pkg.dependencies)).not.toContain('jsqr');
    expect(Object.keys(pkg.devDependencies)).toContain('qrcode');
    expect(Object.keys(pkg.devDependencies)).toContain('jsqr');
  });

  it('makes no network request anywhere in src', () => {
    for (const path of SRC) {
      const source = code(path);
      for (const forbidden of ['fetch(', 'XMLHttpRequest', 'navigator.sendBeacon', 'new WebSocket']) {
        expect(source.includes(forbidden), `${path} contains ${forbidden}`).toBe(false);
      }
      // Fonts are bundled from node_modules; nothing may point at a CDN. The
      // maker's mark is the one exception: its URLs are anchor targets a
      // reader may choose to follow, never something the page loads.
      if (path === MAKER_MARK) continue;
      expect(/https?:\/\/(?!anatomi\.example)/.test(source), `${path} has an external URL`).toBe(
        false,
      );
    }
  });

  it('keeps the engine pure', () => {
    for (const path of ENGINE) {
      const source = code(path);
      // No React, no DOM, no randomness, no clock.
      for (const forbidden of [
        'react',
        'document.',
        'window.',
        'Math.random',
        'Date.now',
        'new Date',
        'performance.now',
        'TextEncoder',
        'TextDecoder',
      ]) {
        expect(source.includes(forbidden), `${path} uses ${forbidden}`).toBe(false);
      }
      // Its only imports are its own siblings.
      for (const match of source.matchAll(/from '([^']+)'/g)) {
        expect(match[1].startsWith('./'), `${path} imports ${match[1]}`).toBe(true);
      }
    }
  });

  it('offers no payload editing', () => {
    // PRD §9.2: the app explains, it does not forge. serialiseTlv exists so a
    // parse can be shown to round-trip in the tests; no view may reach for it,
    // and no view may write a payload back to the input.
    for (const path of SRC) {
      if (path === 'src/qris/tlv.ts') continue;
      expect(code(path).includes('serialiseTlv'), `${path} serialises TLV`).toBe(false);
    }
  });
});
