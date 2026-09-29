import { chromium } from 'playwright';
import fs from 'node:fs';
const OUT = '/tmp/miniaturas';
fs.mkdirSync(OUT, { recursive: true });
const lista = JSON.parse(fs.readFileSync(process.argv[2] ?? '/tmp/anuncios.json', 'utf8'));
const nav = await chromium.launch();
for (const ad of lista) {
  const { shortcode, tipo, codigo } = ad;
  const destino = `${OUT}/${shortcode}.jpg`;
  if (fs.existsSync(destino) && fs.statSync(destino).size > 4000) { console.log(`${shortcode}  ya existe`); continue; }
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 1400 }, locale: 'es-ES', deviceScaleFactor: 2 });
  const pg = await ctx.newPage();
  const url = `https://www.instagram.com/${tipo === 'post' ? 'p' : 'reel'}/${shortcode}/`;
  try {
    await pg.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await pg.waitForTimeout(6000);
    // 1) la foto que publica la plataforma
    const og = await pg.evaluate(() => {
      const m = document.querySelector('meta[property="og:image"]');
      return m ? m.getAttribute('content') : null;
    });
    if (og) {
      const r = await ctx.request.get(og, { timeout: 30_000 });
      if (r.ok()) {
        const buf = await r.body();
        fs.writeFileSync(destino, buf);
        console.log(`${shortcode}  ${codigo ?? ''}  OK  ${Math.round(buf.length / 1024)} KB  og:image`);
        await ctx.close();
        continue;
      }
      console.log(`${shortcode}  og:image no descargable (${r.status()})`);
    } else {
      console.log(`${shortcode}  sin og:image`);
    }
    // 2) respaldo: fotografiar el post ya pintado en pantalla
    await pg.waitForTimeout(3000);
    const foto = pg.locator('article img, main img').first();
    if (await foto.count()) {
      await foto.screenshot({ path: destino });
      console.log(`${shortcode}  ${codigo ?? ''}  captura de pantalla`);
    } else {
      console.log(`${shortcode}  ${codigo ?? ''}  NADA`);
    }
  } catch (e) {
    console.log(`${shortcode}  FALLO  ${String(e).slice(0, 60)}`);
  }
  await ctx.close();
}
await nav.close();