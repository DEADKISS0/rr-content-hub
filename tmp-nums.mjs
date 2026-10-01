import { chromium, devices } from 'playwright';
const BASE = 'https://rr-content-hub.vercel.app';

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await page.getByRole('button', { name: /WUNDEER/i }).click({ timeout: 20000 });
await page.getByRole('button', { name: /CONTINUAR/i }).click();
await page.waitForSelector('#persona', { timeout: 15000 });
await page.selectOption('#persona', { label: 'Santiago Medina Lopez' });
await page.getByRole('button', { name: /^ENTRAR$/ }).click();
await page.waitForTimeout(4500);

// ---- NUMBER CONSISTENCY on the board ----
await page.goto(`${BASE}/wundeer`, { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
for (const label of ['ENTENDIDO', 'SALTAR']) {
  try { const b = page.getByRole('button', { name: label, exact: true }); if (await b.count()) await b.first().click({ timeout: 3000 }); } catch {}
}
await page.waitForTimeout(1000);

const nums = await page.evaluate(() => {
  const txt = document.body.innerText;
  const grab = (re) => { const m = txt.match(re); return m ? m[0] : null; };
  return {
    headline: txt.slice(0, 700),
    esperaRegion: (() => {
      const h = [...document.querySelectorAll('h2')].find(x => /esperando respuesta/i.test(x.textContent));
      return h ? h.closest('section,div')?.innerText.slice(0, 500) : null;
    })(),
    clientSection: (() => {
      const h = [...document.querySelectorAll('h2')].find(x => /Esperan a alguien de fuera/i.test(x.textContent));
      return h ? h.parentElement?.innerText.slice(0, 500) : null;
    })(),
    teamSection: (() => {
      const h = [...document.querySelectorAll('h2')].find(x => /no dependen de nadie/i.test(x.textContent));
      return h ? h.parentElement?.innerText.slice(0, 400) : null;
    })(),
  };
});
console.log('=== BOARD NUMBERS ===');
console.log(nums.headline);
console.log('\n--- ESPERA REGION ---\n' + nums.esperaRegion);
console.log('\n--- CLIENT SECTION ---\n' + nums.clientSection);
console.log('\n--- TEAM SECTION ---\n' + nums.teamSection);

// ---- EMPTY QUEUE STATES: any exit link? ----
for (const r of ['/wundeer/produccion', '/wundeer/publicaciones', '/wundeer/aprobaciones', '/wundeer/ideas', '/wundeer/roadmap', '/wundeer/metricas']) {
  await page.goto(BASE + r, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);
  const st = await page.evaluate(() => {
    const main = document.querySelector('main');
    const t = main?.innerText || '';
    const links = [...document.querySelectorAll('main a')].map(a => ({ txt: a.textContent.trim().slice(0, 32), href: a.getAttribute('href') }));
    return { len: t.length, head: t.slice(0, 260), links };
  });
  console.log(`\n=== ${r} (${st.len} chars) ===`);
  console.log(st.head);
  console.log('  links:', JSON.stringify(st.links.slice(0, 8)));
}
await browser.close();