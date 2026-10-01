import { chromium, devices } from 'playwright';
const BASE = 'https://rr-content-hub.vercel.app';
const TREE = () => {
  const vw = window.innerWidth;
  const wide = [];
  document.querySelectorAll('*').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.height === 0 || r.width === 0) return;
    if (r.width > vw + 2) {
      const chain = [];
      let p = el;
      for (let i = 0; i < 8 && p; i += 1) {
        chain.push(`${p.tagName}[${Math.round(p.getBoundingClientRect().width)}].${String(p.className).split('\n')[0].slice(0, 70)}`);
        p = p.parentElement;
      }
      wide.push({ w: Math.round(r.width), tag: el.tagName, txt: (el.textContent || '').trim().slice(0, 60), chain });
    }
  });
  // sort widest first, dedupe by chain head
  wide.sort((a, b) => b.w - a.w);
  return { vw, top: wide.slice(0, 6) };
};

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

for (const r of ['/wundeer/publicaciones', '/wundeer/aprobaciones']) {
  await page.goto(BASE + r, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const o = await page.evaluate(TREE);
  console.log(`\n######## ${r} vw=${o.vw}`);
  o.top.forEach((x) => {
    console.log(`\n  W=${x.w} <${x.tag}> "${x.txt}"`);
    x.chain.forEach((c, i) => console.log(`    ${' '.repeat(i * 2)}${c}`));
  });
}
await browser.close();