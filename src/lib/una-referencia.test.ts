import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..', '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8');

/**
 * MEDIDO 2026-10-04, Santiago: «deja solo una referencia por video».
 *
 * En producción había cuatro ideas con dos referencias (O13, P28, P29, P30). En
 * dos de ellas la segunda era un anuncio de Facebook Ads Library, que NO tiene
 * endpoint público que lo sirva embebido: `plugins/post.php` devuelve un marco
 * vacío. La ficha cargaba dos iframes para mostrar medio negro.
 *
 * Decisión de Santiago, cuando se le preguntó: en la BASE queda una sola URL, y en
 * PANTALLA se muestra solo el video. La que se borra se guarda en
 * `rr_hub_respaldo_borrado`.
 */
describe('una idea guarda UNA sola referencia', () => {
  it('el servidor de creacion se queda con una, y elige la embebible', () => {
    const ruta = leer('src/app/api/workspace/[action]/route.ts');
    const codigo = ruta
      .split('\n')
      .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*') && !l.trim().startsWith('*'))
      .join('\n');

    // (a) La lista que se guarda tiene como maximo un elemento. Sin esto, volver a
    // relajar el `.slice(0, 10)` y las ideas con dos referencias vuelven.
    expect(codigo, 'la referencia guardada no esta acotada a una').toMatch(
      /const references = referencia \? \[referencia\] : \[\]/,
    );

    // (b) Y la eleccion es por origen EMBEBIBLE, no por posicion: si llega un
    // anuncio de Facebook (no embebible) y un reel, el reel es el que se queda.
    // MEDIDO: los `og:type` de los reels de Instagram dicen `article`, y los
    // anuncios de Facebook no dicen nada. El dato publicable no sirve para
    // distinguir, asi que la regla es por plataforma.
    expect(codigo, 'no se distingue la referencia embebible de la que no').toMatch(
      /find\(\(u\) => EMBEBIBLES\.some/,
    );
  });

  it('si no llega ninguna embebible, conserva la que haya llegado', () => {
    // Fallar aqui dejaria ideas SIN referencia: peor que una referencia que se ve
    // en negro. Una idea sin referencia no tiene contra que trabajar.
    const ruta = leer('src/app/api/workspace/[action]/route.ts');
    expect(ruta, 'se descarta la referencia no embebible en vez de conservarla').toMatch(
      /\|\| pedidas\[0\]/,
    );
  });

  it('el formulario de nueva idea manda una sola URL', () => {
    // Un solo campo de texto, entonces una sola URL. Si esto cambia a un array,
    // el formulario volveria a poder mandar varias por el camino corto.
    const form = leer('src/components/new-idea-form.tsx');
    expect(form).toMatch(/referenceUrls:\s*form\.reference\.trim\(\)\s*\?\s*\[form\.reference\.trim\(\)\]\s*:\s*\[\]/);
  });

  it('el editor de la ficha tambien guarda una sola', () => {
    const editor = leer('src/components/idea-editor.tsx');
    expect(editor).toMatch(/referenceUrls:\s*url\s*\?\s*\[url\]\s*:\s*\[\]/);
  });
});