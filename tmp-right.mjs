import { chromium, devices } from 'playwright';

const BASE = 'https://rr-content-hub.vercel.app';

// Only RIGHT-edge overflow, and only the DEEPEST offenders (parent chain)
const RIGHT_OVERFLOW = () => {
  const vw = window.innerWidth;
  const out = [];
  document.querySelectorAll('*').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.height === 0) return;
    if (r.right <= vw + 1) return;
    const childOver = [...el.children].some((c) => c.getBoundingClientRect().right > vw + 1);
    if (!childOver) {
      // walk up to describe the container
      const chain = [];
      let p = el.parentElement;
      for (let i = 0; i < 3 && p; i += 1) { chain.push(String(p.className).slice(0, 60)); p = p.parentElement; }
      out.push({
        tag: el.tagName,
        txt: (el.textContent || '').trim().slice(0, 50),
        right: Math.round(r.right),
        overBy: Math.round(r.right - vw),
        w: Math.round(r.width),
        cls: String(el.className).slice(0, 100),
        parentChain: chain,
      });
    }
  });
  return { vw, bodyScrollW: document.body.scrollWidth, count: out.length, offenders: out.slice(0, 15) };
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

const routes = ['/wundeer', '/wundeer/ideas', '/wundeer/publicaciones', '/wundeer/aprobaciones',
  '/wundeer/produccion', '/wundeer/ideas/nueva', '/wundeer/roadmap', '/wundeer/metricas', '/wundeer/perfil'];
for (const r of routes) {
  await page.goto(BASE + r, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const o = await page.evaluate(RIGHT_OVERFLOW);
  console.log(`\n=== ${r} vw=${o.vw} bodyScrollW=${o.bodyScrollW} offenders=${o.count} ===`);
  o.offenders.forEach((x) =>
    console.log(`  R=${x.right} (+${x.overBy}px) w=${x.w} ${x.tag} :: ${x.cls.slice(0, 80)}`)
  );
  if (!o.offenders.length) console.log('  (clean)');
}
await browser.close();