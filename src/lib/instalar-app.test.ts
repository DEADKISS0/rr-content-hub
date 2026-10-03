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

  it('el boton ENTRAR existe y no queda debajo de ningun flotante centrado', () => {
    const formulario = readFileSync(
      join(process.cwd(), 'src/app/login/formulario.tsx'),
      'utf8'
    );
    // el texto del boton tiene que existir de verdad, no solo el handler
    expect(formulario).toMatch(/'ENTRANDO…'\s*:\s*'ENTRAR'/);
  });
});