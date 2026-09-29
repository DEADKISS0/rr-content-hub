import { chromium } from 'playwright';
const nav = await chromium.launch();

// Replica EXACTAMENTE el bloque de la ficha: iframe 200x340 DENTRO de una
// pagina con CSP identico al nuestro.
const casos = [
  ['1-limpio',       null],
  ['2-csp-completo', "default-src 'self'; script-src 'self' 'unsafe-inline' https://platform.instagram.com; style-src 'self' 'unsafe-inline' https://platform.instagram.com; img-src 'self' data: blob: https:; media-src 'self' blob: https:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-src 'self' https://www.instagram.com https://instagram.com https://www.tiktok.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"],
  ['3-solo-frame',   "frame-src 'self' https://www.instagram.com https://instagram.com"],
];
for (const [nombre, csp] of casos) {
  const ctx = await nav.newContext({ viewport: { width: 300, height: 420 }, locale: 'es-ES' });
  const pg = await ctx.newPage();
  if (csp) {
    await ctx.route('**/*', async (r) => {
      const h = { ...r.request().headers(), 'content-security-policy': csp };
      await r.continue({ headers: h });
    });
  }
  await pg.setContent(`<body style="margin:0;background:#070001">
    <iframe src="https://www.instagram.com/reel/Dbs5ndARCKW/embed/" style="width:200px;height:340px;border:0"></iframe></body>`);
  await pg.waitForTimeout(7000);
  await pg.locator('iframe').screenshot({ path: '/tmp/csp-' + nombre + '.png' });
  console.log(nombre, 'capturado');
  await ctx.close();
}
await nav.close();