import { chromium } from 'playwright';
const nav = await chromium.launch();

// ¿Instagram avisa si se le carga su propio script de embeds? Meta documenta que
// sin `embeds.js` el embed se PINTA pero no dispara `onRender`.
for (const [nombre, conScript] of [['sin-script', false], ['con-embeds.js', true]]) {
  const ctx = await nav.newContext({ viewport: { width: 320, height: 480 }, locale: 'es-ES' });
  const pg = await ctx.newPage();
  const recibido = await pg.evaluate(() => { window.__m = []; return 0; }).catch(() => 0);
  await pg.exposeFunction('__anota', (t) => {});
  await pg.setContent(`<body style="margin:0">
    ${conScript ? '<script async src="https://platform.instagram.com/en_US/embeds.js"></script>' : ''}
    <iframe id="f" src="https://www.instagram.com/reel/Dbs5ndARCKW/embed/" style="width:260px;height:462px;border:0"></iframe>
    <script>
      window.__msgs = [];
      window.addEventListener('message', (e) => window.__msgs.push(e.origin + ' :: ' + JSON.stringify(e.data).slice(0, 90)));
      setInterval(() => { const w = document.getElementById('f').contentWindow; try { w.postMessage('resize', '*'); } catch (err) {} }, 1000);
    </script></body>`);
  await pg.waitForTimeout(16000);
  const msgs = await pg.evaluate(() => window.__msgs);
  console.log(nombre + ' -> mensajes recibidos: ' + msgs.length);
  for (const m of msgs.slice(0, 5)) console.log('    ' + m);
  await ctx.close();
}
await nav.close();