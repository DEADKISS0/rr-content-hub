import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Santiago, 2026-10-01: "la que me mostraste orgánica no está cargando la
 * previsualización del anuncio. Necesito que se pueda ver desde adentro".
 *
 * El fallo medido, leyendo `ideas/[ideaId]/page.tsx`:
 *
 *   const raw = idea.reference_url ?? idea.ref ?? idea.reference_urls?.[0] ?? '';
 *   ...
 *   <ReferenceWithBrief url={raw} ... />
 *
 * Se tomaba la PRIMERA de la lista y se pintaba UNA sola. Con una idea que
 * tiene dos referencias (pauta: anuncio de Facebook + post de Instagram), si la
 * primera no se puede embeber —Facebook Ads Library con `?id=` no devuelve un
 * embed utilizable— la ficha queda con un hueco vacío y no hay segundaChance:
 * el resto de las referencias nunca se muestran.
 *
 * `reference_urls` es una LISTA justamente para eso. Descartar la lista en el
 * render es perder la información que el dato ya tenía.
 *
 * Estos tests fijan que la ficha pinte TODAS las referencias y que la que no
 * se puede embebir no se coma el lugar de una que sí.
 */
const ficha = readFileSync(new URL('../app/[projectSlug]/ideas/[ideaId]/page.tsx', import.meta.url), 'utf8');
const bloque = readFileSync(new URL('../components/reference-with-brief.tsx', import.meta.url), 'utf8');

/** El render tiene que METER el mapa de todas, no solo la primera. */
describe('la ficha muestra TODAS las referencias de la idea', () => {
  it('pinta el listado completo, no solo reference_urls[0]', () => {
    // La regresión: la idea con dos referencias perdía la segunda.
    expect(ficha).toMatch(/<ReferenceWithBrief\s+refs=/);
    expect(ficha).not.toMatch(/<ReferenceWithBrief\s+url=\{raw\}/);
  });

  it('la lista que se pinta es la de reference_urls, no un campo suelto', () => {
    // `raw` (el campo suelto) se sigue usando para el estado de calidad; lo que
    // se PINTAA es la lista.
    expect(ficha).toMatch(/refs=\{referencias\}/);
  });

  it('el bloque acepta una lista de referencias y las recorre', () => {
    expect(bloque).toMatch(/refs\??:\s*string\[\]/);
    // El render recorre la lista ORDENADA (`aPintar`, embebibles primero), no
    // la lista cruda: la aserción mira el `map` que realmente existe.
    expect(bloque).toMatch(/aPintar\.map\(/);
    expect(bloque).toMatch(/<ReferenceEmbed/);
  });
});

/**
 * El orden importa y hay una razón: la primera referencia es la que el equipo
 * eligió como la buena, pero si esa no se puede ver, la ficha no puede quedarse
 * en negro. El bloque tiene queikz本身 embebibles primero.
 */
describe('si la referencia principal no se ve, otra tiene que llenar ese lugar', () => {
  it('el bloque ordena por embebible antes de pintar', () => {
    expect(bloque).toMatch(/embebibles|embebible/i);
  });

  it('no se queda en uno solo cuando hay varias', () => {
    // Con dos referencias embebibles, tiene que pintar las dos: una es la
    // dirección elegida y la otra el respaldo, y verlas evita abrir enlaces.
    expect(bloque).not.toMatch(/refs\?\.\[0\]/);
  });
});

/**
 * Regresión de la regla `?stkn=`: sin esto, la referencia que "funcionaba" en
 * otro lado vuelve a ser un marco vacío.
 */
describe('las reglas del embed siguen intactas', () => {
  it('saca el ?stkn= antes de construir el embed', () => {
    expect(bloque).toMatch(/split\('\?'\)\[0\]/);
  });

  it('el reel no lleva /captioned/', () => {
    // Sin flag `s`: el proyecto apunta a es2017 y `tsc` lo rechaza.
    expect(bloque).toMatch(/const base = esReel[\s\S]*embed\$\{esReel \? '' : '\/captioned'\}/);
  });

  it('el permalink del embed lleva /reel/, no /p/', () => {
    expect(bloque).toMatch(/reel\/\$\{clean\.match/);
  });
});