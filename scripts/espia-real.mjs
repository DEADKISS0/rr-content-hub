import { chromium } from 'playwright';
const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 420, height: 900 }, locale: 'es-ES' });
const pg = await ctx.newPage();
await pg.addInitScript(() => {
  window.__m = [];
  window.addEventListener('message', (e) => {
    try { window.__m.push({ o: e.origin, t: typeof e.data, v: typeof e.data === 'string' ? e.data.slice(0, 70) : JSON.stringify(e.data).slice(0, 70) }); } catch (err) {}
  });
});
await pg.goto('https://rr-content-hub.vercel.app/login', { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(1500);
await pg.getByRole('button', { name: /Escribir el c[oó]digo de CANDILEJAS/i }).click();
await pg.waitForTimeout(400);
await pg.getByRole('button', { name: /CONTINUAR/ }).click();
await pg.waitForTimeout(2000);
await pg.locator('select').first().selectOption({ index: 0 });
await pg.getByRole('button', { name: /ENTRAR/ }).click();
await pg.waitForTimeout(3000);
const s = pg.getByRole('button', { name: /^SALTAR$/i });
if (await s.count()) { await s.first().click().catch(()=>{}); await pg.waitForTimeout(700); }
await pg.goto('https://rr-content-hub.vercel.app/candilejas/ideas/' + process.argv[2], { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(18000);
const m = await pg.evaluate(() => window.__m || []);
console.log('mensajes vistos en la pagina REAL:', m.length);
for (const x of m.slice(0, 6)) console.log('  typeof =', String(x.t).padEnd(7), '|', x.v);
const estado = await pg.locator('iframe[data-estado]').first().getAttribute('data-estado').catch(() => 'no');
console.log('estado que muestra la UI:', estado);
await nav.close();