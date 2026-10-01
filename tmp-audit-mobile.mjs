import { chromium, devices } from 'playwright';

const BASE = 'https://rr-content-hub.vercel.app';

const ROUTES = [
  '/wundeer',
  '/wundeer/ideas',
  '/wundeer/ideas/nueva',
  '/wundeer/produccion',
  '/wundeer/publicaciones',
  '/wundeer/aprobaciones',
  '/wundeer/roadmap',
  '/wundeer/metricas',
  '/wundeer/perfil',
  '/select-project',
  '/offline',
];

const MEASURE = () => {
  const o = {
    url: location.pathname,
    vw: window.innerWidth,
    docScrollW: document.documentElement.scrollWidth,
  };
  o.overflowX = o.docScrollW > window.innerWidth + 1;

  const wide = [];
  document.querySelectorAll('*').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width > window.innerWidth + 2 && r.height > 0) {
      wide.push({
        tag: el.tagName,
        cls: String(el.className).slice(0, 100),
        w: Math.round(r.width),
        parentCls: String(el.parentElement?.className || '').slice(0, 60),
      });
    }
  });
  o.wideCount = wide.length;
  o.wide = wide.slice(0, 8);

  // Which scrollable ancestor holds the horizontal scroll
  const scrollers = [];
  document.querySelectorAll('*').forEach((el) => {
    if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0) {
      const cs = getComputedStyle(el);
      scrollers.push({
        tag: el.tagName,
        cls: String(el.className).slice(0, 80),
        ox: cs.overflowX,
        clientW: el.clientWidth,
        scrollW: el.scrollWidth,
      });
    }
  });
  o.hScrollers = scrollers.slice(0, 8);

  // Text that is visually clipped WITHOUT ellipsis = content lost
  const lostText = [];
  document.querySelectorAll('h1,h2,h3,h4,p,span,a,button,li,td,label,summary,strong,div').forEach((el) => {
    if (el.children.length > 1) return;
    const cs = getComputedStyle(el);
    const clip =
      cs.overflow === 'hidden' || cs.overflowX === 'hidden' ||
      cs.overflowY === 'hidden' || cs.textOverflow === 'ellipsis';
    const over = el.scrollWidth > el.clientWidth + 4 || el.scrollHeight > el.clientHeight + 4;
    if (clip && over && el.clientWidth > 0 && el.textContent.trim().length > 3) {
      lostText.push({
        tag: el.tagName,
        txt: el.textContent.trim().slice(0, 50),
        cw: el.clientWidth, sw: el.scrollWidth, ch: el.clientHeight, sh: el.scrollHeight,
        ellipsis: cs.textOverflow === 'ellipsis',
        cls: String(el.className).slice(0, 70),
      });
    }
  });
  o.lostTextCount = lostText.length;
  o.lostText = lostText.slice(0, 15);

  // Touch targets under 44px
  const small = [];
  document.querySelectorAll('a,button,[role="button"],summary,select,input[type="text"]').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    if (r.height < 40) {
      small.push({
        tag: el.tagName,
        txt: el.textContent.trim().slice(0, 30),
        h: Math.round(r.height),
        w: Math.round(r.width),
        aria: el.getAttribute('aria-label'),
      });
    }
  });
  o.smallTouchCount = small.length;
  o.smallTouch = small.slice(0, 20);

  // Font sizes below 12px (Santiago needs legible type)
  const tiny = {};
  document.querySelectorAll('*').forEach((el) => {
    if (!el.textContent || !el.textContent.trim()) return;
    if (el.children.length > 0) return;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs && fs < 12) {
      const k = fs + 'px';
      tiny[k] = (tiny[k] || 0) + 1;
    }
  });
  o.tinyFont = tiny;

  return o;
};

const browser = await chromium.launch();
const ctx = await browser.newContext({
  ...devices['iPhone 13'],
  isMobile: true,
  hasTouch: true,
});
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e.message).slice(0, 200)));

// login
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
console.log('LOGIN BUTTONS:', JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('button')].map(b => (b.getAttribute('aria-label')||b.textContent||'').trim().slice(0,50)))));
await page.getByRole('button', { name: /WUNDEER/i }).click({ timeout: 20000 });
await page.click('button[type=submit]');
await page.waitForSelector('#persona', { timeout: 15000 });
await page.selectOption('#persona', { label: 'Santiago Medina Lopez' });
await page.click('button[type=submit]');
await page.waitForTimeout(4000);
console.log('LOGIN ->', page.url());

const results = [];
for (const r of ROUTES) {
  const before = errors.length;
  let nav = null;
  try {
    const resp = await page.goto(BASE + r, { waitUntil: 'networkidle', timeout: 30000 });
    nav = resp ? resp.status() : null;
    await page.waitForTimeout(1200);
  } catch (e) {
    results.push({ route: r, navError: String(e.message).slice(0, 150) });
    continue;
  }
  const m = await page.evaluate(MEASURE);
  m.route = r;
  m.httpStatus = nav;
  m.newConsoleErrors = errors.slice(before);
  results.push(m);
}
console.log(JSON.stringify(results, null, 1));
await browser.close();