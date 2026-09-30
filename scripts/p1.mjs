import { chromium } from 'playwright';
const nav = await chromium.launch();
const ctx = await nav.newContext({
  viewport: { width: 412, height: 900 }, deviceScaleFactor: 2,
  userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36',
});
const pg = await ctx.newPage();
const base = 'https://rr-content-hub.vercel.app';
await pg.goto(base + '/login', { waitUntil: 'networkidle' });

const mf = await pg.evaluate(async () => {
  const r = await fetch('/manifest.webmanifest');
  const m = await r.json();
  return { status: r.status, nombre: m.name, corto: m.short_name, display: m.display,
    iconos: m.icons.length, maskable: m.icons.filter((i) => i.purpose === 'maskable').length,
    inicio: m.start_url, color: m.theme_color };
});
console.log('MANIFEST', JSON.stringify(mf));

const sw = await pg.evaluate(async () => {
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? { ambito: reg.scope, activo: !!(reg.active || reg.installing || reg.waiting) } : null;
});
console.log('SW', JSON.stringify(sw));

const html = await pg.content();
for (const k of ['manifest.webmanifest', 'apple-mobile-web-app-capable', 'apple-touch-icon.png', 'apple-mobile-web-app-title', 'theme-color'])
  console.log('html', k, html.includes(k) ? 'SI' : 'NO');

const ic = await pg.evaluate(async () => {
  const r = await fetch('/app/icono-512.png');
  const b = await r.blob();
  return { status: r.status, tipo: b.type, kb: (b.size/1024).toFixed(1) };
});
console.log('icono-512', JSON.stringify(ic));

// ¿Chrome lo considera instalable? Su propio criterio, no el mio.
const cr = await pg.context().newCDPSession(pg);
await cr.send('Page.enable');
const m2 = await cr.send('Page.getAppManifest');
console.log('CHROME manifest url=', m2.url, 'errores=', JSON.stringify(m2.errors));
const inst = await pg.evaluate(() => {
  return { display: matchMedia('(display-mode: standalone)').matches, soportado: 'serviceWorker' in navigator };
});
console.log('standalone ahora:', inst.soportado, '| display-mode:', inst.display);

await pg.screenshot({ path: '/tmp/pwa-final.png' });
await nav.close();