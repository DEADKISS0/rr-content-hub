import { chromium } from 'playwright';
import fs from 'node:fs';

const URL = 'https://rr-content-hub.vercel.app';
const IDEA = fs.readFileSync('/tmp/idea_sonda.txt', 'utf8').trim();

async function cookieDe(correo) {
  const r = await fetch(`${URL}/api/entrar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ codigo: '1111', correo, nombre: 'Medida' }),
  });
  const bruto = r.headers.getSetCookie().find((c) => c.startsWith('hub_sesion='));
  return {
    name: 'hub_sesion', value: bruto.split(';')[0].split('=')[1],
    domain: 'rr-content-hub.vercel.app', path: '/', expires: 4102444800,
    httpOnly: true, secure: true, sameSite: 'Lax',
  };
}

async function votar(correo, decision, nota, token) {
  const r = await fetch(`${URL}/api/workspace/vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `hub_sesion=${(await cookieDe(correo)).value}` },
    body: JSON.stringify({ ideaId: IDEA, voterToken: `medida-${token}`, decision, note: nota ?? '' }),
  });
  return r.json();
}

const nav = await chromium.launch();

// tres personas, tres respuestas distintas
console.log('1) TRES PERSONAS VOTAN');
console.log('  tefa   ->', (await votar('tefaweb000@gmail.com', 'yes', '', 'a')).detalle);
console.log('  benit  ->', (await votar('benitezestiven122@gmail.com', 'no', '', 'b')).detalle);
console.log('  sthef  ->', (await votar('samugarc6@gmail.com', 'note', 'buena base', 'c')).detalle);

// y la vista, como la ve alguien que entra
const ctx = await nav.newContext({
  viewport: { width: 1440, height: 1100 },
  storageState: { cookies: [await cookieDe('santiago1209andres@gmail.com')], origins: [] },
});
const pg = await ctx.newPage();
await pg.goto(`${URL}/wundeer/ideas/${IDEA}`, { waitUntil: 'networkidle' });

const guia = pg.locator('[role="dialog"][aria-modal="true"]');
if (await guia.count()) {
  await guia.locator('button').last().click().catch(() => pg.keyboard.press('Escape'));
  await pg.waitForTimeout(400);
}

console.log('2) LO QUE SE VE');
const bloque = pg.locator('[data-guia="votacion"]').first();
await bloque.scrollIntoViewIfNeeded();
const svgs = await bloque.locator('svg').count();
console.log('  iconos en el bloque:', svgs);
const titulos = await bloque.locator('[title]').evaluateAll((e) => e.map((x) => x.getAttribute('title')));
console.log('  emojis con su nombre:', JSON.stringify(titulos));
const botones = await bloque.locator('button').allInnerTexts();
console.log('  botones:', JSON.stringify(botones.map((b) => b.split('\n')[0])));

// el rebote: se mide si la animacion existe al pulsar
// El chispazo dura 700 ms y se va solo. Mirarlo DESPUÉS del clic llega tarde:
// la petición al servidor tarda más que la animación, así que a veces se mide
// con la clase ya retirada. La forma fiable es mirar DURANTE, y también leer
// el nombre de la animación en el CSS, que no cambia nunca.
const arriba = bloque.locator('button', { hasText: 'SÍ, SALE' }).first();
arriba.click();
let chispa = 0;
for (let i = 0; i < 40; i += 1) {
  const n = await bloque.locator('.anim-voto-chispa').count();
  if (n > 0) { chispa = n; break; }
  await pg.waitForTimeout(25);
}
const rebote = await bloque.locator('.anim-voto').count();
console.log('3) AL PULSAR EL PULGAR');
console.log('  con chispazo (visto durante):', chispa);
console.log('  con rebote:', rebote);
const css = await pg.evaluate(() => {
  for (const hoja of Array.from(document.styleSheets)) {
    try {
      for (const r of Array.from(hoja.cssRules)) {
        if (r.selectorText === '.anim-voto-chispa::after') return r.style.animationName || 'sin animation-name';
      }
    } catch { /* hoja de otro origen */ }
  }
  return 'no encontrada';
});
console.log('  la animacion del chispazo:', css);
// Los SVG del hub llevan `data-icon`, asi que se puede comprobar el NOMBRE del
// icono y no solo contar trazos. Una captura en imagen no distingue una mano de
// una bombilla si estan petites, y esta medicion necesita justo eso.
const nombres = await bloque.locator('svg[data-icon]').evaluateAll((e) => e.map((x) => x.getAttribute('data-icon')));
console.log('4) ICONOS POR NOMBRE');
console.log('  en el bloque:', JSON.stringify(nombres));
// solo el bloque de manos, no los botones
const fila = bloque.locator('.anim-voto').first();
console.log('  la fila de manos tiene:', await fila.count() ? 'SVG' : 'nada');
// Solo el bloque, que es lo que hay que mirar. La pagina entera a pantalla
// completa sale ilegible: cada icono cae en tres pixeles.
await bloque.screenshot({ path: '/tmp/manos-voto.png' });
// y las manos sueltas, a tamano grande, para ver que la forma es la que debe
const solo = pg.locator('[data-guia="votacion"] .anim-voto').first();
if (await solo.count()) await solo.screenshot({ path: '/tmp/mano-suelta.png' });
await ctx.close();
await nav.close();
