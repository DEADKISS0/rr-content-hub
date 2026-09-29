import { chromium } from 'playwright';
import fs from 'node:fs';
const dir = process.argv[2];
const nav = await chromium.launch();
const pg = await nav.newPage({ viewport: { width: 1080, height: 1350 } });
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.svg'))) {
  await pg.setContent('<body style="margin:0">' + fs.readFileSync(dir + '/' + f, 'utf8') + '</body>');
  await pg.waitForTimeout(200);
  const png = f.replace('.svg', '.png');
  await pg.screenshot({ path: dir + '/' + png, fullPage: true });
  console.log(png, Math.round(fs.statSync(dir + '/' + png).size / 1024) + ' KB');
}
await nav.close();