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
// 1) las pestañas de origen existen y traen conteos
const tabs = await pg.getByRole('navigation', { name: /Qui.n propuso/i }).locator('button').allInnerTexts();
console.log('pestañas origen:', JSON.stringify(tabs));
// 2)|DE HERMES| filtra de verdad
await pg.getByRole('button', { name: /DE HERMES/ }).first().click();
await pg.waitForTimeout(2500);
const tras = await pg.locator('.idea-card').count();
const soloHermes = await pg.locator('.idea-card:has-text("HERMES")').count();
console.log('con filtro DE HERMES -> tarjetas:', tras, '| con insignia:', soloHermes);
// 3) las categorias se ven
const cats = await pg.locator('.idea-card').evaluateAll((ls) => [...new Set(ls.map((e) => (e.textContent.match(/Ajuste y talla|Confianza y oficio|Coleccion y styling|Segunda vida y comunidad|Pauta: catalogo y color/) || ['?'])[0]))]);
console.log('categorias visibles:', JSON.stringify(cats));
// 4) volver a todo
await pg.getByRole('button', { name: /DE TODOS/ }).first().click();
await pg.waitForTimeout(1800);
console.log('al volver a DE TODOS:', await pg.locator('.idea-card').count());
await pg.getByRole('button', { name: /DE HERMES/ }).first().click();
await pg.waitForTimeout(2200);
await pg.screenshot({ path: '/tmp/filtro-origen.png' });
await nav.close();