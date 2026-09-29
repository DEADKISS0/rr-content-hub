import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
const nav = await chromium.launch();
const pg = await nav.newPage({ viewport: { width: 1080, height: 1350 } });
for (const n of ['o1', 'o2']) {
  const svg = readFileSync('/tmp/portadas/' + n + '.svg', 'utf8');
  await pg.setContent('<style>html,body{margin:0;padding:0}</style>' + svg);
  const buf = await pg.screenshot({ type: 'png' });
  writeFileSync('/tmp/portadas/' + n + '.png', buf);
  console.log(n, buf.length, 'bytes');
}
await nav.close();