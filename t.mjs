import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
await p.goto('http://localhost:4173/anatomi-qris/', { waitUntil: 'networkidle' });
await p.waitForTimeout(700);
await p.locator('.scrubber__station').nth(7).click();   // stage 8, finished code
await p.waitForTimeout(700);
const svg = await p.locator('.matrix__svg').boundingBox();
// Sweep a horizontal line across the data region and collect what the readout says.
const seen = new Map();
for (let i = 0; i < 60; i++) {
  const x = svg.x + svg.width * (0.15 + 0.7 * (i / 59));
  const y = svg.y + svg.height * 0.62;
  await p.mouse.move(x, y);
  await p.waitForTimeout(25);
  const row = await p.evaluate(() => {
    const el = document.querySelector('.readout__field dd');
    return el ? el.textContent.trim() : '(no field row)';
  });
  seen.set(row, (seen.get(row) || 0) + 1);
}
console.log('distinct payload fields named while sweeping one row of the matrix:');
for (const [k, v] of [...seen].sort((a,b)=>b[1]-a[1])) console.log(`  ${String(v).padStart(3)}x  ${k}`);
await b.close();
