import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';

/**
 * Captura la miniatura REAL de un post de Instagram, tal como la pinta la
 * propia plataforma, y la guarda.
 *
 * Por qué un navegador y no `fetch`: Instagram devuelve 646 KB de muro de login
 * a un cliente HTTP, con o sin User-Agent, para CUALQUIER post (medido: dos
 * posts distintos devuelven 646656 y 646651 bytes — la misma página). El
 * navegador sí lo ve. La diferencia no es el token, es que Instagram decide
 * qué mostrar según la prueba de que hay alguien delante.
 *
 * Lo que se guarda NO es inventado: es el fotograma que Instagram está
 * mostrando en ese momento, de ese post.
 */
const lista = JSON.parse(readFileSync('/tmp/posts.json', 'utf8'));
const nav = await chromium.launch();

for (const { codigo, shortcode } of lista) {
  const ctx = await nav.newContext({
    viewport: { width: 520, height: 900 },
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
    locale: 'es-ES',
  });
  const pg = await ctx.newPage();
  // Probar TODAS las formas de embed: un reel puede rejecting solo en una.
  const variantes = [
    `/reel/${shortcode}/embed/`,
    `/p/${shortcode}/embed/`,
    `/p/${shortcode}/embed/captioned/`,
    `/reel/${shortcode}/embed/captioned/`,
  ];
  let ok = false;
  for (const v of variantes) {
    await pg.goto(`https://www.instagram.com${v}`, { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(2600);
    const t2 = await pg.evaluate(() => document.body.innerText.slice(0, 200));
    const roto = /incorrecto o que se haya suprimido|incorrect or may have been removed|removed or unavailable/i.test(t2);
    const img = await pg.evaluate(() => {
      const i = [...document.querySelectorAll('img')].find((x) => x.naturalWidth > 200 && (x.currentSrc||x.src).startsWith('http') && !(x.currentSrc||x.src).includes('profile_pic'));
      return i ? { src: i.currentSrc || i.src, w: i.naturalWidth, h: i.naturalHeight } : null;
    });
    console.log(`  ${v.padEnd(38)} ${roto ? 'ROTO' : 'ok'} img=${img ? img.w + 'x' + img.h : 'ninguna'}`);
    if (!roto && img) {
      console.log(`  USABLE: ${v}`);
      const buf = await pg.request.get(img.src);
      const ext = img.src.includes('.png') ? 'png' : 'jpg';
      writeFileSync(`/tmp/ig-${codigo}.${ext}`, await buf.body());
      console.log(`  GUARDADO /tmp/ig-${codigo}.${ext}`);
      ok = true;
      break;
    }
  }
  // El embed puede estar bloqueado (Instagram lo restringe por publicación y por
  // cuenta) mientras la PUBLICACIÓN sigue existiendo. Entonces la foto se saca
  // de la página normal, que sí la sirve, y no del embed.
  if (!ok) {
    console.log('  el embed no sirve; se intenta la pagina normal');
    await pg.goto(`https://www.instagram.com/reel/${shortcode}/`, { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(4000);
    const cerrar2 = pg.getByRole('button', { name: /cerrar/i });
    if (await cerrar2.count()) { await cerrar2.first().click().catch(() => {}); await pg.waitForTimeout(900); }
    const t3 = await pg.evaluate(() => document.body.innerText.slice(0, 160));
    console.log('  pagina normal:', t3.replace(/\n+/g, ' | ').slice(0, 130));
    const datos2 = await pg.evaluate(() => {
      const imgs = [...document.querySelectorAll('img')]
        .map((i) => ({ src: i.currentSrc || i.src, w: i.naturalWidth, h: i.naturalHeight }))
        .filter((i) => i.w > 250 && i.src.startsWith('http') && !i.src.includes('profile_pic') && !i.src.includes('sprite'));
      imgs.sort((a, b) => b.w * b.h - a.w * a.h);
      return imgs[0] || null;
    });
    if (datos2) {
      const buf = await pg.request.get(datos2.src);
      const ext = datos2.src.includes('.png') ? 'png' : 'jpg';
      writeFileSync(`/tmp/ig-${codigo}.${ext}`, await buf.body());
      console.log(`  GUARDADO /tmp/ig-${codigo}.${ext} desde la pagina normal (${datos2.w}x${datos2.h})`);
    } else {
      console.log('  la pagina normal tampoco dio imagen');
    }
    await ctx.close();
    continue;
  }
  await ctx.close();
  continue;

  // cerrar el dialogo de registro si aparece
  const cerrar = pg.getByRole('button', { name: /cerrar/i });
  if (await cerrar.count()) { await cerrar.first().click().catch(() => {}); await pg.waitForTimeout(800); }
  // el <img> real del post: es el de mayor area
  const datos = await pg.evaluate(() => {
    const imgs = [...document.querySelectorAll('img')]
      .map((i) => ({ src: i.currentSrc || i.src, w: i.naturalWidth, h: i.naturalHeight, alt: (i.alt || '').slice(0, 60) }))
      .filter((i) => i.w > 150 && i.src.startsWith('http') && !i.src.includes('profile_pic') && !i.src.includes('sprite'));
    imgs.sort((a, b) => b.w * b.h - a.w * a.h);
    return { imgs: imgs.slice(0, 3), texto: document.body.innerText.slice(0, 300) };
  });
  console.log(`\n=== ${codigo} (${shortcode}) ===`);
  console.log('  texto:', datos.texto.replace(/\n+/g, ' | ').slice(0, 180));
  for (const im of datos.imgs) console.log(`  ${im.w}x${im.h} ${im.src.slice(0, 105)} | ${im.alt}`);
  if (datos.imgs.length) {
    const buf = await pg.request.get(datos.imgs[0].src);
    const bytes = await buf.body();
    const ext = datos.imgs[0].src.includes('.png') ? 'png' : 'jpg';
    writeFileSync(`/tmp/ig-${codigo}.${ext}`, bytes);
    console.log(`  GUARDADO /tmp/ig-${codigo}.${ext} (${bytes.length} bytes)`);
  }
  await ctx.close();
}
await nav.close();
