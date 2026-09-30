import { chromium } from 'playwright';
const nav = await chromium.launch();
const ctx = await nav.newContext({
  viewport: { width: 412, height: 900 }, deviceScaleFactor: 2,
  userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36',
});
const pg = await ctx.newPage();
const base = 'https://rr-content-hub.vercel.app';
await pg.goto(base + '/login', { waitUntil: 'domcontentloaded' });

// 1. manifest
const mf = await pg.evaluate(async () => {
  const r = await fetch('/manifest.webmanifest');
  return { status: r.status, body: r.ok ? await r.json() : null };
});
console.log('manifest', mf.status, mf.body ? mf.body.short_name + ' | ' + mf.body.display + ' | iconos: ' + mf.body.icons.length : 'AUSENTE');

// 2. service worker
const sw = await pg.evaluate(async () => {
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? { scope: reg.scope, activo: !!(reg.active || reg.installing || reg.waiting) } : null;
});
console.log('service worker', JSON.stringify(sw));

// 3. claves de iOS / manifest en el HTML
const html = await pg.content();
for (const k of ['manifest.webmanifest', 'apple-mobile-web-app-capable', 'apple-touch-icon', 'apple-mobile-web-app-title', 'theme-color']) {
  console.log('html:', k, html.includes(k) ? 'SI' : 'NO');
}

// 4. el SW responde y trae la version
const swFichero = await pg.evaluate(async () => {
  const r = await fetch('/sw.js');
  return { status: r.status, version: (await r.text()).match(/rr-hub-v\d+/)?.[0], swAllowed: r.headers.get('service-worker-allowed') };
});
console.log('sw.js', JSON.stringify(swFichero));

// 5. cabeceras reales del manifest
const cab = await pg.evaluate(async () => {
  const r = await fetch('/manifest.webmanifest');
  return r.headers.get('cache-control');
});
console.log('manifest cache-control:', cab);

// 6. icono: que se descarga de verdad
const ic = await pg.evaluate(async () => {
  const r = await fetch('/app/icono-512.png');
  const b = await r.blob();
  return { status: r.status, tipo: b.type, bytes: b.size };
});
console.log('icono-512', JSON.stringify(ic));

// 7. instalabilidad real de Chrome
const inst = await pg.evaluate(async () => {
  const m = await fetch('/manifest.webmanifest').then((r) => r.json());
  return { tiene192: m.icons.some((i) => i.sizes === '192x192'), tiene512: m.icons.some((i) => i.sizes === '512x512'), nombre: !!m.name, display: m.display, start: m.start_url };
});
console.log('instalable:', JSON.stringify(inst));

await pg.screenshot({ path: '/tmp/pwa-android.png' });
await nav.close();