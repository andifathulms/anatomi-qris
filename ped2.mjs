import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport:{width:1440,height:1200} });
await p.goto('http://localhost:4173/anatomi-qris/',{waitUntil:'networkidle'});
await p.waitForTimeout(900);
for (const s of [4,5,6,7,8,9]) {
  await p.locator('.scrubber__station').nth(s-1).click();
  await p.waitForTimeout(600);
  console.log(`\n########## STAGE ${s} ##########`);
  // strip the big data wells so the prose is visible
  console.log(await p.evaluate(()=>{
    const panel=document.querySelector('.panel').cloneNode(true);
    panel.querySelectorAll('.scroll-well,.bitstream__ribbon,.division__steps,.interleave__grid,.mask-gallery__grid,.codeword-table').forEach(e=>e.remove());
    return panel.innerText.trim().replace(/\n{3,}/g,'\n\n').slice(0,1000);
  }));
}
await b.close();
