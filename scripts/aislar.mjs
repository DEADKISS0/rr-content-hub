import { chromium } from 'playwright';
const nav = await chromium.launch();
const casos = [
  ['A-limpio', ''],
  ['B-con-referrer', '<meta name="referrer" content="origin-when-cross-origin">'],
  ['C-con-xfo', '<meta http-equiv="X-Frame-Options" content="DENY">'],
];
for (const [nombre, extra] of casos) {
  const ctx = await nav.newContext({ viewport: { width: 300, height: 420 }, locale: 'es-ES' });
  const pg = await ctx.newPage();
  await pg.setContent(`<body style="margin:0">${extra}
    <iframe src="https://www.instagram.com/reel/Dbs5ndARCKW/embed/" style="width:200px;height:340px;border:0"></iframe></body>`);
  await pg.waitForTimeout(6500);
  await pg.locator('iframe').screenshot({ path: '/tmp/iso-' + nombre + '.png' });
  console.log(nombre, 'capturado');
  await ctx.close();
}
await nav.close();