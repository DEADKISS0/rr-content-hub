import { chromium } from 'playwright';
const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 480, height: 800 }, locale: 'es-ES' });
const pg = await ctx.newPage();

// 1) el embed de Instagram, desde una pagina NUESTRA con iframe
await pg.setContent(`<body style="margin:0;background:#fff">
  <iframe id="f" src="https://www.instagram.com/reel/Dbs5ndARCKW/embed/"
    style="width:420px;height:520px;border:0" allow="autoplay; encrypted-media"></iframe>
</body>`);
await pg.waitForTimeout(6000);
const dentro = await pg.evaluate(() => {
  const f = document.getElementById('f');
  try { return (f.contentDocument.body.innerText || '').slice(0, 160); }
  catch (e) { return 'BLOQUEADO: ' + e.message; }
});
console.log('A) iframe desde pagina limpia  ->', JSON.stringify(dentro));
await pg.screenshot({ path: '/tmp/prueba-a.png' });

// 2) el MISMO iframe pero navigated directamentе a la URL de instagram
await pg.goto('https://www.instagram.com/reel/Dbs5ndARCKW/embed/', { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(5000);
const directa = await pg.evaluate(() => document.body.innerText.replace(/\n+/g,' | ').slice(0,160));
console.log('B) navegacion directa         ->', JSON.stringify(directa));
await pg.screenshot({ path: '/tmp/prueba-b.png' });
await nav.close();