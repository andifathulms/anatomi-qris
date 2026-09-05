import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 1100 } });
await p.goto('http://localhost:4173/anatomi-qris/', { waitUntil: 'networkidle' });
await p.waitForTimeout(700);
await p.locator('.scrubber__station').nth(7).click();
await p.waitForTimeout(500);
await p.locator('.tlv__crc-button').click();
await p.waitForTimeout(500);
const r = await p.evaluate(() => {
  const marked = document.querySelector('.tlv__mark');
  const raw = document.querySelector('.tlv__raw-string');
  const full = raw ? raw.textContent : '';
  const m = marked ? marked.textContent : '';
  return {
    payloadLength: full.length,
    markedLength: m.length,
    markedEndsWith: m.slice(-8),
    tailAfterMark: full.slice(m.length),
  };
});
console.log(JSON.stringify(r, null, 1));
console.log('\ncovers everything except the 4 checksum digits?',
  r.payloadLength - r.markedLength === 4 ? 'YES' : 'NO');
console.log('range ends with the 6304 header?', r.markedEndsWith.endsWith('6304') ? 'YES' : 'NO');
await b.close();
