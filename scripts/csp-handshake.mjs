import { chromium } from 'playwright';
const nav = await chromium.launch();

// El MISMO embed, la MISMA llamada al resize, en nuestra pagina de verdad y en
// una limpia. Si en una llega MEASURE y en la otra no, el bloqueo es del CSP.
const casos = [
  ['nuestra-ficha', true],
  ['limpia', false],
];
for (const [nombre, enElHub] of casos) {
  const ctx = await nav.newContext({ viewport: { width: 420, height: 900 }, locale: 'es-ES' });
  const pg = await ctx.newPage();
  await pg.exposeFunction('__nada', () => {});
  if (enElHub) {
    await pg.goto('https://rr-content-hub.vercel.app/login', { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(1200);
  } else {
    await pg.setContent('<body style="margin:0">');
  }
  await pg.evaluate(() => {
    window.__msgs = [];
    window.addEventListener('message', (e) => window.__msgs.push(e.origin + ' :: ' + (e.data && e.data.type)));
  });
  await pg.evaluate(() => {
    const f = document.createElement('iframe');
    f.src = 'https://www.instagram.com/reel/Dbs5ndARCKW/embed/';
    f.style.cssText = 'width:260px;height:462px;border:0';
    f.id = 'probe';
    document.body.appendChild(f);
  });
  await pg.waitForTimeout(4000);
  for (let i = 0; i < 5; i++) {
    await pg.evaluate(() => { const w = document.getElementById('probe').contentWindow; try { w.postMessage('resize', '*'); } catch (e) {} });
    await pg.waitForTimeout(1200);
  }
  const msgs = await pg.evaluate(() => window.__msgs);
  console.log(nombre.padEnd(14) + ' mensajes: ' + msgs.length + '  ->  ' + (msgs.slice(0, 3).join(' | ') || 'NINGUNO'));
  await ctx.close();
}
await nav.close();