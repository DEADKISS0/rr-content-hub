import { chromium } from 'playwright';
import fs from 'node:fs';
const cuentas = JSON.parse(fs.readFileSync('/tmp/cuentas.json', 'utf8'));
const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 1280, height: 1800 }, locale: 'es-ES',
  userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36' });
const salida = [];
for (const [cuenta, ya] of Object.entries(cuentas)) {
  const pg = await ctx.newPage();
  try {
    await pg.goto(`https://www.instagram.com/${cuenta}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await pg.waitForTimeout(5000);
    // el post marcado en <link rel="canonical"> del primer post, y los shorts del feed
    const links = await pg.evaluate(() => Array.from(new Set(
      Array.from(document.querySelectorAll('a[href*="/reel/"],a[href*="/p/"]'))
        .map((a) => (a.getAttribute('href') || '').split('?')[0]))));
    console.log(cuenta, '->', links.length, 'posts', links.slice(0, 12).join(' '));
    salida.push({ cuenta, ya, links });
  } catch (e) {
    console.log(cuenta, '-> ERROR', String(e).slice(0, 80));
  }
  await pg.close();
}
fs.writeFileSync('/tmp/feed-cuentas.json', JSON.stringify(salida, null, 2));
await nav.close();