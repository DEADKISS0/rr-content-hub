import { chromium } from 'playwright';
import fs from 'node:fs';

const URL = 'https://rr-content-hub.vercel.app';
const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 420, height: 900 } });
const pg = await ctx.newPage();
const fallos = [];
pg.on('console', (m) => { if (m.type() === 'error') fallos.push(m.text().slice(0, 130)); });
pg.on('pageerror', (e) => fallos.push('PAGEERROR ' + String(e).slice(0, 130)));

// entrar
await pg.goto(URL + '/login', { waitUntil: 'networkidle' });
await pg.getByRole('button', { name: /Escribir el c[oó]digo de CANDILEJAS/i }).click();
await pg.waitForTimeout(500);
await pg.getByRole('button', { name: /CONTINUAR|BUSCANDO/ }).click();
await pg.waitForTimeout(2200);
await pg.locator('select').first().selectOption({ index: 0 });
await pg.getByRole('button', { name: /ENTRAR|ENTRANDO/ }).click();
await pg.waitForTimeout(3500);
const cerrar = pg.getByRole('button', { name: /cerrar|saltar|entendido|continuar/i });
if (await cerrar.count()) { await cerrar.first().click().catch(() => {}); await pg.waitForTimeout(600); }

const piezas = [
  ['O1', 'ca88d116-7ccb-4afc-a61f-1260846c2171'],
  ['O2', 'fe54927d-b66e-45bf-ab98-af293a319e9c'],
];

for (const [cod, iid] of piezas) {
  await pg.goto(URL + '/candilejas/ideas/' + iid, { waitUntil: 'networkidle' });
  await pg.waitForTimeout(7000);   // dar tiempo al embed de Meta
  const info = await pg.evaluate(() => {
    const f = document.querySelector('iframe[src*="instagram"]');
    if (!f) return { hay: false };
    const r = f.getBoundingClientRect();
    let texto = '';
    try { texto = (f.contentDocument?.body?.innerText || '').slice(0, 120); } catch (e) { texto = 'SIN ACCESO (cross-origin)'; }
    return { hay: true, w: Math.round(r.width), h: Math.round(r.height), src: f.src.slice(0, 70), texto };
  });
  console.log(`=== ${cod} ===`);
  console.log('  iframe:', info.hay ? `${info.w}x${info.h} ${info.src}` : 'NO HAY');
  console.log('  dentro:', info.texto || '(vacio)');
  // el texto de la pagina: dice que el enlace no existe?
  const t = await pg.locator('main').innerText();
  const roto = /incorrecto|se haya suprimido|broken|removed|no disponible/i.test(t);
  console.log('  pagina dice error de instagram:', roto);
  await pg.screenshot({ path: `/tmp/final-${cod}.png`, fullPage: true });
}
console.log('errores JS:', fallos.length ? fallos.slice(0, 3) : 'ninguno');
await nav.close();
