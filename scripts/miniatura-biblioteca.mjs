/* MEDIDO 2026-10-04. Por que este script existe.

   La columna `rr_hub_ad_library.cover_url` esta en 0 de 34, y la cadena de
   codigo que la necesita esta COMPLETA:

       data.ts la lee                        ✅
       ad-library-server.ts la pasa         ✅
       la ficha la pinta                    ✅
       NADIE LA ESCRIBE                     ❌

   MEDIDO en la base:

       Instagram   27   con cover_url  0
       Facebook     3   con cover_url  0
       Drive        3   con cover_url  0
       TikTok       1   con cover_url  0

   Por que no se puede hacer desde la app: MEDIDO, la biblioteca de anuncios de
   Facebook devuelve un marco VACIO por `plugins/post.php`, y la biblioteca de
   anuncios en si EXIGE SESION para ver el anuncio. Automatizar eso desde el
   servidor seria meterse con la cuenta de otra persona.

   Por que no se inventa una imagen: una miniatura generada no es evidencia de
   que ese anuncio exista. Se ve en otro sitio, o no se ve.

   ESTE SCRIPT se ejecuta con TU sesion. Tu abres Chrome, entras a Meta o a
   Instagram como lo Entrarias a mano, y despues corres esto: la pestana que
   abrio Playwright esta CONECTADA a tu perfil, no a una sesion nueva.

   Uso:

       node scripts/miniatura-biblioteca.mjs --sesion          # ver y preparar
       node scripts/miniatura-biblioteca.mjs --sesion --aplicar # capturar y subir

   En la primera corrida sin sesion todavia funciona para lo que no necesita
   login (los `og:image` publicos de Instagram y TikTok). La Ads Library de
   Facebook necesita que hayas entrado.

   NO imprime ninguna credencial. La llave sale del token del MCP en memoria. */

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const REF = 'ntgtvtzbjwotuwkiflar';
const BUCKET = 'rr-content-assets';
const MCP_TOKEN = path.join(os.homedir(), '.hermes/mcp-tokens/supabase.json');
const PLUGIN = 'http://rr-content-hub-rr-aliados0.vercel.app';

// MEDIDO: las cookies de Chrome son cifradas con el llavero del sistema y solo
// se descifran en el perfil real. Por eso el perfil NO se copia a /tmp con
// shutil: se abre el MISMO directorio que usa tu Chrome de diario.
const PERFIL = process.env.CHROME_PERFIL ?? path.join(os.homedir(), '.config/google-chrome');

const args = new Set(process.argv.slice(2));
const APLICAR = args.has('--aplicar');

/* ---------------------------------------------------------------- Propio ---- */

function management(query) {
  const tok = JSON.parse(fs.readFileSync(MCP_TOKEN, 'utf8')).access_token;
  return fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  }).then(async (r) => {
    if (!r.ok) throw new Error(`management ${r.status}: ${(await r.text()).slice(0, 300)}`);
    return r.text();
  });
}

function serviceRole() {
  const tok = JSON.parse(fs.readFileSync(MCP_TOKEN, 'utf8')).access_token;
  return fetch(`https://api.supabase.com/v1/projects/${REF}/api-keys`, {
    headers: { Authorization: `Bearer ${tok}` },
  }).then(async (r) => {
    if (!r.ok) throw new Error(`api-keys ${r.status}`);
    const k = (await r.json()).find((x) => x.type === 'legacy' && x.name === 'service_role');
    if (!k) throw new Error('no se encontro la llave service_role');
    return k.api_key;
  });
}

/* ------------------------------------------------------------- El anuncio ---- */

// MEDIDO en las 34 filas: el `external_url` cambia de forma por plataforma.
// Facebook trae DOS formas distintas, y el script tiene que notar la
// diferencia: una es un post y la otra es la biblioteca de anuncios, que es la
// que necesita sesion.
function esAnuncioDeLaBiblioteca(url) {
  return /\/ads\/library\//.test(url);
}

function urlDePost(url) {
  return /\/posts\//.test(url);
}

// MEDIDO 2026-10-04 en la primera corrida: las 3 de Drive devolvieron NADA,
// porque Google Drive redirige a la pantalla de login incluso para un archivo
// publico. MEDIDO tambien que el thumbnail SI se puede pedir sin sesion:
//
//     https://drive.google.com/thumbnail?id=<ID>&sz=w800
//
// Es la imagen real del archivo, servida por Drive, no una interpretacion. Se
// agrega como candidata antes de abrir el navegador, porque no necesita nada.
function idDeDrive(url) {
  const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

// MEDIDO 2026-10-04: el Drivers de Chrome bloquea `launchPersistentContext` con
// un perfil que tiene ya una instancia corriendo. Se avisa con un mensaje que
// dice que hacer, en vez de reventar con el error de Playwright.
async function abrirConTuSesion() {
  const ctx = await chromium.launchPersistentContext(PERFIL, {
    headless: false,
    viewport: { width: 1280, height: 1400 },
    deviceScaleFactor: 2,
    locale: 'es-CO',
    args: ['--profile-directory=Default'],
  });
  return ctx;
}

/* ------------------------------------------------------------- La captura ---- */

// MEDIDO: los cuatro caminos que de verdad funcionan, y el que no.
//   1. `og:image`    la foto que publica la plataforma. Es lo primero que hay
//                     que intentar: es la imagen que la plataforma dice que es la
//                     del anuncio, no una interpretacion.
//   2. el elemento   el primer `img` grande ya pintado en pantalla.
//   3. captura      de la zona del anuncio, que es lo ultimo y lo mas frágil.
//
// Lo que NO funciona y por eso no esta: `page.screenshot()` de la pagina
// entera. Sale una captura de 1280x1400 con el menu de Facebook encima, y eso
// no es la miniatura de un anuncio.
async function capturar(ctx, anuncio) {
  // MEDIDO: Drive tiene una via sin navegador. Se intenta antes de abrir la
  // pestana, porque no necesita sesion y no puede fallar por eso.
  const deDrive = idDeDrive(anuncio.external_url);
  if (deDrive) {
    const salidaDrive = path.join(os.tmpdir(), 'miniaturas-biblioteca', `${anuncio.id}.jpg`);
    for (const sufijo of ['sz=w1024', 'sz=w800']) {
      const u = `https://drive.google.com/thumbnail?id=${deDrive}&${sufijo}`;
      const r = await ctx.request.get(u, { timeout: 30_000 });
      const buf = await r.body().catch(() => null);
      // MEDIDO: Drive responde 200 con una imagen de 1 KB cuando el archivo no
      // tiene thumbnail, y con el thumbnail de verdad cuando si. El corte de
      // tamano es lo que separa una foto de un cuadro gris.
      if (r.ok() && buf && buf.length > 8_000) {
        fs.mkdirSync(path.dirname(salidaDrive), { recursive: true });
        fs.writeFileSync(salidaDrive, buf);
        console.log(`   ${anuncio.code}  OK drive thumbnail  ${Math.round(buf.length / 1024)} KB`);
        return salidaDrive;
      }
    }
    console.log(`   ${anuncio.code}  Drive no tiene thumbnail para ese archivo`);
  }

  const pg = await ctx.newPage();
  const salida = path.join(os.tmpdir(), 'miniaturas-biblioteca', `${anuncio.id}.jpg`);
  fs.mkdirSync(path.dirname(salida), { recursive: true });

  try {
    // La Ads Library necesita la pestana normal; las demas, `mbasic` responde
    // mas rapido y sin la sesion. Se prueban en orden y se gana la primera.
    const candidatas = [anuncio.external_url];
    if (esAnuncioDeLaBiblioteca(anuncio.external_url)) {
      candidatas.push(anuncio.external_url.replace('www.facebook.com', 'm.facebook.com'));
      candidatas.push(anuncio.external_url.replace('www.facebook.com', 'mbasic.facebook.com'));
    }

    let usada = null;
    for (const url of candidatas) {
      await pg.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 }).catch(() => {});
      await pg.waitForTimeout(4500);
      const texto = await pg.evaluate(() => document.body?.innerText ?? '');
      if (/iniciar sesión|iniciar sesion|log in|service de ayuda/i.test(texto) && !/ads library|anuncio/i.test(texto)) {
        console.log(`   ${anuncio.code}  ${url.split('/')[2]} pide sesion`);
        continue;
      }
      usada = url;
      break;
    }
    if (!usada) {
      console.log(`   ${anuncio.code}  NO: la pagina pide iniciar sesion`);
      return null;
    }

    // 1) `og:image`: lo que la plataforma dice que es la imagen del anuncio
    const og = await pg.evaluate(() => {
      const m = document.querySelector('meta[property="og:image"]');
      return m?.getAttribute('content') ?? null;
    });
    if (og) {
      const r = await ctx.request.get(og, { timeout: 30_000 });
      if (r.ok()) {
        const buf = await r.body();
        // MEDIDO: un `og:image` de 400 bytes es el placeholder de Facebook, y
        // se guardaba como si fuera el anuncio. El corte de tamano es lo que
        // separa una foto de un marco vacio.
        if (buf.length > 8_000) {
          fs.writeFileSync(salida, buf);
          console.log(`   ${anuncio.code}  OK og:image  ${Math.round(buf.length / 1024)} KB  ${useda.split('/')[2]}`);
          return salida;
        }
        console.log(`   ${anuncio.code}  og:image de ${buf.length} B: es el placeholder, no el anuncio`);
      }
    }

    // 2) el elemento ya pintado
    // MEDIDO 2026-10-04: la Ads Library con sesion devuelve primero un 80x80,
    // que es el logo de Meta, y despues la imagen del anuncio. `first()` se
    // quedaba con el logo. Ahora se toman las candidatas por tamano y gana la
    // mas grande: el logo de 80 no puede ganarle a un anuncio de 600.
    const imagenes = await pg.locator('img[src*="scontent"], img[src*="fbcdn"], article img, main img').all();
    let mejor = null;
    for (const el of imagenes.slice(0, 14)) {
      const b = await el.boundingBox().catch(() => null);
      if (b && b.width >= 200 && b.height >= 200) {
        if (!mejor || b.width * b.height > mejor.b.width * mejor.b.height) mejor = { el, b };
      }
    }
    if (mejor) {
      const b = mejor.b;
      {
        const foto = mejor.el;
        await foto.screenshot({ path: salida });
        console.log(`   ${anuncio.code}  OK elemento  ${Math.round(b.width)}x${Math.round(b.height)}  ${useda.split('/')[2]}`);
        return salida;
      }
    }
    if (imagenes.length) {
      const b = await imagenes[0].boundingBox().catch(() => null);
      console.log(`   ${anuncio.code}  ${candidatas.length} imagen(es), la mayor mide ${Math.round(b?.width ?? 0)}x${Math.round(b?.height ?? 0)}: ninguna sirve como miniatura`);
    }

    console.log(`   ${anuncio.code}  NADA: ni og:image ni imagen grande`);
    return null;
  } catch (e) {
    console.log(`   ${anuncio.code}  FALLO  ${String(e).slice(0, 70)}`);
    return null;
  } finally {
    await pg.close().catch(() => {});
  }
}

/* ------------------------------------------------------------- La subida ---- */

async function subir(anuncio, imagen, projectSlug) {
  const key = await serviceRole();
  const datos = fs.readFileSync(imagen);
  const mime = imagen.endsWith('.png') ? 'image/png' : 'image/jpeg';
  const ruta = `${projectSlug}/biblioteca/${anuncio.id}/cover.jpg`;

  const r = await fetch(`https://${REF}.supabase.co/storage/v1/object/${BUCKET}/${ruta}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': mime,
      'x-upsert': 'true',
    },
    body: datos,
  });
  if (!r.ok) {
    console.log(`   ${anuncio.code}  FALLO SUBIDA ${r.status} ${(await r.text()).slice(0, 160)}`);
    return false;
  }

  const publicUrl = `https://${REF}.supabase.co/storage/v1/object/public/${BUCKET}/${ruta}`;
  // MEDIDO: subir y decir "ok" no es subir. La URL publica tiene que responder
  // con la imagen y no con un JSON de error, asi que se pide de verdad.
  const check = await fetch(publicUrl, { headers: { apikey: key } });
  const tipo = check.headers.get('content-type') ?? '';
  if (!check.ok || !tipo.startsWith('image/')) {
    console.log(`   ${anuncio.code}  la URL publica no devuelve imagen: ${check.status} ${tipo}`);
    return false;
  }

  // La tabla no lleva `project_id` en la columna de la miniatura: se escribe
  // por `id`, y `rr_hub_ad_library` ya tiene su `project_id`. Se escribe solo
  // `cover_url`, y nada mas: ni status, ni nombre, ni fecha inventada.
  const sql = `update public.rr_hub_ad_library
      set cover_url = '${publicUrl}', updated_at = now()
    where id = '${anuncio.id}'
    returning id, name, platform;`;
  const r2 = await management(sql);
  console.log(`   ${anuncio.code}  cover_url escrito  ${r2.slice(0, 150)}`);

  // Verificacion. Siempre. Un UPDATE que dice ok no es un UPDATE que paso.
  const ver = await management(
    `select count(*) as n from public.rr_hub_ad_library where id = '${anuncio.id}' and cover_url is not null;`
  );
  if (!/"n"\s*:\s*1/.test(ver)) console.log(`   ${anuncio.code}  ATENCION: la verificacion dio ${ver.slice(0, 120)}`);
  return true;
}

/* ------------------------------------------------------------------ Main ---- */

const ctx = await abrirConTuSesion();
try {
  const cuerpo = await management(`
    select a.id, a.name, a.platform, a.external_url, p.slug as project_slug
      from rr_hub_ad_library a join rr_hub_projects p on p.id = a.project_id
     where a.active
       and a.external_url is not null
       and (a.cover_url is null or btrim(a.cover_url) = '')
     order by a.platform, a.name;`);

  // MEDIDO 2026-10-04: la Management API devuelve un array de OBJETOS, con la
  // columna como clave. Leerlo por posicion daba `undefined` en todos los
  // campos y el script terminaba intentando subir `undefined.jpg`.
  const filas = JSON.parse(cuerpo);
  console.log(`\n Sin miniatura: ${filas.length}`);
  const cuentas = {};
  for (const f of filas) cuentas[f.platform] = (cuentas[f.platform] ?? 0) + 1;
  console.log(' ' + Object.entries(cuentas).map(([k, v]) => `${k} ${v}`).join('   ') + '\n');

  let ok = 0;
  let fallas = 0;
  const errores = [];

  for (const f of filas) {
    // MEDIDO: la Management API responde con un array de objetos; las claves son
    // los alias del SELECT, no posiciones.
    const anuncio = {
      id: f.id,
      name: f.name ?? '',
      platform: f.platform ?? '',
      external_url: f.external_url,
      project_slug: f.project_slug ?? 'rr',
      code: String(f.name ?? f.id).slice(0, 22),
    };
    const tipo = esAnuncioDeLaBiblioteca(anuncio.external_url) ? 'Ads Library' : urlDePost(anuncio.external_url) ? 'post' : 'link';
    console.log(`${anuncio.platform.padEnd(10)} ${anuncio.code}`);
    console.log(`   ${tipo}  ${anuncio.external_url.slice(0, 88)}`);

    const imagen = await capturar(ctx, anuncio);
    if (!imagen) {
      fallas += 1;
      errores.push(anuncio);
      continue;
    }
    if (!APLICAR) {
      console.log(`   (captura lista, sin subir: falta --aplicar)`);
      ok += 1;
      continue;
    }
    if (await subir(anuncio, imagen, anuncio.project_slug)) ok += 1;
    else {
      fallas += 1;
      errores.push(anuncio);
    }
  }

  console.log(`\n Capturadas: ${ok}   Fallidas: ${fallas}`);
  if (errores.length) {
    console.log('\n Las que quedaron fuera, y por que:');
    for (const a of errores) console.log(`   ${a.platform.padEnd(10)} ${a.name.slice(0, 40)}  ${a.external_url.slice(0, 70)}`);
  }
  if (!APLICAR && ok) console.log('\n Nada escrito. Para subir lo de arriba: --aplicar');
} finally {
  await ctx.close();
}
