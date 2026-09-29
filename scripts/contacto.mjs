import { chromium } from 'playwright';
import fs from 'node:fs';
const lista = JSON.parse(fs.readFileSync('/tmp/posts.json','utf8'));
const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 1200, height: 1200 } });
const pg = await ctx.newPage();
const html = ['<style>body{margin:0;background:#0b0b0b;display:grid;grid-template-columns:repeat(3,1fr);gap:6px;padding:6px;font:11px monospace;color:#fff}figure{margin:0}img{width:100%;display:block;max-height:420px;object-fit:contain;background:#000}figcaption{padding:2px}</style>'];
for (const { codigo, shortcode } of lista) {
  const buf = fs.readFileSync('/tmp/ig-' + codigo + '.jpg');
  html.push('<figure><img src="data:image/jpeg;base64,' + buf.toString('base64') + '"><figcaption>' + codigo + '</figcaption></figure>');
}
await pg.setContent(html.join(''));
await pg.waitForTimeout(700);
await pg.screenshot({ path: '/tmp/contacto.jpg', fullPage: true });
console.log('figuras:', await pg.locator('figure').count());
await nav.close();