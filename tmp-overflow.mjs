import { chromium, devices } from 'playwright';

const BASE = 'https://rr-content-hub.vercel.app';

const FIND_OVERFLOW = () => {
  const vw = window.innerWidth;
  const out = [];
  document.querySelectorAll('*').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.height === 0) return;
    if (r.right > vw + 1 || r.left < -1) {
      // only report the deepest offenders
      const childOver = [...el.children].some(
        (c) => { const cr = c.getBoundingClientRect(); return cr.right > vw + 1 || cr.left < -1; }
      );
      if (!childOver) {
        out.push({
          tag: el.tagName,
          txt: (el.textContent || '').trim().slice(0, 45),
          left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width),
          cls: String(el.className).slice(0, 110),
        });
      }
    }
  });
  return { vw, bodyScrollW: document.body.scrollWidth, offenders: out.slice(0, 12) };
};

// Things that only work on hover: title attributes, group-hover-only reveals
const HOVER_ONLY = () => {
  const res = { titleAttrs: [], desktopOnly: [], longPress: [] };
  document.querySelectorAll('[title]').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0) return;
    res.titleAttrs.push({ tag: el.tagName, title: el.getAttribute('title').slice(0, 60), txt: el.textContent.trim().slice(0, 35) });
  });
  return res;
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
console.log('LOGIN ->', page.url());

for (const r of ['/wundeer/publicaciones', '/wundeer/aprobaciones', '/wundeer', '/wundeer/ideas', '/select-project', '/wundeer/produccion']) {
  await page.goto(BASE + r, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const o = await page.evaluate(FIND_OVERFLOW);
  const h = await page.evaluate(HOVER_ONLY);
  console.log('\n=== ' + r + ' vw=' + o.vw + ' bodyScrollW=' + o.bodyScrollW + ' ===');
  o.offenders.forEach((x) =>
    console.log(`  OFFEND ${x.tag} L=${x.left} R=${x.right} w=${x.w} :: ${x.cls.slice(0, 95)}`)
  );
  if (!o.offenders.length) console.log('  (no offender)');
  if (h.titleAttrs.length) {
    console.log('  title= tooltips:', h.titleAttrs.length);
    h.titleAttrs.slice(0, 8).forEach((t) => console.log(`     ${t.tag} title="${t.title}"`));
  }
}
await browser.close();