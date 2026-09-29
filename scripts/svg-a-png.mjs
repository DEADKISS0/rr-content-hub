import { chromium } from 'playwright';
import fs from 'node:fs';
const nav = await chromium.launch();
const pg = await nav.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
const svgs = fs.readdirSync('/tmp/portadas').filter((f) => f.endsWith('.svg'));
for (const f of svgs) {
  const svg = fs.readFileSync('/tmp/portadas/' + f, 'utf8');
  await pg.setContent('<body style="margin:0">' + svg + '</body>');
  await pg.waitForTimeout(300);
  const nombre = f.replace('.svg', '.png');
  await pg.screenshot({ path: '/tmp/portadas/' + nombre, fullPage: true });
  console.log(nombre, Math.round(fs.statSync('/tmp/portadas/' + nombre).size / 1024) + ' KB');
}
await nav.close();