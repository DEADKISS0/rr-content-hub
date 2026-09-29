import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

// Hoja de contactos para REVISAR fotos antes de subirlas: las que sale de este
// script seDestinationn a /tmp y nunca se versionan. `vision_analyze` se cuelga
// con hojas grandes, asi que se hace en tandas de 9 y a media resolucion.
const ya = new Set(JSON.parse(fs.readFileSync('/tmp/ya-usadas.json', 'utf8')));
const todos = fs.readdirSync('/tmp/miniaturas')
  .filter((f) => f.endsWith('.jpg'))
  .map((f) => ({ n: f.replace('.jpg', ''), s: fs.statSync(`/tmp/miniaturas/${f}`).size }))
  .filter((x) => x.s > 20000 && !ya.has(x.n) && !x.n.startsWith('drive-'))
  .map((x) => x.n)
  .sort();

const LOTE = 9;
const nav = await chromium.launch();
for (let i = 0; i * LOTE < todos.length; i += 1) {
  const tanda = todos.slice(i * LOTE, (i + 1) * LOTE);
  const html = `<html><body style="margin:0;background:#111;display:grid;grid-template-columns:repeat(3,1fr);gap:3px">`
    + tanda.map((c) => `<div style="position:relative"><img src="file:///tmp/miniaturas/${c}.jpg" style="width:100%;height:200px;object-fit:cover;display:block"><span style="position:absolute;bottom:0;left:0;right:0;background:#000b;color:#fff;font:12px monospace;padding:2px 4px">${c}</span></div>`).join('')
    + '</body></html>';
  const tmp = `/tmp/hoja-${i}.html`;
  fs.writeFileSync(tmp, html);
  const pg = await nav.newPage({ viewport: { width: 900, height: 620 }, deviceScaleFactor: 1 });
  await pg.goto(`file://${tmp}`, { waitUntil: 'load' });
  await pg.waitForTimeout(1200);
  await pg.screenshot({ path: `/tmp/hoja-${i}.png`, fullPage: true });
  await pg.close();
  console.log(`hoja ${i}: ${tanda.length} fotos -> /tmp/hoja-${i}.png`);
}
await nav.close();
