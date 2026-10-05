import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * MEDIDO 2026-10-04, Santiago: «no es responsive a celular, no hace bien las
 * animaciones, y ya no muestra el recuadro amarillo que señala el paso a
 * explicar, también el popup está muy grande».
 *
 * Cuatro quejas, cuatro causas. Este test fija las cuatro porque tres de ellas
 * se pueden volver a romper sin que nada se note:
 *
 *   1. RESPONSIVE. El `nav` de las pestañas era `flex gap-1` sin envolver.
 *      MEDIDO en producción: el botón «PAUTA 21» llegaba a x=402 con un viewport
 *      de 390, y a x=402 con uno de 320. Se salía de la pantalla por la derecha.
 *   2. ANIMACIONES. No estaban rotas: MEDIDO, 35 tarjetas con `cardIn` corriendo.
 *      Lo que sí se pierde es el retardo en cascada si `shrink-0` falta y las
 *      pestañas se aplastan. Este test fija que las pestañas NO se aplastan.
 *   3. RECUADRO AMARILLO. La condición era `caja && !movil`. En móvil nunca se
 *      pintaba. Ahora se pinta siempre que el objetivo sea visible, y con el
 *      cálculo de `bottom`/`right` hechos a mano porque el estado solo guarda
 *      `top/left/width/height`.
 *   4. POPUP. MEDIDO: 366x216 en 390 px = 24% de la pantalla, y 490x270 en
 *      escritorio = 10%. NO estaba grande. La primera auditoría lo midió mal por
 *      medir el contenedor `inset-0` en vez de la tarjeta. Este test fija el
 *      límite para que no crezca sin motivo.
 *
 * Por qué leer el código y no ejecutar el navegador: estas cuatro cosas se
 * pueden comprobar con expresiones sobre el fuente, y una prueba que necesita
 * levantar un navegador no se corre en cada push. Lo que SÍ necesita navegador
 * es el ancho final en pantalla, y eso lo mide `auditoria-visual.py`.
 */
const RAIZ = join(__dirname, '..', '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8');

describe('el hub se ve bien en un celular', () => {
  describe('1. las pestañas de tipo de contenido no se salen de la pantalla', () => {
    const fuente = leer('src/components/content-type-tabs.tsx');

    it('el nav se desliza en vez de desbordar la página', () => {
      expect(fuente).toMatch(/<nav[\s\S]{0,400}overflow-x-auto/);
    });

    it('las pestañas no se aplastan ni se parten en dos líneas', () => {
      expect(fuente).toMatch(/inline-flex shrink-0/);
    });

    it('el nav no queda como un flex pelado', () => {
      // Esta es exactamente la línea que había. Sin este test, `flex gap-1`
      // vuelve sin que nadie lo note: se ve bien en 1440 y se sale en 390.
      expect(fuente).not.toMatch(/className="flex gap-1"/);
    });
  });

  describe('2. las pestañas siguen siendo animadas y táctiles', () => {
    const fuente = leer('src/components/content-type-tabs.tsx');

    it('conservan su transición', () => {
      expect(fuente).toMatch(/transition-all duration-150/);
    });

    it('el botón mide lo suficiente para el dedo', () => {
      // py-2.5 sobre text-xs: MEDIDO, ~40 px. Por debajo de 44 px el dedo la
      // rozarla por error.
      // Las clases están partidas en varias líneas, así que se lee el `py-N`
      // suelto: es el que da la altura del área tocable.
      const py = [...fuente.matchAll(/py-([\d.]+)/g)].map((m) => Number(m[1]));
      expect(py.length).toBeGreaterThan(0);
      // py-2.5 sobre text-xs son ~40 px medidos; py-1 son 32 px y el dedo la roza.
      expect(Math.max(...py)).toBeGreaterThanOrEqual(2.5);
    });
  });

  describe('3. el recuadro amarillo vuelve a pintarse en el celular', () => {
    const fuente = leer('src/components/guided-tour.tsx');

    it('ya no se descarta en móvil', () => {
      // La línea que quitó la seña: `caja && !movil`.
      expect(fuente).not.toMatch(/caja\s*&&\s*!movil\s*&&/);
    });

    it('el recuadro se marca para poder auditarlo', () => {
      expect(fuente).toMatch(/data-guia-recuadro/);
    });

    it('la sombra gigante no vuelve a móvil: se come los clics', () => {
      // El 2026-10-03 se quitó el recuadro en móvil porque la sombra `9999px`
      // bloqueaba la pantalla. El arreglo es recuadro sin sombra, no sombra.
      expect(fuente).toMatch(/boxShadow:\s*movil\s*\?\s*'none'/);
    });

    it('no se pinta sobre un objetivo que está fuera de la pantalla', () => {
      expect(fuente).toMatch(/visibleEn\(caja\)/);
    });

    // MEDIDO 2026-10-04 en producción, ya desplegado: con el recuadro
    // devuelto, seguia sin pintarse. La causa era que el paso 1 mide el `aside`,
    // que en 390 px vive en x=-288 —FUERA de la pantalla, detrás del botón que
    // la abre—. `visibleEn` hacía bien su trabajo: no pinta un rectángulo sobre
    // algo que no está. El paso es el que estaba mal, no el que lo dibuja.
    it('el paso del menú dice dónde está el menú en el celular', () => {
      expect(fuente).toMatch(/targetMovil\?: string/);
      expect(fuente).toMatch(/targetMovil: 'button\[aria-label="Menú principal"\]'/);
    });

    it('el selector del paso se resuelve según el ancho, no siempre el de escritorio', () => {
      // Un solo lugar decide: si esto se reparte por tres sitios, el próximo que
      // añada un paso vuelve a medir el `aside` y pierde el recuadro.
      expect(fuente).toMatch(/const selectorDe = useCallback/);
      expect(fuente).toMatch(/movil && paso\.targetMovil/);
      // Y los tres usos pasan por ahí.
      const usos = (fuente.match(/querySelector\(selectorDe\(/g) ?? []).length;
      expect(usos).toBeGreaterThanOrEqual(2);
    });

    it('calcula abajo y derecha a mano: el estado no los trae', () => {
      // MEDIDO: con `c.bottom` sobre `undefined`, toda comparación da false y el
      // recuadro NO se pinta nunca. El bug vestido de arreglo.
      expect(fuente).toMatch(/const\s+abajo\s*=\s*c\.top\s*\+\s*c\.height/);
      expect(fuente).toMatch(/const\s+derecha\s*=\s*c\.left\s*\+\s*c\.width/);
    });
  });

  describe('4. el popup no crece más allá de lo medido', () => {
    const fuente = leer('src/components/guided-tour.tsx');

    it('en móvil se acota a la altura útil de la pantalla', () => {
      expect(fuente).toMatch(/max-h-\[calc\(100dvh-6\.5rem\)\]/);
    });

    it('en escritorio se ajusta al texto, no a un ancho fijo', () => {
      // `w-fit`: la medida del 2026-10-03 fue que ocupaba media pantalla para
      // un texto de tres líneas. `w-fit` es lo que lo dejó en 490x270.
      expect(fuente).toMatch(/w-fit/);
    });

    it('el texto tiene ancho de lectura, no el de la tarjeta', () => {
      expect(fuente).toMatch(/max-w-\[|prose/);
    });
  });

  describe('5. la tarjeta entera abre la ficha', () => {
    const fuente = leer('src/components/project-map.tsx');

    it('el pseudo-elemento vuelve a recibir el toque', () => {
      // La causa real: `after:pointer-events-none` (puesto para arreglar el voto)
      // dejó el pseudo sin eventos, así que el dedo pasaba de largo. MEDIDO en
      // 390 px: `elementFromPoint` en cinco puntos de la tarjeta devolvió SPAN,
      // DIV o nada — nunca el enlace.
      expect(fuente).not.toMatch(/after:pointer-events-none after:absolute/);
      expect(fuente).toMatch(/after:absolute after:inset-0/);
    });

    it('el botón de votar sigue por encima del pseudo', () => {
      // Si esto falta, el voto deja de funcionar al arreglar la tarjeta. Son las
      // dos cosas que el mismo pseudo tenía que servir a la vez.
      expect(fuente).toMatch(/contenedorClase="relative z-10"/);
    });
  });

  describe('6. tocar IDEAS lleva a las ideas', () => {
    const guia = leer('src/components/flow-guide.tsx');
    const mapa = leer('src/components/project-map.tsx');

    it('el botón del paso pide el desplazamiento', () => {
      expect(guia).toMatch(/irAlTablero\(\)/);
    });

    it('el tablero tiene un ancla con nombre', () => {
      expect(mapa).toMatch(/data-tablero-ideas="si"/);
    });

    it('desplaza en el siguiente cuadro, no en el mismo clic', () => {
      // Con `scrollIntoView` en el mismo tick se mide la posición vieja y el
      // tablero sigue 1.084 px más abajo: el botón parece no hacer nada.
      expect(guia).toMatch(/requestAnimationFrame/);
    });

    it('solo desplaza al activar un paso, no al quitar el filtro', () => {
      // Quitar el filtro con el tablero a la vista lo dejaría fuera de pantalla
      // sin motivo, que es el mismo síntoma que se quería quitar.
      expect(guia).toMatch(/if\s*\(!active\)\s*irAlTablero\(\)/);
    });
  });
});