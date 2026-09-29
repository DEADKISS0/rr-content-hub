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
const saltar = pg.getByRole('button', { name: /^SALTAR$/i });
if (await saltar.count()) { await saltar.first().click().catch(()=>{}); await pg.waitForTimeout(800); }
await pg.goto('https://rr-content-hub.vercel.app/candilejas/ideas/' + process.argv[2], { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(2500);
const s2 = pg.getByRole('button', { name: /^SALTAR$/i });
if (await s2.count()) { await s2.first().click().catch(()=>{}); await pg.waitForTimeout(800); }
await pg.waitForTimeout(15000);
// solo la zona de arriba: portada + embed, sin la pagina entera
await pg.locator('h1').first().scrollIntoViewIfNeeded();
await pg.waitForTimeout(1000);
await pg.screenshot({ path: '/tmp/zone-' + process.argv[3] + '.png', clip: { x: 0, y: 0, width: 390, height: 844 } });
console.log('listo ' + process.argv[3]);
await nav.close();