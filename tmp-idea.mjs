import { chromium, devices } from 'playwright';
const BASE = 'https://rr-content-hub.vercel.app';

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();
const netFails = [];
page.on('response', (r) => { if (r.status() >= 400) netFails.push(`${r.status()} ${r.url().slice(0, 120)}`); });
page.on('console', (m) => { if (m.type() === 'error') netFails.push('CONSOLE ' + m.text().slice(0, 150)); });
page.on('pageerror', (e) => netFails.push('PAGEERROR ' + String(e.message).slice(0, 150)));

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await page.getByRole('button', { name: /WUNDEER/i }).click({ timeout: 20000 });
await page.getByRole('button', { name: /CONTINUAR/i }).click();
await page.waitForSelector('#persona', { timeout: 15000 });
await page.selectOption('#persona', { label: 'Santiago Medina Lopez' });
await page.getByRole('button', { name: /^ENTRAR$/ }).click();
await page.waitForTimeout(4500);
console.log('LOGIN ->', page.url());

// go to board, click first idea link
await page.goto(`${BASE}/wundeer`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const firstIdea = await page.evaluate(() => {
  const a = [...document.querySelectorAll('a[href*="/ideas/"]')].filter(x => !x.getAttribute('href').endsWith('/nueva'));
  return a.length ? a[0].getAttribute('href') : null;
});
console.log('FIRST IDEA:', firstIdea);

const target = `${BASE}${firstIdea}`;
netFails.length = 0;
await page.goto(target, { waitUntil: 'networkidle' });
await page.waitForTimeout(15000); // let embeds try

const info = await page.evaluate(() => {
  const iframes = [...document.querySelectorAll('iframe')].map((f) => ({
    src: f.src.slice(0, 100),
    estado: f.getAttribute('data-estado'),
    w: Math.round(f.getBoundingClientRect().width),
    h: Math.round(f.getBoundingClientRect().height),
  }));
  const avisos = [...document.querySelectorAll('[data-aviso-embed]')].map((a) => ({
    estado: a.getAttribute('data-aviso-embed'), txt: a.textContent.trim().slice(0, 70),
  }));
  const sections = [...document.querySelectorAll('h2,h3')].map((h) => h.textContent.trim().slice(0, 50)).slice(0, 40);
  const btns = [...document.querySelectorAll('button')].map((b) => b.textContent.trim().slice(0, 40)).filter(Boolean);
  return {
    url: location.pathname, vw: window.innerWidth,
    docW: document.documentElement.scrollWidth, bodyW: document.body.scrollWidth,
    iframes, avisos, sections, btns,
  };
});
console.log(JSON.stringify(info, null, 1));
console.log('\nNET/CONSOLE ISSUES:', JSON.stringify([...new Set(netFails)], null, 1));
await page.screenshot({ path: '/home/deadkiss/.hermes/cache/scratch/idea.png', fullPage: false });
await browser.close();