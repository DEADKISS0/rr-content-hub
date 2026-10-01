import { chromium, devices } from 'playwright';
const BASE = 'https://rr-content-hub.vercel.app';
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await page.getByRole('button', { name: /WUNDEER/i }).click({ timeout: 20000 });
await page.getByRole('button', { name: /CONTINUAR/i }).click();
await page.waitForSelector('#persona', { timeout: 15000 });
await page.selectOption('#persona', { label: 'Santiago Medina Lopez' });
await page.getByRole('button', { name: /^ENTRAR$/ }).click();
await page.waitForTimeout(4500);

for (const [route, tag] of [['/wundeer/publicaciones', 'pub'], ['/wundeer/aprobaciones', 'apr']]) {
  await page.goto(BASE + route, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.scrollTo(0, 0));
  const box = await page.evaluate(() => {
    const h1 = document.querySelector('h1.display-title');
    const r = h1.getBoundingClientRect();
    return { x: 0, y: Math.max(0, r.top - 60), width: 390, height: Math.min(400, 200) };
  });
  await page.screenshot({ path: `/home/deadkiss/.hermes/cache/scratch/${tag}-crop.png`, clip: box });
  console.log(tag, 'cropped at', JSON.stringify(box));
}
await browser.close();