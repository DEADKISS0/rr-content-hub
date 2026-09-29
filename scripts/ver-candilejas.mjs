import { chromium } from 'playwright';
import fs from 'node:fs';

const URL = 'https://rr-content-hub.vercel.app';
const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 } });  // movil
const pg = await ctx.newPage();

// entrar a CANDILEJAS igual que una persona
await pg.goto(URL + '/login', { waitUntil: 'networkidle' });
await pg.getByRole('button', { name: /Escribir el c[oó]digo de CANDILEJAS/i }).click();
await pg.waitForTimeout(600);
await pg.getByRole('button', { name: /CONTINUAR|BUSCANDO/ }).click();
await pg.waitForTimeout(2200);
await pg.locator('select').first().selectOption({ index: 0 });
await pg.getByRole('button', { name: /ENTRAR|ENTRANDO/ }).click();
await pg.waitForTimeout(3500);
console.log('URL tras entrar:', pg.url().replace(URL, ''));
// cerrar la guia guiada si tapa algo
const cerrar = pg.getByRole('button', { name: /cerrar|saltar|entendido|continuar/i });
if (await cerrar.count()) { await cerrar.first().click().catch(() => {}); await pg.waitForTimeout(700); }

await pg.goto(URL + '/candilejas/ideas', { waitUntil: 'networkidle' });
await pg.waitForTimeout(1500);

const tarjetas = await pg.locator('[data-idea], article, li a[href*="/ideas/"]').count();
console.log('tarjetas/link de ideas visibles:', tarjetas);
// ¿estan en la API?
const api = await pg.evaluate(async () => {
  const r = await fetch('/api/workspace/pieza?ideaId=x', { credentials: 'same-origin' });
  return r.status;
});
console.log('api pieza:', api);
// listado crudo desde la pagina: buscar el codigo en TODO el html
const html = await pg.content();
for (const c of ['O1', 'O2', 'Lo que ves', 'bolsillo']) {
  console.log(`  html contiene "${c}":`, html.includes(c));
}
console.log('detalle de la vista: hay details cerrado?', await pg.locator('details').count(), 'details');
// las PORTADAS se ven en las tarjetas del banco
await pg.goto(URL + '/candilejas/ideas', { waitUntil: 'networkidle' });
await pg.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
await pg.waitForTimeout(800);
const imgs = await pg.locator('img').evaluateAll((e) => e.map((i) => ({ src: i.src.slice(0, 78), alt: i.alt.slice(0, 34), w: i.naturalWidth })));
console.log('--- imagenes en el banco de Candilejas ---');
for (const im of imgs) console.log('  ', im.w + 'px', im.src, '|', im.alt);
await pg.screenshot({ path: '/tmp/candilejas-movil.png', fullPage: true });

// entrar a WUNDEER (el login del script es el de Candilejas)
await pg.goto(URL + '/login', { waitUntil: 'networkidle' });
await pg.getByRole('button', { name: /Escribir el c[oó]digo de WUNDEER/i }).click();
await pg.waitForTimeout(500);
await pg.getByRole('button', { name: /CONTINUAR|BUSCANDO/ }).click();
await pg.waitForTimeout(2200);
await pg.locator('select').first().selectOption({ index: 0 });
await pg.getByRole('button', { name: /ENTRAR|ENTRANDO/ }).click();
await pg.waitForTimeout(3500);
console.log('sesion WUNDEER:', pg.url().replace(URL, ''));
const control = fs.readFileSync('/tmp/wun.txt', 'utf8').trim();
await pg.goto(URL + '/wundeer/ideas/' + control, { waitUntil: 'networkidle' });
await pg.waitForTimeout(5500);
const ifsC = await pg.locator('iframe').evaluateAll((e) => e.map((f) => ({ src: f.src.slice(0, 78), h: Math.round(f.getBoundingClientRect().height) })));
const imgsC = await pg.locator('img').evaluateAll((e) => e.filter((i) => i.naturalWidth > 200).map((i) => i.naturalWidth + 'px ' + i.src.slice(0, 56)));
console.log('=== CONTROL: O1 de Wundeer (funcionaba antes) ===');
console.log('  iframes:', ifsC);
console.log('  imagenes grandes:', imgsC);
await pg.screenshot({ path: '/tmp/control-wun.png', fullPage: true });
await nav.close();
