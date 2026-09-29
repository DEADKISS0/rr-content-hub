import { chromium } from 'playwright';
const nav = await chromium.launch();
for (const [nombre, ancho] of [['movil', 390], ['escritorio', 1280]]) {
  const ctx = await nav.newContext({ viewport: { width: ancho, height: 900 }, locale: 'es-ES',
    isMobile: ancho < 500, hasTouch: ancho < 500 });
  const pg = await ctx.newPage();
  await pg.goto('https://rr-content-hub.vercel.app/login', { waitUntil: 'domcontentloaded' });
  await pg.getByRole('button', { name: /Escribir el c[oó]digo de CANDILEJAS/i }).click();
  await pg.waitForTimeout(400);
  await pg.getByRole('button', { name: /CONTINUAR/ }).click();
  await pg.waitForTimeout(2000);
  await pg.locator('select').first().selectOption({ index: 0 });
  await pg.getByRole('button', { name: /ENTRAR/ }).click();
  await pg.waitForTimeout(3200);
  // CERRAR LA GUIA: es modal y bloquea
  const dlg = pg.locator('[role="dialog"]');
  if (await dlg.count()) {
    const x = dlg.getByRole('button', { name: /cerrar|saltar|entendido|✕|×/i }).first();
    if (await x.count()) { await x.click().catch(()=>{}); await pg.waitForTimeout(600); }
  }
  await pg.goto('https://rr-content-hub.vercel.app/candilejas/ideas/ca88d116-7ccb-4afc-a61f-1260846c2171', { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(12000);
  const n = await pg.locator('iframe[src*="instagram"]').count();
  console.log(nombre, '| iframes:', n);
  if (n) {
    const box = await pg.locator('iframe[src*="instagram"]').first().boundingBox();
    console.log('   box:', box.width + 'x' + box.height);
    await pg.locator('iframe[src*="instagram"]').first().screenshot({ path: '/tmp/m-' + nombre + '.png' });
    const b64 = (await import('node:fs')).default.readFileSync('/tmp/m-' + nombre + '.png').toString('base64');
    const pct = await pg.evaluate((b) => new Promise((d) => {
      const im = new Image();
      im.onload = () => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
        const x = c.getContext('2d'); x.drawImage(im,0,0); const px = x.getImageData(0,0,c.width,c.height).data;
        let col=0; const t=px.length/4;
        for (let i=0;i<px.length;i+=4) if (Math.max(px[i],px[i+1],px[i+2]) - Math.min(px[i],px[i+1],px[i+2]) > 18) col++;
        d((100*col/t).toFixed(1)); };
      im.src = 'data:image/png;base64,' + b; }), b64);
    console.log('   COLOR en el iframe:', pct + '%');
  } else {
    await pg.screenshot({ path: '/tmp/m-' + nombre + '-sin.png', fullPage: true });
  }
  await ctx.close();
}
await nav.close();