import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * MEDIDO 2026-10-04 con dedo real en Chrome a 390x844 (iPhone 12):
 * `document.elementFromPoint()` sobre el botón «A FAVOR» devuelve el `<a>` del
 * TÍTULO de la misma tarjeta, no el botón. Los 16 botones de votar de Wundeer
 * son invisibles al dedo. En escritorio no se nota porque el hover cambia el
 * flujo; con el dedo no hay hover.
 *
 * La causa es el patrón *stretched link* del título:
 *
 *     after:absolute after:inset-0
 *
 * que se estira a la tarjeta entera para que toda la caja abra la ficha. En una
 * tarjeta sin botones es un patrón correcto y mejora el producto. En una tarjeta
 * CON botones los come. Y estos tests existían y pasaban: el fallo no es que el
 * código esté mal escrito, es que hay que mirarlo con el dedo.
 *
 * Por eso estos asertos se leen sobre el CÓDIGO, pero lo que protegen es lo que
 * se MIDIO.
 *
 * ACTUALIZADO 2026-10-04. La primera versión de estos tests afirmaba que el
 * pseudo-elemento no debía interceptar el toque, y ese arreglo —quitarle los
 * eventos— dejó la TARJETA ENTERA sin abrir la ficha. MEDIDO después: cinco
 * puntos de la tarjeta, `SPAN`, `DIV` o nada. Nunca el enlace. Se arregló una
 * cosa rompiendo la otra.
 *
 * La lección que queda escrita: un patrón que estira el enlace sobre la tarjeta
 * entera y, a la vez, unos botones dentro de esa tarjeta, no se resuelven
 * se resuelven apagando el patrón — se resuelven poniendo los botones por encima. Esa es la
 * forma correcta y la que estos tests sostienen ahora.
 */
const RAIZ = join(__dirname, '..');

describe('el titulo estirable no se come los botones', () => {
  const mapa = readFileSync(join(RAIZ, 'components/project-map.tsx'), 'utf8');
  const voto = readFileSync(join(RAIZ, 'components/vote-quick.tsx'), 'utf8');

  it('la tarjeta es el ancla del pseudo-elemento del titulo', () => {
    // MEDIDO: el `<article>` no tenia `relative`, asi que `after:inset-0` se
    // anclaba al primer ancestro posicionado — que no era la tarjeta — y el
    // pseudo se estiraba sobre un area distinta de la que parece.
    expect(mapa).toMatch(/<article[\s\S]{0,400}className=\{`[^`]*\brelative\b/);
  });

  it('el pseudo-elemento abre la ficha y el voto queda por encima', () => {
    // MEDIDO 2026-10-04 con dedo real a 390x844: `elementFromPoint` en cinco
    // puntos dentro de la tarjeta devolvió SPAN, DIV o nada — nunca el enlace.
    // La tarjeta NO abría la ficha, y la causa era este mismo arreglo.
    //
    // Antes: el pseudo llevaba `pointer-events-none` para que el botón de votar
    // fuera alcanzable. Eso lo consiguió, pero al quitarle los eventos al pseudo
    // el pseudo dejó de ser el blanco del toque, así que el dedo pasaba de largo
    // en toda la tarjeta menos en el botón. Arreglar el voto tapó la tarjeta.
    //
    // Ahora: el pseudo vuelve a recibir el toque —eso es lo que hace que toda la
    // tarjeta abra la ficha— y el botón de votar sube por encima con
    // `relative z-10`, que es lo que lo saca de debajo del pseudo. Las dos cosas
    // a la vez, con un solo elemento.
    const enlace = mapa.match(/href=\{`\/\$\{projectSlug\}\/ideas\/\$\{idea\.id\}`\}[\s\S]{0,400}?>/);
    expect(enlace?.[0], 'no se encuentra el enlace del titulo').toBeTruthy();
    expect(enlace![0]).not.toMatch(/after:pointer-events-none/);
    expect(enlace![0]).toMatch(/after:absolute after:inset-0/);
    // El voto es lo único que debe quedar por encima del pseudo.
    expect(mapa).toMatch(/contenedorClase="relative z-10"/);
    // Y que no queden clases muertas del intento anterior: `pointer-events-auto`
    // y `z-0` en el enlace no hacen nada, y una clase que no hace nada es una
    // clase que el proximo no sabe leer.
    expect(enlace![0]).not.toMatch(/pointer-events-auto|relative z-0/);
  });


  it('los botones de votar van por encima del titulo estirable', () => {
    // `pointer-events-none` deja pasar el dedo al boton, pero el pseudo sigue
    // pintandose encima en el hover. `relative z-10` pone la zona de voto por
    // encima de verdad.
    expect(mapa).toMatch(/idea\.status === 'voting' && \(\s*<VoteQuick/);
    expect(mapa).toMatch(/contenedorClase="relative z-10"/);
  });

  it('el componente de voto recibe la clase y la aplica', () => {
    // La prop se declara y se USA. Una prop declarada y no aplicada es un
    // comentario enmayusculas: el siguiente que lo lea creera que funciona.
    expect(voto).toMatch(/contenedorClase\?: string/);
    expect(voto).toMatch(/contenedorClase \?\? ''/);
  });

  it('el boton de voto sigue solo en las ideas en votacion', () => {
    // Este aserto ya existia y MEDIO lo que obliga: si el boton saliera en
    // cualquier tarjeta, se podrian votar ideas ya publicadas. La prop nueva no
    // puede romperlo, y por eso se comprueba despues de tocarla.
    expect(mapa).toMatch(/idea\.status === 'voting' && \(\s*<VoteQuick/);
    expect(mapa).not.toMatch(/\{true && \(\s*<VoteQuick/);
  });
});