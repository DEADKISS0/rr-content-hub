import { chromium } from 'playwright';
const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 1400, height: 1000 }, locale: 'es-ES' });
const pg = await ctx.newPage();
await pg.goto('https://rr-content-hub.vercel.app/login', { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(1800);
await pg.getByRole('button', { name: /WUNDEER/i }).first().click().catch(() => {});
await pg.waitForTimeout(500);
await pg.getByRole('button', { name: /CONTINUAR/i }).click().catch(() => {});
await pg.waitForTimeout(2500);
await pg.locator('select').first().selectOption({ index: 0 }).catch(() => {});
await pg.getByRole('button', { name: /ENTRAR/i }).click().catch(() => {});
await pg.waitForTimeout(4000);
const s = pg.getByRole('button', { name: /^SALTAR$/i });
if (await s.count()) { await s.first().click().catch(()=>{}); await pg.waitForTimeout(700); }
await pg.goto('https://rr-content-hub.vercel.app/wundeer/ideas', { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(10000);
await pg.getByRole('button', { name: /DE HERMES/ }).first().click();
await pg.waitForTimeout(2500);
// el chip de FORMATO de cada tarjeta: son REEL/FOTO/PAUTA, no la categoria
const formatos = await pg.locator('.idea-card').evaluateAll((ls) => ls.map((e) => {
  const t = e.textContent || '';
  const m = t.match(/\b(REEL|CARRUSEL|FOTO|VIDEO|PAUTA|GUION)\b/);
  const cat = t.match(/(Ajuste y talla|Confianza y oficio|Coleccion y styling|Segunda vida y comunidad|Pauta: catalogo y color)/);
  return (m ? m[1] : '?') + ' <- ' + (cat ? cat[1] : '?');
}));
console.log('formato <- categoria por tarjeta:');
for (const f of formatos) console.log('  ', f);
await nav.close();