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
 * se MIDIO: que el pseudo-elemento no intercepte el toque.
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

  it('el pseudo-elemento del titulo no intercepta el toque', () => {
    // ESTA es la linea que arregla el bug. Sin `after:pointer-events-none`, el
    // pseudo cubre la tarjeta y el dedo toca el titulo en cualquier sitio.
    const enlace = mapa.match(/href=\{`\/\$\{projectSlug\}\/ideas\/\$\{idea\.id\}`\}[\s\S]{0,400}?>/);
    expect(enlace?.[0], 'no se encuentra el enlace del titulo').toBeTruthy();
    expect(enlace![0]).toMatch(/after:pointer-events-none/);
    // Y que no queden clases muertas del intento anterior: `pointer-events-auto`
    // y `z-0` en el enlace no hacen nada con el pseudo ya transparente al toque,
    // y una clase que no hace nada es una clase que el proximo no sabe leer.
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