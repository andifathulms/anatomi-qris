import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

/**
 * PRD acceptance criterion 9: under 250 KB gzipped.
 *
 * Counted as what a browser actually downloads on first load — the JS, the
 * CSS, the HTML, and the woff2 faces. The .woff duplicates that @fontsource
 * ships alongside them are not fetched by any browser that supports woff2, so
 * they are excluded, and the check says so rather than quietly ignoring them.
 *
 * dist/brand is excluded on the same grounds: the touch icon is fetched only
 * when someone adds the app to a home screen, and the social card only by a
 * crawler that never runs the page. Neither is on the first-load path.
 *
 * robots.txt and sitemap.xml are excluded for the same reason: a crawler asks
 * for them and the page never does. Counting them would make the budget
 * discourage being findable, which is not what it is for.
 */
const LIMIT = 250 * 1024;
const DIST = 'dist';

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const CRAWLER_ONLY = ['robots.txt', 'sitemap.xml'];
const counted = walk(DIST).filter(
  (path) =>
    !path.endsWith('.woff') &&
    !path.startsWith(join(DIST, 'brand')) &&
    !CRAWLER_ONLY.some((name) => path === join(DIST, name)),
);
let total = 0;
const rows = [];

for (const path of counted) {
  const raw = readFileSync(path);
  // woff2 is already compressed; gzipping it again would understate nothing
  // but measure the wrong thing, so it is counted at its own size.
  const size = path.endsWith('.woff2') ? raw.length : gzipSync(raw).length;
  total += size;
  rows.push([path, size]);
}

rows.sort((a, b) => b[1] - a[1]);
for (const [path, size] of rows) {
  console.log(`${String(Math.round(size / 102.4) / 10).padStart(7)} kB  ${path}`);
}
console.log(`${String(Math.round(total / 102.4) / 10).padStart(7)} kB  total (limit ${LIMIT / 1024} kB)`);

if (total > LIMIT) {
  console.error(`Bundle is ${Math.round((total - LIMIT) / 1024)} kB over budget.`);
  process.exit(1);
}

/*
 * PRD §9.1: a user with devtools open must see an empty network tab after
 * load. Assert it on the built output, not just on the source, since a
 * dependency could introduce a request we never wrote.
 *
 * XML namespace URIs are declarations, not requests, and React's error-decoder
 * link only ever appears inside a thrown message.
 */
const ALLOWED_URLS = [
  /https?:\/\/www\.w3\.org\//g,
  /https?:\/\/reactjs\.org\/docs\/error-decoder/g,
  /https?:\/\/anatomi\.example\.id\//g,
  // The maker's mark in the footer. These are anchor targets a reader may
  // choose to follow; nothing here is loaded by the page.
  /https?:\/\/andifathulms\.github\.io\/en\//g,
  /https?:\/\/github\.com\/andifathulms/g,
  /https?:\/\/www\.linkedin\.com\/in\/andifathulmukminin\//g,
  /https?:\/\/www\.instagram\.com\/andifathulms\//g,
];

let failures = 0;
for (const path of counted.filter((p) => p.endsWith('.js'))) {
  const source = readFileSync(path, 'utf8');

  for (const api of ['XMLHttpRequest', 'sendBeacon', 'new WebSocket', 'EventSource']) {
    if (source.includes(api)) {
      console.error(`${path} references ${api}`);
      failures++;
    }
  }

  let stripped = source;
  for (const allowed of ALLOWED_URLS) stripped = stripped.replace(allowed, '');
  const remaining = stripped.match(/https?:\/\/[^"'`\s)]{4,}/g);
  if (remaining) {
    console.error(`${path} contains unexpected URLs: ${[...new Set(remaining)].join(', ')}`);
    failures++;
  }
}

if (failures > 0) {
  console.error('The no-network commitment is broken.');
  process.exit(1);
}
console.log('No network requests in the built bundle.');
