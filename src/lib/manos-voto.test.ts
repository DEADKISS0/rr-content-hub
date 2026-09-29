import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * El voto es una mano, no un número.
 *
 * Santiago, 2026-09-29: "no entiendo lo de la votación, o sea que yo abra la
 * votación no significa que vote que sí, o sea necesito ver los símbolos de
 * pulgar arriba, abajo, o manitos haciendo el 67, pero más feedback".
 *
 * Lo que se comprueba es que cada respuesta TIENE su icono y su color, y que el
 * voto se refleja uno a uno. El pixel no se comprueba: un SVG dibujado a mano
 * puede parecerse a una mano o a una bombilla según el tamaño, y eso hay que
 * verlo con ojos. Lo que sí tiene que ser exacto es que cada respuesta tenga
 * SU icono, que el nombre viaje al DOM para poder verificarlo, y que el número
 * no sustituya a la persona.
 */
const raiz = join(process.cwd(), 'src');
const leer = (ruta: string) => readFileSync(join(raiz, ruta), 'utf8');
const voting = leer('components/idea-voting.tsx');
const iconos = leer('components/ui/icons.tsx');

describe('cada respuesta tiene su mano', () => {
  it('las cuatro respuestas tienen icono: pulgar arriba, pulgar abajo, 6-7 y nota', () => {
    // El 6-7 con el chulito es la seña de "sí, pero", que es lo que hace `change`.
    // Si alguien lo cambiara por un lápiz, la tercera respuesta volvería a ser
    // indistinguible de "editar", que es otra cosa.
    for (const icono of ['pulgar-arriba', 'pulgar-abajo', 'si-pero', 'nota']) {
      expect(iconos).toMatch(new RegExp(`'${icono}':`));
    }
  });

  it('el nombre del icono llega al DOM, para poder verificarlo', () => {
    // Sin `data-icon`, comprobar "qué icono sale" exige contar trazos del SVG y
    // dos iconos parecidos son indistinguibles en una prueba automática. Con
    // `data-icon` la comprobación es literal.
    expect(iconos).toMatch(/data-icon=\{name\}/);
  });

  it('los cuatro botones usan su icono, no texto solo', () => {
    expect(voting).toMatch(/icono="pulgar-arriba"/);
    expect(voting).toMatch(/icono="pulgar-abajo"/);
    expect(voting).toMatch(/icono="si-pero"/);
    expect(voting).toMatch(/icono="nota"/);
  });

  it('cada emoji tiene un color que significa algo', () => {
    // Los colores no son decoración: orquídea avanza, mostaza pide cambio, gris
    // no cuenta. Si se vieran todos iguales, el emoji no aportaría nada.
    expect(voting).toMatch(/TONO_EMOJI/);
    expect(voting).toMatch(/text-orquidea/);
    expect(voting).toMatch(/text-mostaza/);
  });

  it('los emojis tienen nombre para quien no los distingue', () => {
    // El `title` y el `aria-label` dicen "Sí, que sale" o "Nota, no cuenta como
    // voto". Un emoji sin nombre es adorno; con nombre, es información.
    expect(voting).toMatch(/TONO_EMOJI\[d\]\.titulo/);
  });
});

describe('el voto se refleja uno a uno', () => {
  it('la lista de respuestas llega del servidor, no se cuenta aquí', () => {
    // `detalle` viene de la respuesta de la API. Si la interfaz contara los
    // emojis por su cuenta, el navegador podría pintar tres pulgares con un solo
    // voto guardado — y el conteo que decide si una pieza sale es el del
    // servidor, no el de la pantalla.
    expect(voting).toMatch(/const \[detalle, setDetalle\] = useState/);
    expect(voting).toMatch(/setDetalle\(resultado\.detalle/);
  });

  it('los votos que ya había se pintan al abrir la ficha', () => {
    // Sin el detalle inicial, la ficha abría con "3 a favor" y sin manos: la
    // información estaba, solo que en un número.
    const data = leer('lib/data.ts');
    expect(data).toMatch(/detalle: DecisionVoto\[\]/);
    expect(leer('app/[projectSlug]/ideas/[ideaId]/page.tsx')).toMatch(/detalle: votos\.detalle/);
  });

  it('la API devuelve la lista completa, no solo el total', () => {
    const api = leer('app/api/workspace/[action]/route.ts');
    expect(api).toMatch(/const detalle = \(votos \?\? \[\]\)\.map/);
    expect(api).toMatch(/detalle,/);
  });
});

describe('el rebote confirma, no decora', () => {
  it('el chispazo es una clase aparte del rebote', () => {
    // Si el halo estuviera dentro de `.anim-voto`, saldría con cada emoji al
    // pintarse la fila — que es justo cuando no ha pasado nada todavía. El
    // chispazo solo puede salir justo después de pulsar.
    const css = leer('app/globals.css');
    expect(css).toMatch(/\.anim-voto-chispa::after/);
    expect(css).not.toMatch(/\.anim-voto \{[^}]*::after/);
  });

  it('el rebote se quita solo, no se queda puesto', () => {
    // Si el botón siguiera rebotando, parecería seleccionado, y no es un estado
    // es un eco de que se acaba de guardar.
    expect(voting).toMatch(/setVotoReciente\(decision\)/);
    expect(voting).toMatch(/setVotoReciente\(null\)/);
  });

  it('con movimiento reducido no hay rebote ni chispazo', () => {
    // El movimiento es la confirmación; sin él, la confirmación es el texto del
    // aviso, que ya está. Pero si el movimiento estorba, se quita entero.
    const css = leer('app/globals.css');
    expect(css).toMatch(/prefers-reduced-motion/);
    // La regla del `prefers-reduced-motion` lista las clases en varias líneas,
    // así que se mira el bloque entero y no una sola línea con un regex.
    const bloque = css.slice(css.indexOf('prefers-reduced-motion'));
    expect(bloque).toMatch(/animation: none !important/);
    expect(bloque).toMatch(/\.anim-voto/);
    expect(bloque).toMatch(/\.anim-voto-chispa/);
  });
});
