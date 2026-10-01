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

// PhaseRail measurement on board + idea page
for (const r of ['/wundeer', '/wundeer/ideas', '/wundeer/produccion', '/wundeer/publicaciones', '/wundeer/ideas/65bdc9af-bae1-4696-9679-c37afb858eb3']) {
  await page.goto(BASE + r, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const o = await page.evaluate(() => {
    const rails = [...document.querySelectorAll('span[title*="·"]')].filter(s => s.className.includes('flex-1 border px-2'));
    const out = rails.slice(0, 2).map(r => {
      const rc = r.getBoundingClientRect();
      const parent = r.parentElement.getBoundingClientRect();
      return {
        labels: [...r.parentElement.children].map(c => ({ txt: c.textContent.trim(), w: Math.round(c.getBoundingClientRect().width), right: Math.round(c.getBoundingClientRect().right) })),
        railW: Math.round(parent.width), railRight: Math.round(parent.right), railScrollW: r.parentElement.scrollWidth,
        vw: window.innerWidth,
      };
    });
    return { count: rails.length, out, docW: document.documentElement.scrollWidth, bodyW: document.body.scrollWidth };
  });
  console.log(`\n=== ${r} rails=${o.count} vw=${o.vw} docW=${o.docW} bodyW=${o.bodyW}`);
  o.out.forEach((x) => {
    console.log(`  rail w=${x.railW} right=${x.railRight} scrollW=${x.railScrollW}`);
    x.labels.forEach((l) => console.log(`     "${l.txt}" w=${l.w} right=${l.right}${l.right > x.vw ? '  <<< OFF SCREEN' : ''}`));
  });
}
await browser.close();