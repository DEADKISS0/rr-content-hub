import { chromium } from 'playwright';
import fs from 'node:fs';
const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-ES', isMobile: true, hasTouch: true });
const pg = await ctx.newPage();
await pg.goto('https://rr-content-hub.vercel.app/login', { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(1500);
await pg.getByRole('button', { name: /Escribir el c[oó]digo de CANDILEJAS/i }).click();
await pg.waitForTimeout(400);
await pg.getByRole('button', { name: /CONTINUAR/ }).click();
await pg.waitForTimeout(2000);
await pg.locator('select').first().selectOption({ index: 0 });
await pg.getByRole('button', { name: /ENTRAR/ }).click();
await pg.waitForTimeout(3200);
const dlg = pg.locator('[role="dialog"]');
if (await dlg.count()) { const x = dlg.getByRole('button', { name: /cerrar|saltar|entendido|✕|×/i }).first(); if (await x.count()) { await x.click().catch(()=>{}); await pg.waitForTimeout(600); } }

for (const [cod, iid] of [['O1','ca88d116-7ccb-4afc-a61f-1260846c2171'], ['O2','fe54927d-b66e-45bf-ab98-af293a319e9c']]) {
  await pg.goto('https://rr-content-hub.vercel.app/candilejas/ideas/' + iid, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(13000);
  const n = await pg.locator('iframe[src*="instagram"]').count();
  if (!n) { console.log(cod, 'SIN IFRAME'); continue; }
  const src = await pg.locator('iframe[src*="instagram"]').first().getAttribute('src');
  const f = '/tmp/f-' + cod + '.png';
  await pg.locator('iframe[src*="instagram"]').first().screenshot({ path: f });
  const b64 = fs.readFileSync(f).toString('base64');
  const pct = await pg.evaluate((b) => new Promise((d) => {
    const im = new Image();
    im.onload = () => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
      const x = c.getContext('2d'); x.drawImage(im,0,0); const p = x.getImageData(0,0,c.width,c.height).data;
      let col=0; const t=p.length/4;
      for (let i=0;i<p.length;i+=4) if (Math.max(p[i],p[i+1],p[i+2]) - Math.min(p[i],p[i+1],p[i+2]) > 18) col++;
      d((100*col/t).toFixed(1)); };
    im.src = 'data:image/png;base64,' + b; }), b64);
  console.log(cod, '| src:', src.slice(0, 66), '| COLOR:', pct + '%');
  await pg.screenshot({ path: '/tmp/full-' + cod + '.png', fullPage: true });
}
await nav.close();