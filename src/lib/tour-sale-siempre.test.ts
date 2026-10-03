import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Santiago, 2026-10-01 — auditoría de experiencia de uso.
 *
 * HALLAZGO, el más grave de todos los medidos. Al entrar al Hub se abre el tour
 * (`guided-tour.tsx`). Su única salida son los botones SALTAR y SIGUIENTE, y en
 * un iPhone 13 (390×664) ambos quedan DEBAJO del borde inferior:
 *
 *   /wundeer            SALTAR en y=678   viewport 664  -> fuera
 *   /wundeer/aprobaciones               y=708              -> fuera
 *   /wundeer/publicaciones              y=708              -> fuera
 *
 * El overlay es `fixed inset-0` SIN `pointer-events-none`, así que ni siquiera
 * se puede tocar lo que hay detrás. El resultado: la primera pantalla que ve el
 * usuario es un modal a pantalla completa, atenuado, sin salida visible, y toda
 * la app queda inusable. Solo en la ficha de una idea el botón cabe.
 *
 * No lo ha reportado nadie porque no se puede salir para contarlo.
 *
 * La causa está en el `style` inline de la tarjeta: cuando el elemento señalado
 * está en la mitad de arriba, la tarjeta se ancla con `top` y el tope es
 * `window.innerHeight - 220`. El 220 es una suposición: la tarjeta mide más de
 * 220px (título + texto + tres botones), así que se sale por abajo. Y como el
 * tope se aplica al `top` y no a la posición final, no hay nada que la frene.
 */

const tour = readFileSync(new URL('../components/guided-tour.tsx', import.meta.url), 'utf8');

describe('el tour se puede salir siempre', () => {
  it('SALTAR existe y cierra', () => {
    expect(tour).toMatch(/SALTAR/);
    expect(tour).toMatch(/onClick=\{cerrar\}/);
  });

  it('la tarjeta no se ancla con un tope fijo de 220px', () => {
    // El fallo medido: `Math.min(caja.top + caja.height + 24, window.innerHeight - 220)`.
    // Ese 220 es una suposición sobre lo que mide la tarjeta, y la tarjeta mide
    // más. Con `top` ya calculado, la tarjeta se dibuja por debajo de la
    // pantalla y no hay nada que la empuje de vuelta.
    // Solo en código: el 220 puede quedar contado en el comentario que explica
    // el fallo, pero nunca en una expresión que corra.
    const codigo = tour.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(codigo).not.toMatch(/window\.innerHeight\s*-\s*\d+/);
  });

  it('la tarjeta se ancla con top, y su alto lo dice max-h', () => {
    /* MEDIDO 2026-10-03 a 1440x900: con `top` Y `bottom` la caja daba 434 px de
       alto — el 48% de la pantalla — para tres líneas de texto. `top` y `bottom`
       juntos NO son «no salir por abajo»: son una orden de ESTIRAR. El
       navegador reparte el hueco sobrante entre los dos bordes aunque el
       contenido no lo llene.

       Este aserto exigía el `bottom`, o sea: exigía el defecto. Lo que protege de
       verdad salirse por abajo es `max-h` + `overflow-y-auto`, que es el test
       siguiente. Este ahora vigila lo contrario: que no vuelva el `bottom`. */
    const codigo = tour.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(codigo).not.toMatch(/top:[\s\S]{0,200},?\s*bottom:/);
    // el anclaje por arriba sigue, acotado a media pantalla
    expect(codigo).toMatch(/top:\s*Math\.min\(Math\.max\(16, caja\.top \+ caja\.height \+ 24\), window\.innerHeight \/ 2\)/);
  });

  it('la tarjeta tiene tope inferior, no solo superior', () => {
    // `max-h-[calc(100dvh-2rem)]` y `overflow-y-auto` en la misma tarjeta: si el
    // texto es largo de verdad, la tarjeta se desplaza en vez de salirse.
    expect(tour).toMatch(/max-h-\[calc\(100dvh-2rem\)\]/);
    expect(tour).toMatch(/overflow-y-auto/);
  });

  it('el botón de saltar no es diminuto al tacto', () => {
    // MEDIDO: SALTAR mide 16px de alto. En un dedo eso no se pincha.
    expect(tour).toMatch(/SALTAR/);
    const botonSaltar = /onClick=\{cerrar\}[\s\S]{0,220}/.exec(tour)?.[0] ?? '';
    expect(botonSaltar).toMatch(/min-h-\[?44px\]?|min-h-11|py-3|py-4/);
  });
});

describe('el overlay no secuestra la pantalla', () => {
  it('la capa atenuada no bloquea lo que hay detrás', () => {
    // Sin `pointer-events-none` en el contenedor, el overlay se come el toque
    // aunque el botón sea visible.
    const atenuada = /aria-hidden="true"[^>]*className="[^"]*"/.exec(tour)?.[0] ?? '';
    expect(atenuada).toMatch(/pointer-events-none/);
  });

  it('se puede cerrar con Escape, que es lo que hay en un teclado', () => {
    expect(tour).toMatch(/Escape/);
  });
});
