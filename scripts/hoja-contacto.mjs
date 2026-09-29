import { chromium } from 'playwright';
import fs from 'node:fs';
const dir = '/tmp/miniaturas';
const archivos = fs.readdirSync(dir).filter((f) => f.endsWith('.jpg'));
const cols = 6;
const filas = Math.ceil(archivos.length / cols);
const celdas = archivos.map((f) => {
  const b = fs.readFileSync(dir + '/' + f).toString('base64');
  return '<div style="width:180px"><img src="data:image/jpeg;base64,' + b + '" style="width:170px;height:220px;object-fit:cover;display:block;border:1px solid #333"/><div style="font:10px monospace;color:#aaa">' + f.replace('.jpg','') + '</div></div>';
}).join('');
const html = '<body style="margin:0;background:#111"><div style="display:flex;flex-wrap:wrap;gap:4px;padding:6px">' + celdas + '</div></body>';
fs.writeFileSync('/tmp/hoja.html', html);
const nav = await chromium.launch();
const pg = await nav.newPage({ viewport: { width: cols * 186, height: filas * 250 } });
await pg.goto('file:///tmp/hoja.html', { waitUntil: 'load' });
await pg.waitForTimeout(1200);
await pg.screenshot({ path: '/tmp/hoja.jpg', fullPage: true });
console.log('hoja con', archivos.length, 'fotos');
await nav.close();