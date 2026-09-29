import { chromium } from 'playwright';
const nav = await chromium.launch();

// La ficha real mide 200px de ancho. En la pagina limpia de antes era 420.
// ¿Instagram necesita un minimo de ancho para pintar? Eso SI lo hace el embed.
for (const w of [200, 240, 320, 400, 420, 540]) {
  const ctx = await nav.newContext({ viewport: { width: w + 40, height: 520 }, locale: 'es-ES' });
  const pg = await ctx.newPage();
  await pg.setContent(`<body style="margin:0;background:#070001">
    <iframe src="https://www.instagram.com/reel/Dbs5ndARCKW/embed/" style="width:${w}px;height:340px;border:0"></iframe></body>`);
  await pg.waitForTimeout(6500);
  await pg.locator('iframe').screenshot({ path: '/tmp/w-' + w + '.png' });
  const b = (await import('node:fs')).default.readFileSync('/tmp/w-' + w + '.png').toString('base64');
  const pct = await pg.evaluate((b64) => new Promise((done) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const x = c.getContext('2d'); x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height).data;
      let color = 0; const t = d.length / 4;
      for (let i = 0; i < d.length; i += 4) if (Math.max(d[i],d[i+1],d[i+2]) - Math.min(d[i],d[i+1],d[i+2]) > 18) color++;
      done((100 * color / t).toFixed(1));
    };
    img.src = 'data:image/png;base64,' + b64;
  }), b);
  console.log('ancho', String(w).padStart(3), '-> color:', pct + '%');
  await ctx.close();
}
await nav.close();