import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 1100 } });
await p.goto('http://localhost:4173/anatomi-qris/', { waitUntil: 'networkidle' });
await p.waitForTimeout(700);
await p.locator('.scrubber__station').nth(8).click();
await p.waitForTimeout(600);
const set = async (v) => {
  await p.locator('.damage__slider input').evaluate((el, val) => {
    const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    s.call(el, val); el.dispatchEvent(new Event('input', { bubbles: true }));
  }, v);
  await p.waitForTimeout(500);
  return p.evaluate(() => {
    const all = [...document.querySelectorAll('.damage__field-list span[data-lost], .damage__field-list span:not([data-lost])')];
    const lost = [...document.querySelectorAll('.damage__field-list [data-lost]')].map(e=>e.textContent);
    return {
      headline: document.querySelector('.damage__headline')?.textContent?.trim(),
      key: document.querySelector('.damage__fields .label')?.textContent?.trim(),
      lostCount: lost.length,
      lines: document.querySelector('.damage__field-list')?.getBoundingClientRect().height,
    };
  });
};
for (const v of ['0.01','0.03','0.08']) {
  const r = await set(v);
  console.log(`noise ${v}: ${r.headline} | lost fields: ${r.lostCount} | list height ${Math.round(r.lines)}px`);
  console.log(`   key: ${r.key}`);
}
await p.screenshot({ path: process.argv[2] + '/a2-one-list.png' });
await b.close();
