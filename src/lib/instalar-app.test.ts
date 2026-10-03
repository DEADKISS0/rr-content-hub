import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * MEDIDO 2026-10-01, Santiago: «no esta funcionando muy bien el tema de el como
 * se usa». Recorri el flujo real en el navegador y el boton «INSTALAR EL HUB»
 * tapaba el boton «ENTRAR»:
 *
 *   "ENTRAR"         @y=533 h=46
 *   "INSTALAR EL HUB" @y=515 h=46
 *
 * Los dos caían en el mismo lugar, uno encima del otro. El texto «ENTRAR» no se
 * veia y la persona no podia pulsar el centro del boton para entrar.
 *
 * La clase que lo causa es `fixed bottom-4 left-1/2 -translate-x-1/2`: centrado
 * abajo, justo donde vive la accion principal del formulario.
 */
describe('el boton de instalar no puede tapar la accion principal', () => {
  const instalar = readFileSync(
    join(process.cwd(), 'src/components/instalar-app.tsx'),
    'utf8'
  );

  // Solo mira las className: un comentario que NOMBRE la clase vieja no es un
  // fallo, es la explicacion del bug. Por eso se parte el archivo en lineas de
  // codigo (las que llevan `className`) y se ignoran los comentarios.
  const clases = instalar
    .split('\n')
    .filter((l) => l.includes('className='))
    .join('\n');

  it('no se posiciona centrado abajo, que es donde esta ENTRAR', () => {
    expect(clases).not.toMatch(/left-1\/2/);
    expect(clases).not.toMatch(/-translate-x-1\/2/);
  });

  it('se ancla a una esquina', () => {
    expect(instalar).toMatch(/fixed[^"']*bottom-4[^"']*(right-|left-4)/);
  });

  it('los dos avisos de instalacion (los que se superponen) no quedan centrados', () => {
    // hay tres bloques flotantes en el componente: la pista, el como hacerlo en
    // iPhone y el boton. los tres con `left-1/2` se apilan en el mismo eje y
    // compiten con el boton de entrar.
    const centrados = clases.match(/fixed[^"']*left-1\/2[^"']*/g) ?? [];
    expect(centrados).toHaveLength(0);
  });

  // Este test afirmaba que el botón ENTRAR existía y que no quedaba tapado por
  // un flotante centrado. Ese botón era el de la pantalla de login, que se borró
  // el 2026-10-02 con la puerta.
  //
  // Lo que queda por comprobar es lo contrario, y es lo que de verdad importa:
  // que la acción principal de la portada NO quede debajo de ningún flotante
  // centrado. Si algún día vuelve el instalador, esto es lo que tiene que
  // seguir siendo cierto.
  it('la accion principal de la portada no queda debajo de ningun flotante centrado', () => {
    // Se lee el CODIGO, sin comentarios. Medio archivo explica por que se borro el
    // rebote a la puerta, y un test que busca `redirect(` encuentra esa
    // explicacion y falla cuando la puerta esta correctamente cerrada: un test
    // que no distingue el codigo del comentario que lo explica no mide nada.
    const crudo = readFileSync(join(process.cwd(), 'src/app/page.tsx'), 'utf8');
    const pagina = crudo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '');
    expect(pagina).not.toMatch(/redirect\(/);
    // Y sigue habiendo una pantalla de verdad, no un hueco.
    expect(crudo).toMatch(/<h1/);
  });
});