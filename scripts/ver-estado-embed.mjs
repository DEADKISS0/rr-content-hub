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
const saltar = pg.getByRole('button', { name: /^SALTAR$/i });
if (await saltar.count()) { await saltar.first().click().catch(()=>{}); await pg.waitForTimeout(700); }

for (const [cod, iid] of JSON.parse(process.argv[2])) {
  await pg.goto('https://rr-content-hub.vercel.app/candilejas/ideas/' + iid, { waitUntil: 'domcontentloaded' });
  const estados = [];
  // se mira dos veces: temprano (cargando/tardando) y ya asentado (vivo)
  for (const espera of [2500, 13000]) {
    await pg.waitForTimeout(espera);
    const e = await pg.locator('iframe[data-estado]').first().getAttribute('data-estado').catch(() => 'sin-iframe');
    estados.push(e);
  }
  const img = await pg.locator('img').evaluateAll((ls) => ls.filter((i) => i.naturalWidth > 300).map((i) => i.naturalWidth + 'x' + i.naturalHeight));
  const aviso = await pg.locator('[data-aviso-embed]').first().innerText().catch(() => 'sin aviso');
  console.log(cod + '  embed: ' + estados[0] + ' -> ' + estados[1] + '  | portada: ' + (img[0] || 'NO') + '  | aviso: ' + (aviso.trim().slice(0, 46) || 'ninguno'));
}
await nav.close();