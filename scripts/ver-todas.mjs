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
const d = pg.locator('[role="dialog"]');
if (await d.count()) { const x = d.getByRole('button', { name: /cerrar|saltar|entendido|✕|×/i }).first(); if (await x.count()) { await x.click().catch(()=>{}); await pg.waitForTimeout(500); } }

await pg.goto('https://rr-content-hub.vercel.app/candilejas', { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(4000);
const codigos = await pg.locator('a[href*="/candilejas/ideas/"]').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
console.log('piezas en el tablero:', codigos.length);
await pg.screenshot({ path: '/tmp/tab-candilejas.png', fullPage: true });

// ir a cada ficha y medir portada + embed
for (const h of codigos) {
  await pg.goto('https://rr-content-hub.vercel.app' + h, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(11000);
  const cod = h.split('/').pop();
  const img = pg.locator('img[src*="supabase"]').first();
  const portada = (await img.count()) ? await img.evaluate((e) => e.naturalWidth + 'x' + e.naturalHeight) : 'NO';
  const fr = pg.locator('iframe[src*="instagram"]').first();
  let color = 'sin iframe';
  if (await fr.count()) {
    const f = '/tmp/e-' + cod + '.png';
    await fr.screenshot({ path: f });
    const b64 = fs.readFileSync(f).toString('base64');
    color = await pg.evaluate((b) => new Promise((r) => {
      const im = new Image();
      im.onload = () => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
        const x = c.getContext('2d'); x.drawImage(im,0,0); const p = x.getImageData(0,0,c.width,c.height).data;
        let col=0; const t=p.length/4;
        for (let i=0;i<p.length;i+=4) if (Math.max(p[i],p[i+1],p[i+2]) - Math.min(p[i],p[i+1],p[i+2]) > 18) col++;
        r((100*col/t).toFixed(1) + '%'); };
      im.src = 'data:image/png;base64,' + b; }), b64);
  }
  console.log('  ' + cod + '  portada: ' + String(portada).padEnd(9) + '  embed: ' + color);
}
await nav.close();