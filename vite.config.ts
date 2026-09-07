import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const SITE = 'https://andifathulms.github.io/anatomi-qris/';

/**
 * Read one string out of a copy file without importing it. The copy modules
 * are TypeScript with a typed key union, so a config file cannot require()
 * them; a regex over the source is enough for four literal strings and keeps
 * the copy files as the single source.
 */
function copy(locale: 'id' | 'en', key: string): string {
  const source = readFileSync(`src/copy/${locale}.ts`, 'utf8');
  const match = source.match(new RegExp(`'${key.replace('.', '\\.')}':\\s*'((?:[^'\\\\]|\\\\.)*)'`));
  if (!match) throw new Error(`copy key ${key} not found in ${locale}.ts`);
  return match[1].replace(/\\'/g, "'");
}

/**
 * The description, the share card and the no-script fallback all said things
 * that the copy files also said, in a second hand-maintained copy that was
 * free to drift. og:title even used a tagline PRODUCT.md marks non-binding
 * while the page used the descriptor. They are generated from the copy files
 * now, so a change to the page changes the metadata with it.
 */
function metadata(): Plugin {
  return {
    name: 'anatomi-metadata',
    transformIndexHtml(html) {
      const title = copy('id', 'app.title');
      const tagline = copy('id', 'app.tagline');
      const offline = copy('id', 'app.offlineNote');
      const description = `${tagline}. ${offline}`;
      const taglineEn = copy('en', 'app.tagline');

      const tags = [
        `<link rel="canonical" href="${SITE}" />`,
        `<link rel="alternate" hreflang="id" href="${SITE}" />`,
        `<link rel="alternate" hreflang="en" href="${SITE}?lang=en" />`,
        `<link rel="alternate" hreflang="x-default" href="${SITE}" />`,
        `<meta name="description" content="${description}" />`,
        `<meta property="og:type" content="website" />`,
        `<meta property="og:site_name" content="${title}" />`,
        `<meta property="og:locale" content="id_ID" />`,
        `<meta property="og:locale:alternate" content="en_US" />`,
        `<meta property="og:title" content="${title} — ${tagline}" />`,
        `<meta property="og:description" content="${description}" />`,
        `<meta property="og:url" content="${SITE}" />`,
        `<meta property="og:image" content="${SITE}brand/og.png" />`,
        `<meta property="og:image:width" content="1200" />`,
        `<meta property="og:image:height" content="630" />`,
        `<meta property="og:image:alt" content="${title} — ${tagline}" />`,
        `<meta name="twitter:card" content="summary_large_image" />`,
        `<title>${title} — ${tagline}</title>`,
      ].join('\n    ');

      // A crawler that does not run scripts, and a reader whose script fails,
      // currently receive an empty body. This is the smallest honest thing to
      // put there, and it is generated rather than written twice.
      const fallback =
        `<noscript><h1>${title}</h1><p>${tagline}.</p>` +
        `<p>${offline}</p><p lang="en">${taglineEn}.</p></noscript>`;

      return html
        .replace('<!--METADATA-->', tags)
        .replace('<!--NOSCRIPT-->', fallback);
    },
  };
}

// base is the repo path for GitHub Pages; override with BASE_PATH in CI.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/anatomi-qris/',
  plugins: [react(), metadata()],
  build: {
    target: 'es2022',
    cssCodeSplit: false,
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    environmentMatchGlobs: [['tests/**/*.test.tsx', 'jsdom']],
  },
});
