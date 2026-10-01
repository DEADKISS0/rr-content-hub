import { chromium, devices } from 'playwright';
const BASE = 'https://rr-content-hub.vercel.app';
const ID = process.argv[2];

const PROBE = () => {
  const vw = window.innerWidth;
  const offenders = [];
  document.querySelectorAll('*').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.height === 0 || r.width === 0) return;
    if (r.right <= vw + 1) return;
    const childOver = [...el.children].some((c) => c.getBoundingClientRect().right > vw + 1);
    if (!childOver) {
      offenders.push({
        tag: el.tagName, right: Math.round(r.right), over: Math.round(r.right - vw), w: Math.round(r.width),
        txt: (el.textContent || '').trim().slice(0, 45),
        cls: String(el.className).slice(0, 100),
      });
    }
  });
  // embed widths
  const embeds = [...document.querySelectorAll('iframe')].map((f) => ({
    w: Math.round(f.getBoundingClientRect().width),
    parentW: Math.round(f.parentElement.getBoundingClientRect().width),
    parentCls: String(f.parentElement.className).slice(0, 80),
    estado: f.getAttribute('data-estado'),
  }));
  return { vw, bodyW: document.body.scrollWidth, offenders: offenders.slice(0, 10), embeds };
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

await page.goto(BASE + ID, { waitUntil: 'networkidle' });
await page.waitForTimeout(14000);
const o = await page.evaluate(PROBE);
console.log(`vw=${o.vw} bodyW=${o.bodyW}  (overflow ${o.bodyW - o.vw}px)`);
console.log('EMBEDS:', JSON.stringify(o.embeds, null, 1));
console.log('OFFENDERS:');
o.offenders.forEach((x) => console.log(`  +${x.over}px R=${x.right} w=${x.w} ${x.tag} :: ${x.cls.slice(0, 85)} :: "${x.txt}"`));
await browser.close();