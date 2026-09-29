import { chromium } from 'playwright';
import fs from 'node:fs';
const lista = JSON.parse(fs.readFileSync('/tmp/posts.json','utf8'));
const nav = await chromium.launch();
for (const { codigo, shortcode } of lista) {
  const ctx = await nav.newContext({ viewport: { width: 480, height: 820 }, locale: 'es-ES' });
  const pg = await ctx.newPage();
  await pg.goto('https://www.instagram.com/reel/' + shortcode + '/', { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(3600);
  const c = pg.getByRole('button', { name: /cerrar/i });
  if (await c.count()) { await c.first().click().catch(()=>{}); await pg.waitForTimeout(700); }
  const t = await pg.evaluate(() => document.body.innerText.replace(/\n{2,}/g, '\n'));
  console.log('=== ' + codigo + ' ' + shortcode + ' ===');
  console.log(t.slice(0, 700));
  console.log('');
  await ctx.close();
}
await nav.close();