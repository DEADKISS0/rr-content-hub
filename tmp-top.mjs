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

await page.goto(`${BASE}/wundeer/publicaciones`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.screenshot({ path: '/home/deadkiss/.hermes/cache/scratch/pub-top.png' });
// measure text bbox of the h1 text node
const t = await page.evaluate(() => {
  const h1 = document.querySelector('h1.display-title');
  const range = document.createRange();
  range.selectNodeContents(h1);
  const b = range.getBoundingClientRect();
  const cs = getComputedStyle(h1);
  return { textRight: Math.round(b.right), vw: window.innerWidth, fontSize: cs.fontSize, minContentW: Math.round(h1.scrollWidth) };
});
console.log(JSON.stringify(t));
await browser.close();