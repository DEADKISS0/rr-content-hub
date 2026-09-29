import { chromium } from 'playwright';
const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-ES' });  // MOVIL
const pg = await ctx.newPage();
await pg.goto('https://rr-content-hub.vercel.app/login', { waitUntil: 'networkidle' });
await pg.getByRole('button', { name: /Escribir el c[oó]digo de CANDILEJAS/i }).click();
await pg.waitForTimeout(400);
await pg.getByRole('button', { name: /CONTINUAR/ }).click();
await pg.waitForTimeout(2000);
await pg.locator('select').first().selectOption({ index: 0 });
await pg.getByRole('button', { name: /ENTRAR/ }).click();
await pg.waitForTimeout(3000);
const cerrar = pg.getByRole('button', { name: /cerrar|saltar|entendido/i });
if (await cerrar.count()) { await cerrar.first().click().catch(()=>{}); await pg.waitForTimeout(500); }

for (const [cod, iid] of [['O1','ca88d116-7ccb-4afc-a61f-1260846c2171'],['O3','(draft)']]) {
  if (iid === '(draft)') continue;
  await pg.goto('https://rr-content-hub.vercel.app/candilejas/ideas/' + iid, { waitUntil: 'networkidle' });
  await pg.waitForTimeout(9000);
  const box = await pg.locator('iframe[src*="instagram"]').first().boundingBox();
  await pg.locator('iframe[src*="instagram"]').first().screenshot({ path: '/tmp/movil-' + cod + '.png' });
  const b64 = (await import('node:fs')).default.readFileSync('/tmp/movil-' + cod + '.png').toString('base64');
  const pct = await pg.evaluate((b) => new Promise((done) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const x = c.getContext('2d'); x.drawImage(img, 0, 0);
      const d = x.getImageData(0,0,c.width,c.height).data;
      let color = 0; const t = d.length/4;
      for (let i=0;i<d.length;i+=4) if (Math.max(d[i],d[i+1],d[i+2]) - Math.min(d[i],d[i+1],d[i+2]) > 18) color++;
      done((100*color/t).toFixed(1));
    };
    img.src = 'data:image/png;base64,' + b;
  }), b64);
  console.log(cod, 'box:', box.width + 'x' + box.height, '| color en el iframe:', pct + '%');
  // el texto de dentro, via el embed de instagram
  const dentro = await pg.evaluate(() => {
    const f = document.querySelector('iframe[src*="instagram"]');
    return f ? (f.getAttribute('src')) : 'no hay';
  });
  console.log('   src:', dentro.slice(0, 80));
}
await nav.close();