import { chromium, devices } from 'playwright';
const BASE = 'https://rr-content-hub.vercel.app';
const IDEA = '/wundeer/ideas/65bdc9af-bae1-4696-9679-c37afb858eb3';

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();
const api = [];
page.on('response', (r) => {
  const u = r.url();
  if (u.includes('/api/')) api.push(`${r.request().method()} ${r.status()} ${u.replace(BASE, '').slice(0, 90)}`);
});
page.on('pageerror', (e) => api.push('PAGEERROR ' + String(e.message).slice(0, 120)));

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await page.getByRole('button', { name: /WUNDEER/i }).click({ timeout: 20000 });
await page.getByRole('button', { name: /CONTINUAR/i }).click();
await page.waitForSelector('#persona', { timeout: 15000 });
await page.selectOption('#persona', { label: 'Santiago Medina Lopez' });
await page.getByRole('button', { name: /^ENTRAR$/ }).click();
await page.waitForTimeout(4500);

await page.goto(BASE + IDEA, { waitUntil: 'networkidle' });
await page.waitForTimeout(4000);

// dismiss install bar / tour if present
for (const label of ['ENTENDIDO', 'SALTAR']) {
  try { const b = page.getByRole('button', { name: label, exact: true }); if (await b.count()) await b.first().click({ timeout: 3000 }); } catch {}
}
await page.waitForTimeout(800);

// Snapshot of all interactive controls
const controls = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')].map((b, i) => ({
    i, txt: b.textContent.trim().slice(0, 45), type: b.type, disabled: b.disabled,
    h: Math.round(b.getBoundingClientRect().height),
  })).filter(b => b.txt);
  const inputs = [...document.querySelectorAll('input,textarea,select')].map(el => ({
    tag: el.tagName, type: el.type, name: el.getAttribute('name'), ph: el.placeholder?.slice(0, 40),
    hidden: el.offsetParent === null,
  }));
  const links = [...document.querySelectorAll('a')].map(a => ({ txt: a.textContent.trim().slice(0, 40), href: a.getAttribute('href'), target: a.target })).filter(l => l.txt);
  return { btns, inputs, links, bodyLen: document.body.innerText.length };
});
console.log('=== CONTROLS ===');
controls.btns.forEach(b => console.log(`  BTN[${b.i}] h=${b.h} dis=${b.disabled} "${b.txt}"`));
console.log('--- inputs ---');
controls.inputs.forEach(i => console.log(`  ${i.tag}/${i.type} hidden=${i.hidden} ph="${i.ph||''}"`));
console.log('--- external links ---');
controls.links.filter(l => l.target === '_blank').forEach(l => console.log(`  "${l.txt}" -> ${l.href?.slice(0,70)}`));

console.log('\n=== API CALLS ON LOAD ===');
console.log([...new Set(api)].join('\n'));
await browser.close();