import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport:{width:1440,height:1200} });
await p.goto('http://localhost:4173/anatomi-qris/',{waitUntil:'networkidle'});
await p.waitForTimeout(900);
console.log('########## LANDING, before any interaction ##########');
console.log(await p.evaluate(()=>document.querySelector('.workbench__column').innerText.trim().slice(0,900)));
for (const s of [1,2,3,4,5,6,7,8,9]) {
  await p.locator('.scrubber__station').nth(s-1).click();
  await p.waitForTimeout(600);
  console.log(`\n########## STAGE ${s} ##########`);
  console.log(await p.evaluate(()=>document.querySelector('.panel').innerText.trim().slice(0,1100)));
}
await b.close();
