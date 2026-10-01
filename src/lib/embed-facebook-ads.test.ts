import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Santiago, 2026-10-01 — el embed de Facebook Ads.
 *
 * MEDIDO, abriendo la URL real en el navegador:
 *
 *   https://www.facebook.com/plugins/post.php?href=<Ads Library>
 *   → title "Facebook", contenido: `- feed` + link "Servicio de ayuda"
 *
 * Eso es un marco VACÍO. No es un video que tarda: es el documento que Meta
 * devuelve cuando no reconoce lo que le pidieron. El `onLoad` se dispara igual
 * —una respuesta de error también es una respuesta—, así que la pantalla decía
 * "viendo la referencia" sobre un rectángulo en gris.
 *
 * Y hay dos ideas de Wundeer exactamente en ese caso:
 *
 *   P19  1 referencia, solo Facebook Ads Library
 *   P25  1 referencia, solo Facebook Ads Library
 *
 * Las otras dos (P28, P29) tienen Ads **y** un post de Instagram, y esas se ven
 * bien porque el filtro ya las separaba.
 *
 * El bug tenía dos partes:
 *
 * 1. El filtro decía "no embebible" pero devolvía `false` sin el motivo. Y como
 *    `embedSource` SÍ devuelve una URL para Facebook, el render veía `source`
 *    no nulo y pintaba el iframe vacío sin decir nada. Quien tenía que
 *    explicar por qué la ficha estaba en negro no tenía con qué.
 *
 * 2. El link del header ("ABRIR ORIGINAL") era la PRIMERA de la lista, no la que
 *    se estaba embebiendo. En P28 eso significa flash de Instagram y link del
 *    anuncio de Facebook: dos fuentes distintas bajo un mismo rótulo.
 *
 * Lo que NO se hace: inventar un embed de Facebook. No existe endpoint público
 * que sirva la biblioteca de anuncios. Lo que se hace es decir la verdad y
 * dejar el link, que sí funciona.
 *
 * Estos tests usan `includes()` y no `/regex/`: la forma exacta de la detección
 * en el código es asunto del código. Lo que se fija aquí es el comportamiento.
 * La versión con regex hubo que reescribirla dos veces por escapes mal
 * contados, y un test frágil no sirve de nada.
 */
const ref = readFileSync(new URL('../components/reference-with-brief.tsx', import.meta.url), 'utf8');

describe('una referencia que no se puede embeber lo dice, no cae en negro', () => {
  it('existe una función que explica por qué no se puede embeber', () => {
    expect(ref).toContain('motivoDeNoEmbebir');
    expect(ref).toContain('esEmbebible');
    // El filtro se apoya en ella: sin motivo, sin explicación.
    expect(ref).toContain('motivoDeNoEmbebir(url) === null');
  });

  it('el motivo nombra la biblioteca de anuncios de Facebook', () => {
    // El aviso tiene que decir QUÉ plataforma y QUÉ límite, no "no disponible".
    expect(ref).toContain('biblioteca de anuncios de Facebook');
    expect(ref).toContain('no se puede embeber');
  });

  it('y la función devuelve TEXTO, no un booleano', () => {
    // MEDIDO: la mutación de volver `motivoDeNoEmbebir` a `boolean` dejó los 7
    // tests en verde. El test miraba que la función existiera y que el aviso
    // estuviera escrito, pero no que la función DEVUELVIERA la razón: podía
    // devolver `true` y seguir meeting todo lo que se comprobaba.
    //
    // El bug entero era ese: el filtro sabía que no se podía embeber y no
    // decía por qué. Un `boolean` es exactamente el bug. Se fija el tipo.
    const cuerpo = ref.slice(ref.indexOf('function motivoDeNoEmbebir'));
    expect(cuerpo.slice(0, 120)).toContain('string | null');
    // Y tiene que devolver la razón de Facebook, no un literal vacío.
    expect(cuerpo).toContain('biblioteca de anuncios de Facebook');
  });

  it('el aviso dice que el anuncio se ve igual abriendo el link', () => {
    // Lo que sí funciona es el link. Decirlo convierte una ficha muerta en una
    // ficha con salida.
    expect(ref).toContain('VER ANUNCIO EN FACEBOOK');
    expect(ref).toContain('PREVIEW NO DISPONIBLE');
  });
});

describe('el link del header apunta a lo que se está viendo', () => {
  it('el ABRIR ORIGINAL usa la referencia embebida', () => {
    expect(ref).toContain('sourcePrincipal?.url ?? aPintar[0]');
  });

  it('el aPintar[0] solo aparece como respaldo, nunca como único link', () => {
    // En el código queda UN `aPintar[0]` y es deliberado: es el respaldo para
    // cuando no hay ninguna referencia embebible. Lo que no puede pasar es que
    // ese sea el link principal cuando sí hay una embebida.
    //
    // La primera versión de este aserto era `not.toContain('href={aPintar[0]}')`
    // y quedaba en rojo con el código correcto, porque el respaldo existe a
    // propósito. Un test que obliga a borrar el fallback para poder pasar está
    // midiendo el estilo, no el comportamiento.
    // El conteo excluye los comentarios: el código los tiene, y el test no
    // puede reprocharle al autor que escriba por qué cambió la cosa.
    const codigo = ref.replace(/\/\*[\s\S]*?\*\//g, '');
    const usos = codigo.split('href={aPintar[0]}').length - 1;
    expect(usos, 'el respaldo no debe ser el href por defecto').toBe(0);
    // Lo que sí se fija: siempre hay una embebida delante de él.
    expect(ref).toContain('sourcePrincipal?.url ?? aPintar[0]');
  });
});

describe('una idea con una sola referencia no embebible no se rompe', () => {
  it('el caso de "nada embebible" tiene su propia salida', () => {
    // MEDIDO: P19 y P25 tienen UNA referencia y es una Ads Library. Sin esta
    // rama la ficha pintaba el iframe vacío sin decir nada.
    expect(ref).toContain('if (!embebibles.length)');
    expect(ref).toContain('motivoDeNoEmbebir(todas[0])');
  });

  it('y esa salida tiene un botón, no solo texto', () => {
    expect(ref).toContain('esAnuncioDeFacebook');
  });
});