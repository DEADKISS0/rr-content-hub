
import { chromium } from 'playwright';
import fs from 'node:fs';
const estado = JSON.parse(fs.readFileSync('/tmp/estado-santiago.json', 'utf8'));
const nav = await chromium.launch();
const ctx = await nav.newContext({ storageState: estado, viewport: { width: 1440, height: 900 } });
const pg = await ctx.newPage();
await pg.goto('https://rr-content-hub.vercel.app/wundeer', { waitUntil: 'networkidle' });
// el selector esta en la barra lateral
// La guia guiada sale la primera vez y tapa la barra lateral. Se cierra antes
// de tocar el selector; si no, el clic rebota contra el overlay.
const guia = pg.locator('[role="dialog"][aria-modal="true"]');
if (await guia.count()) {
  const cerrar = guia.locator('button[aria-label*="errar" i], button:has-text("ENTENDIDO"), button:has-text("SALTAR"), button:has-text("CERRAR")').first();
  if (await cerrar.count()) { await cerrar.click(); await pg.waitForTimeout(500); }
  else { await pg.keyboard.press('Escape'); await pg.waitForTimeout(500); }
  console.log('Guia guiada cerrada:', (await guia.count()) === 0);
}
const sel = pg.locator('[data-guia="selector-cliente"] button').first();
console.log('Boton del selector:', await sel.count() ? await sel.innerText() : 'NO ESTA');
await sel.click();
await pg.waitForTimeout(400);
const opciones = await pg.locator('[role="listbox"] [role="option"]').allInnerTexts();
console.log('Clientes que se pueden abrir:', opciones.length);
opciones.forEach(o => console.log('  -', o.replace(/\n/g, ' | ')));
const cerrados = await pg.locator('[role="listbox"] [aria-disabled="true"]').allInnerTexts();
console.log('Con candado:', cerrados.length);
cerrados.forEach(o => console.log('  x', o.replace(/\n/g, ' | ').slice(0, 70)));
await pg.screenshot({ path: '/tmp/selector-abierto.png' });
// y el cambio real
const cand = pg.locator('[role="option"]').filter({ hasText: /candilejas/i }).first();
console.log('Opcion Candilejas encontrada:', await cand.count());
if (await cand.count()) {
  await cand.click();
  await pg.waitForURL('**/candilejas', { timeout: 15000 });
  await pg.waitForTimeout(800);
  console.log('URL tras cambiar:', pg.url());
  console.log('Selector ahora muestra:', (await sel.innerText()).replace(/\n/g, ' | '));
  await pg.screenshot({ path: '/tmp/tras-cambiar.png' });
}
await nav.close();
