import { chromium } from 'playwright';
import fs from 'node:fs';
const nav = await chromium.launch();
for (const sc of process.argv.slice(2)) {
  const ctx = await nav.newContext({ viewport: { width: 320, height: 480 }, locale: 'es-ES' });
  const pg = await ctx.newPage();
  await pg.setContent('<body style="margin:0"></body>');
  await pg.evaluate(() => { window.__m = []; window.addEventListener('message', (e) => { try { const d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; window.__m.push(d && d.type); } catch (err) {} }); });
  await pg.evaluate((s) => { const f = document.createElement('iframe'); f.id='f'; f.src = 'https://www.instagram.com/reel/' + s + '/embed/'; f.style.cssText='width:260px;height:462px;border:0'; document.body.appendChild(f); }, sc);
  await pg.waitForTimeout(5000);
  for (let i = 0; i < 4; i++) { await pg.evaluate(() => { try { document.getElementById('f').contentWindow.postMessage('resize','*'); } catch (e) {} }); await pg.waitForTimeout(1400); }
  const m = await pg.evaluate(() => window.__m);
  console.log(sc.padEnd(14) + (m.includes('MEASURE') ? 'VIVO' : 'ROTO') + '  (' + m.join(',') + ')');
  await ctx.close();
}
await nav.close();