import { chromium } from 'playwright';
const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 320, height: 480 }, locale: 'es-ES' });
const pg = await ctx.newPage();
// el listener ANTES de que exista el iframe, como hace el componente real
await pg.goto('about:blank');
await pg.evaluate(() => {
  window.__m = [];
  window.addEventListener('message', (e) => window.__m.push({ o: e.origin, t: typeof e.data, v: typeof e.data === 'string' ? e.data.slice(0, 70) : JSON.stringify(e.data).slice(0, 70) }));
});
await pg.setContent('<body style="margin:0"></body>');
await pg.evaluate(() => {
  const f = document.createElement('iframe');
  f.id = 'f'; f.src = 'https://www.instagram.com/reel/Dbs5ndARCKW/embed/';
  f.style.cssText = 'width:260px;height:462px;border:0';
  document.body.appendChild(f);
});
await pg.waitForTimeout(5000);
for (let i = 0; i < 4; i++) { await pg.evaluate(() => { try { document.getElementById('f').contentWindow.postMessage('resize', '*'); } catch (e) {} }); await pg.waitForTimeout(1500); }
const m = await pg.evaluate(() => window.__m);
console.log('total mensajes:', m.length);
for (const x of m) console.log('  typeof =', x.t.padEnd(7), '| valor:', x.v);
await nav.close();