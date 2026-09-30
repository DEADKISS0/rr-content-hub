/**
 * Genera el set de iconos de la PWA del hub a partir del simbolo real de RR.
 *
 * Santiago, 2026-09-30: "hasta que se pueda descargar como 'app' con el icono de
 * RR desde el navegador, asi como acceso directo desde Android y iPhone".
 *
 * POR QUE NO SE COPIA EL ICONO DEL CENTRO DE MANDO. Aquel es un monograma "RR"
 * dibujado con `<text>` y una fuente del sistema: en un icono de 32 px el texto
 * se deformar y en un dispositivo sin esa fuente sale otra cosa. Un icono tiene
 * que ser geometria, no tipografia.
 *
 * EL ICONO. El simbolo de RR (el de `public/brand/`), centrado sobre el negro de
 * marca, con la mostaza como unica linea de acento. Se compone sobre el lienzo
 * con una proportion del 62 %: al 70 % el simbolo se toca con el borde redondeado
 * en losmoviles que recortan más, y al 55 % se ve pequeño en la pantalla de inicio.
 */
import { chromium } from 'playwright';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = join(RAIZ, 'public', 'app');
mkdirSync(SALIDA, { recursive: true });

/** Los tamaños que piden las plataformas de verdad, no los que uno se inventa. */
const TAMANOS = [
  { px: 32, nombre: 'icono-32.png' },      // favicon / atajo
  { px: 96, nombre: 'icono-96.png' },      // Android mdpi
  { px: 120, nombre: 'icono-120.png' },    // iPhone @2x
  { px: 152, nombre: 'icono-152.png' },    // iPad @2x
  { px: 167, nombre: 'icono-167.png' },    // iPhone Pro
  { px: 180, nombre: 'icono-180.png' },    // Android xxhdpi / apple-touch
  { px: 192, nombre: 'icono-192.png' },    // manifest (obligatorio)
  { px: 256, nombre: 'icono-256.png' },    // maskable
  { px: 512, nombre: 'icono-512.png' },    // manifest (obligatorio)
  { px: 180, nombre: 'apple-touch-icon.png' },
];

/** Los que Android recorta en circulo o en "squircle": necesitan margen de sobra. */
const MASKABLE = [{ px: 192, nombre: 'maskable-192.png' }, { px: 512, nombre: 'maskable-512.png' }];

/** El símbolo de RR como data URI, leído del archivo que ya está en el repo. */
const simboloBytes = readFileSync(join(RAIZ, 'public', 'brand', 'rr-symbol-fucsia-on-negro.png'));
const simbolo = `data:image/png;base64,${simboloBytes.toString('base64')}`;

/**
 * El lienzo del icono.
 *
 * `proporcion` es el ancho del símbolo sobre el ancho del lienzo. El fondo es el
 * negro de marca y la mostaza hace de línea de acento abajo, igual que en el
 * resto de la marca de RR.
 */
function lienzo({ px, proporcion, maskable }) {
  const margen = maskable ? 0.78 : 0.62;
  return `<!DOCTYPE html><html><body style="margin:0">
<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 ${px} ${px}">
  <rect width="${px}" height="${px}" fill="#070001"/>
  <image href="${simbolo}" x="${((px - px * margen) / 2).toFixed(2)}" y="${(px * (1 - margen) / 2 - px * 0.02).toFixed(2)}"
         width="${(px * margen).toFixed(2)}" height="${(px * margen).toFixed(2)}" preserveAspectRatio="xMidYMid meet"/>
  <rect x="${(px * 0.28).toFixed(2)}" y="${(px * 0.80).toFixed(2)}" width="${(px * 0.44).toFixed(2)}"
        height="${Math.max(1, Math.round(px * 0.018))}" fill="#DED116"/>
</svg></body></html>`;
}

const nav = await chromium.launch();

for (const { px, nombre } of [...TAMANOS, ...MASKABLE]) {
  const maskable = nombre.startsWith('maskable');
  const ctx = await nav.newContext({ viewport: { width: px, height: px }, deviceScaleFactor: 1 });
  const pg = await ctx.newPage();
  await pg.setContent(lienzo({ px, proporcion: 1, maskable }), { waitUntil: 'load' });
  await pg.waitForTimeout(120);
  const buf = await pg.locator('svg').screenshot({ omitBackground: true });
  writeFileSync(join(SALIDA, nombre), buf);
  await ctx.close();
  console.log(`${nombre.padEnd(24)} ${px}x${px}  ${(buf.length / 1024).toFixed(1)} KB`);
}

await nav.close();
console.log(`\nIconos en public/app/ — ${TAMANOS.length + MASKABLE.length} archivos`);
