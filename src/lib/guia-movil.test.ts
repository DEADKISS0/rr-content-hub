import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * La guía tiene que caber y tener salida en un teléfono.
 *
 * MEDIDO 2026-10-03 en producción, Santiago: «el apartado de como se usa, para
 * celular esta totalmente dañado». Los números, en 390x844:
 *
 *   zona de texto   40 px de alto   (el texto necesita 284)
 *   SIGUIENTE       top=1087        (289 px POR DEBAJO del borde, en 844)
 *   SALTAR          top=1088
 *
 * El tour no tenía salida en el móvil, y el overlay —que sí captura el toque—
 * dejaba la app entera bloqueada.
 */
const raiz = join(__dirname, '..', '..');
const leer = (rel: string) => readFileSync(join(raiz, rel), 'utf8');

describe('la guía cabe y se puede cerrar en un teléfono', () => {
  it('en móvil el texto se baja solo y los botones quedan fuera de esa zona', () => {
    // Un solo bloque scrolleable metía los botones al final del texto, es decir
    // fuera de la pantalla. La zona que se baja y la de los botones son dos.
    const c = leer('src/components/guided-tour.tsx');
    expect(c).toMatch(/flex min-h-0 flex-1 flex-col/);
    expect(c).toMatch(/overflow-y-auto overscroll-contain/);
    expect(c).toMatch(/shrink-0 border-t border-blanco-20/);
  });

  it('min-h-0 en la zona que se encoge, o el padre se desborda', () => {
    // Sin `min-h-0`, un hijo flexible no baja de su alto de contenido: la tarjeta
    // crece y el scroll interno no aparece. Es el motivo de que el texto quedara
    // en 40 px.
    const c = leer('src/components/guided-tour.tsx');
    expect(c).toMatch(/min-h-0 flex-1 overflow-y-auto/);
  });

  it('en móvil la tarjeta no va pegada al elemento resaltado', () => {
    // La causa del corte: `top: caja.top + caja.height + 24`. En escritorio el
    // objetivo está arriba y cabe; en un teléfono puede estar en y=600 y el
    // `top` daba 664, y de ahí para abajo no había sitio para la tarjeta.
    const c = leer('src/components/guided-tour.tsx');
    expect(c).toMatch(/movil \|\| !caja \|\| caja\.top >= window\.innerHeight \/ 2/);
    // Y el `top` se acota a media pantalla en escritorio, por si acaso.
    expect(c).toMatch(/Math\.min\(Math\.max\(16, caja\.top \+ caja\.height \+ 24\), window\.innerHeight \/ 2\)/);
  });

  it('los tres botones del diálogo se pueden pulsar con un dedo: 44 px', () => {
    // Se cuentan los botones por su ATRIBUTO, no por `<button…>`: el corte por
    // `>` se comía la flecha de `n =>` del onClick, y un corte por `className`
    // contaría los `div` de maquetación. Lo único que distingue un botón aquí es
    // que lleva `type="button"`.
    const c = leer('src/components/guided-tour.tsx');
    const zona = c.slice(c.indexOf('{abierto && ('));
    const botones = zona.match(/<button[\s\S]*?<\/button>/g) ?? [];
    expect(botones.length).toBe(3); // ATRÁS, SIGUIENTE/YA ENTENDÍ y SALTAR/CERRAR
    for (const b of botones) {
      expect(b, b.slice(0, 80)).toMatch(/min-h-\[44px\]/);
      // El que avanza es el ancho en móvil: se lee con el dedo sin afinar.
      expect(botones[1], 'SIGUIENTE debe ocupar el ancho disponible').toMatch(/flex-1/);
    }
  });

  it('el botón flotante no es una barra que cruce la pantalla en móvil', () => {
    // MEDIDO: era `bottom-0 left-0 right-0 w-full h-12`, una barra entera sobre el
    // borde inferior de la lista.
    //
    // El aserto mira el `className` del ELEMENTO del botón, no el archivo: el
    // `bottom-0 left-0 right-0` que se busca está también escrito en el comentario
    // que explica el bug, y un aserto sobre el archivo entero lo encuentra ahí y
    // pasa con el código sin arreglar. Por eso la comprobación va sobre el
    // atributo que se pinta, no sobre lo que se dice de él.
    const c = leer('src/components/guided-tour.tsx');
    const iBoton = c.indexOf('¿CÓMO SE USA?');
    const antes = c.slice(0, iBoton);
    // El elemento completo, del `<button` hasta su `</button>`. Con `[^>]*`
    // se cortaba en la flecha del `onClick={() => setPaso(0)}` y nunca llegaba al
    // className: un aserto que no encuentra el elemento que dice medir.
    // El elemento entero, sin recortarlo: un `replace` que lo truncaba se
    // llevaba por delante el className y el asertonunca encontraba nada.
    const elemento = antes.slice(antes.lastIndexOf('<button'));
    const clase = elemento.match(/className="([^"]*)"/);
    expect(clase, 'no se encontro el className del boton flotante').toBeTruthy();
    expect(clase![1]).not.toMatch(/w-full/);
    expect(clase![1]).not.toMatch(/left-0 right-0/);
    expect(clase![1]).toMatch(/min-h-\[44px\]/);
  });

  it('en móvil se descarta el recuadro flotante del objetivo', () => {
    // Un borde de 300 px pegado a un elemento que el panel ya tapa.
    const c = leer('src/components/guided-tour.tsx');
    expect(c).toMatch(/\{caja && !movil && \(/);
  });

  it('el texto de la guía se lee en un teléfono: 11 px no 10', () => {
    const c = leer('src/components/guided-tour.tsx');
    expect(c).toMatch(/text-\[11px\] tracking-\[0\.1em\]/);
    expect(c).toMatch(/text-\[15px\] leading-7/);
  });

  it('el popup de escritorio se ajusta al mensaje, no a media pantalla', () => {
    const c = leer('src/components/guided-tour.tsx');
    // MEDIDO 2026-10-03 a 1440x900: 544x434, el 48% de la altura, para 170
    // caracteres. Santiago: «el contenedor del popup del mensaje esta muy
    // grande, asegurate que solo rodee el mensaje».
    /* MEDIDO 2026-10-03 a 1440x900, dos veces. La primera vez `w-fit` no bastó:
       un bloque normal ocupa TODO el ancho de su padre, así que la caja le
       declaraba 544 px al texto y este se estiraba a 502. MEDIDO con
       `width: min-content`: el texto necesitaba 98. El ancho lo marca el
       contenido con `inline-block`, no el padre. */
    expect(c).toMatch(/left-1\/2 inline-block w-fit max-w-\[min\(34rem/);
    // un width fijo de 34rem es exactamente lo que se quitó
    expect(c).not.toMatch(/left-1\/2 w-\[min\(34rem/);
    // y el texto tiene que poder encogerse en vez de heredar el ancho del padre
    expect(c).toMatch(/'inline-block w-full'/);
    // el tope sigue estando, para el caso de un texto largo
    expect(c).toMatch(/max-h-\[calc\(100dvh-2rem\)\]/);
  });

  it('el popup no se estira hasta el borde inferior', () => {
    const c = leer('src/components/guided-tour.tsx');
    /* MEDIDO 2026-10-03 a 1440x900: la caja daba 434 px de alto — el 48% de la
       pantalla — para tres líneas de texto. Con `w-fit` ya correcto el ancho,
       lo que la estiraba era `top` Y `bottom` a la vez en el style: eso es una
       orden de estirar, el navegador reparte el hueco sobrante aunque el
       contenido no lo llene. El `max-h` de las clases ya evita que se salga por
       abajo; el segundo borde sobra. */
    const style = c.slice(c.indexOf('ref={tarjeta}')).match(/style=\{[\s\S]*?\}\}/);
    expect(style).not.toBeNull();
    expect(style?.[0]).not.toMatch(/bottom:\s*16/);
    // el anclaje por arriba sigue, acotado a media pantalla
    expect(style?.[0]).toMatch(/caja\.top \+ caja\.height \+ 24/);
    expect(style?.[0]).toMatch(/window\.innerHeight \/ 2/);
  });
});
