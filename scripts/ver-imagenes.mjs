import { chromium } from 'playwright';
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
await pg.waitForTimeout(3000);
const d = pg.locator('[role="dialog"]');
if (await d.count()) { const x = d.getByRole('button', { name: /cerrar|saltar|entendido|✕|×/i }).first(); if (await x.count()) { await x.click().catch(()=>{}); await pg.waitForTimeout(500); } }
const iid = process.argv[2];
await pg.goto('https://rr-content-hub.vercel.app/candilejas/ideas/' + iid, { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(9000);
const imgs = await pg.locator('img').evaluateAll((ls) => ls.map((i) => ({
  src: (i.getAttribute('src')||'').slice(0, 76), w: i.naturalWidth, h: i.naturalHeight,
  vis: i.getBoundingClientRect().width > 0 })));
console.log('imagenes en la ficha:');
for (const i of imgs) console.log('  ' + (i.vis ? 'visible' : 'oculta ') + '  ' + i.w + 'x' + i.h + '  ' + i.src);
await pg.screenshot({ path: '/tmp/ficha-full.png', fullPage: true });
await nav.close();