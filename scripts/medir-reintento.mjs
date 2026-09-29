import { chromium } from 'playwright';
import fs from 'node:fs';
const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 420, height: 900 }, locale: 'es-ES' });
const pg = await ctx.newPage();
const medidas = async (n) => {
  const f = '/tmp/r' + n + '.png';
  await pg.locator('iframe[src*="instagram"]').first().screenshot({ path: f });
  const b64 = fs.readFileSync(f).toString('base64');
  return pg.evaluate((b) => new Promise((d) => {
    const im = new Image();
    im.onload = () => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
      const x = c.getContext('2d'); x.drawImage(im,0,0); const p = x.getImageData(0,0,c.width,c.height).data;
      let col=0; const t=p.length/4;
      for (let i=0;i<p.length;i+=4) if (Math.max(p[i],p[i+1],p[i+2]) - Math.min(p[i],p[i+1],p[i+2]) > 18) col++;
      d((100*col/t).toFixed(1)); };
    im.src = 'data:image/png;base64,' + b; }), b64);
};
await pg.goto('https://rr-content-hub.vercel.app/login', { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(1500);
await pg.getByRole('button', { name: /Escribir el c[oó]digo de CANDILEJAS/i }).click();
await pg.waitForTimeout(400);
await pg.getByRole('button', { name: /CONTINUAR/ }).click();
await pg.waitForTimeout(2000);
await pg.locator('select').first().selectOption({ index: 0 });
await pg.getByRole('button', { name: /ENTRAR/ }).click();
await pg.waitForTimeout(3200);
const d = pg.locator('[role="dialog"]');
if (await d.count()) { const x = d.getByRole('button', { name: /cerrar|saltar|entendido|✕|×/i }).first(); if (await x.count()) { await x.click().catch(()=>{}); await pg.waitForTimeout(500); } }

await pg.goto('https://rr-content-hub.vercel.app/candilejas/ideas/ca88d116-7ccb-4afc-a61f-1260846c2171', { waitUntil: 'domcontentloaded' });
// medir a intervalos: Instagram puede tardar y reintentar solo
for (let i = 1; i <= 6; i++) {
  await pg.waitForTimeout(5000);
  const pct = await medidas(i);
  console.log('  O1 a los ' + (i*5) + 's: ' + pct + '% de color');
  if (parseFloat(pct) > 10) break;
}
await nav.close();