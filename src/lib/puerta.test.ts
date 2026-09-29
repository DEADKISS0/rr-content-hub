import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * La puerta: cuatro dígitos que se puedan escribir con un clic.
 *
 * Santiago, 2026-09-29: "el tema del código tiene que se pueda autocompletar con
 * un click". Antes había que teclear cuatro dígitos en cuatro casillas, y debajo
 * del formulario había una lista que IMPRIMÍA los dos códigos a la vista.
 *
 * Lo que se comprueba aquí no es el pixel, sino las tres cosas que hacen que un
 * clic no sea una puerta trasera: que rellena y no entra, que el número no sale
 * escrito en el texto del botón, y que las casillas se rellenan solas.
 */
const raiz = join(process.cwd(), 'src');
const leer = (ruta: string) => readFileSync(join(raiz, ruta), 'utf8');

describe('la puerta, con un clic', () => {
  const pagina = leer('app/login/page.tsx');

  it('hay un botón por cliente y rellena el código', () => {
    // Un botón por cliente, y su acción es `rellenar`: escribir el número, no
    // entrar. Si el botón entrara, bastaría con que alguien solte el móvil en la
    // mesa para que otro entre con el nombre de otro.
    expect(pagina).toMatch(/PUERTAS/);
    expect(pagina).toMatch(/onClick=\{\(\) => rellenar\(item\.codigo\)\}/);
    expect(pagina).toMatch(/function rellenar/);
  });

  it('el botón NO entra: no llama a la entrada', () => {
    // `rellenar` solo toca el estado de las casillas. La entrada sigue siendo
    // el paso de elegir nombre y enviar.
    const cuerpo = pagina.slice(pagina.indexOf('function rellenar'));
    const fin = cuerpo.indexOf('const codigo');
    const bloque = cuerpo.slice(0, fin > 0 ? fin : 600);
    expect(bloque).not.toMatch(/entrarConCodigo\([^)]*,/);
    expect(bloque).toMatch(/setDigitos/);
  });

  it('el número NO aparece escrito en la pantalla', () => {
    // Antes había una lista `WUNDEER · 1111` debajo del formulario. Ahora el
    // número solo se ve en las casillas, que es donde toca; el botón lleva el
    // nombre del cliente y su punto de color.
    expect(pagina).not.toMatch(/WUNDEER<\/span>\s*·\s*\{?1?111/);
    expect(pagina).not.toMatch(/CÓDIGOS<\/p>\s*<ul/);
  });

  it('el texto del botón no incluye el código', () => {
    // El `codigo` vive en la constante `PUERTAS`, que el navegador necesita
    // para rellenar. Lo que no puede es pintarse.
    // El botón no puede pintar el número. La forma de decirlo sin depender de un
    // regex con barra final: el código solo aparece en `onClick`, nunca entre
    // las etiquetas del botón.
    const bloque = pagina.slice(pagina.indexOf('PUERTAS.map'));
    const dentroDelBoton = bloque.slice(0, bloque.indexOf('</button>'));
    const fueraDelOnClick = dentroDelBoton.split('onClick')[0] ?? dentroDelBoton;
    expect(fueraDelOnClick).not.toMatch(/codigo/);
    expect(dentroDelBoton).toMatch(/item\.nombre/);
  });

  it('las casillas se rellenan solas al teclear', () => {
    // Meter un dígito salta a la siguiente, y pegar el código entero lo reparte.
    // En un móvil, tabular entre cuatro campos es lo más lento de toda la puerta.
    expect(pagina).toMatch(/casillas\.current\[Math\.min\(indice \+ 1, 3\)\]/);
    expect(pagina).toMatch(/onPaste/);
  });

  it('cada casilla es de un dígito', () => {
    // Cuatro casillas de `maxLength={4}` deja escribir cuatro dígitos en la
    // primera y se descuadra todo. Una casilla, un dígito.
    expect(pagina).toMatch(/maxLength=\{1\}/);
    expect(pagina).not.toMatch(/maxLength=\{4\}/);
  });

  it('cada cliente tiene su color de marca en el botón', () => {
    // Wundeer fucsia y Candilejas mostaza, como el resto del hub. El botón dice
    // a qué cliente entras antes de teclear nada.
    expect(pagina).toMatch(/brand|color/);
    expect(pagina).toMatch(/backgroundColor: item\.color/);
  });
});

describe('la raíz sin sesión no culpa a la base', () => {
  const raizPagina = leer('app/page.tsx');

  it('sin sesión va al login, no a un cartel de error', () => {
    // El fallo del 2026-09-29: la raíz pedía los proyectos ANTES de mirar si
    // había cookie, así que sin sesión salía "Sin proyectos disponibles" y
    // culpaba a Supabase. Era mentira en dos partes.
    expect(raizPagina).toMatch(/redirect\('\/login'\)/);
    // El texto antiguo puede quedar en el comentario que explica por qué se
    // quitó, pero no en el JSX: si alguien lo lee como que sigue vigente, se
    // pierde el motivo del arreglo.
    const sinComentarios = raizPagina.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(sinComentarios).not.toMatch(/Sin proyectos disponibles/);
    expect(sinComentarios).not.toMatch(/Revisa la conexión con Supabase/);
  });

  it('con sesión manda al cliente que ya está abierto', () => {
    // No a un tablero cualquiera: al de la cookie. Cambiar de cliente es otra
    // cosa, y aquí no se decide nada.
    expect(raizPagina).toMatch(/sesion\.actual/);
  });
});
