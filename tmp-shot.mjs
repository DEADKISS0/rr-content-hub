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

for (const [r, name] of [['/wundeer/publicaciones', 'pub'], ['/wundeer/aprobaciones', 'apr']]) {
  await page.goto(BASE + r, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `/home/deadkiss/.hermes/cache/scratch/${name}.png` });
  // measure the offending block
  const info = await page.evaluate(() => {
    const h1 = document.querySelector('h1');
    const cont = h1?.parentElement;
    return {
      h1Text: h1?.textContent,
      h1Rect: h1 ? { l: Math.round(h1.getBoundingClientRect().left), r: Math.round(h1.getBoundingClientRect().right) } : null,
      h1Cls: String(h1?.className),
      parentCls: String(cont?.className),
      parentW: cont ? cont.clientWidth : null,
      innerW: window.innerWidth,
      docW: document.documentElement.scrollWidth,
    };
  });
  console.log(name, JSON.stringify(info, null, 1));
}
await browser.close();