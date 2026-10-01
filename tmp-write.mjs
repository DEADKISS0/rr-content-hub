import { chromium, devices } from 'playwright';
const BASE = 'https://rr-content-hub.vercel.app';
const IDEA = '/wundeer/ideas/65bdc9af-bae1-4696-9679-c37afb858eb3';

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();
const api = [];
page.on('response', (r) => {
  const u = r.url();
  if (u.includes('/api/')) api.push(`${r.request().method()} ${r.status()} ${u.replace(BASE, '').slice(0, 70)} ${JSON.stringify(r.request().postData() || '').slice(0, 90)}`);
});

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await page.getByRole('button', { name: /WUNDEER/i }).click({ timeout: 20000 });
await page.getByRole('button', { name: /CONTINUAR/i }).click();
await page.waitForSelector('#persona', { timeout: 15000 });
await page.selectOption('#persona', { label: 'Santiago Medina Lopez' });
await page.getByRole('button', { name: /^ENTRAR$/ }).click();
await page.waitForTimeout(4500);
api.length = 0;

await page.goto(BASE + IDEA, { waitUntil: 'networkidle' });
await page.waitForTimeout(4000);
for (const label of ['ENTENDIDO', 'SALTAR']) {
  try { const b = page.getByRole('button', { name: label, exact: true }); if (await b.count()) await b.first().click({ timeout: 3000 }); } catch {}
}
await page.waitForTimeout(600);

// TEST 1: comment — does it give feedback?
api.length = 0;
const ta = page.locator('textarea[placeholder*="decisi"]');
await ta.fill('PRUEBA AUDITORIA UX — comentario de prueba');
const btn = page.getByRole('button', { name: /ENVIAR COMENTARIO/i });
console.log('comment btn disabled before:', await btn.isDisabled());
await btn.click();
await page.waitForTimeout(3000);
console.log('--- after comment ---');
console.log('API:', [...new Set(api)].join(' | '));
console.log('textarea value now:', JSON.stringify(await ta.inputValue()));
console.log('status/alert msgs:', JSON.stringify(await page.evaluate(() =>
  [...document.querySelectorAll('[role=alert],[role=status]')].map(e => e.textContent.trim().slice(0, 90))
)));

// TEST 2: transition button — arm + confirm
api.length = 0;
const moves = await page.evaluate(() =>
  [...document.querySelectorAll('button')].map(b => b.textContent.trim()).filter(t => /APROBAR|ENVIAR|MOVER|CERRAR|INICIAR|MARCAR|SOLICITAR|REENVIAR|ARCHIVAR|ABRIR|PEDIR|IR DIRECTO/.test(t))
);
console.log('\nmove buttons present:', JSON.stringify(moves));
if (moves.length) {
  await page.getByRole('button', { name: new RegExp(moves[0].slice(0, 20).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }).first().click();
  await page.waitForTimeout(1200);
  console.log('after 1st click, confirm visible:', await page.evaluate(() =>
    [...document.querySelectorAll('button')].some(b => /S[IÍ], MOVER AHORA|CONFIRMA/.test(b.textContent))
  ));
  console.log('API after arm:', [...new Set(api)].join(' | '));
}
await browser.close();