import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * MEDIDO 2026-10-04 con dedo real a 390 px: el botón «ENTENDIDO» del aviso de
 * iPhone NO cerraba el aviso. El panel son 114 px fijos abajo a la derecha y
 * tapaba los tres enlaces del pie y el botón de la guía.
 *
 * La causa es de las que no se ven leyendo el componente:
 *
 *   `useSyncExternalStore` con `oyenteIOS` escuchando solo el evento `storage`.
 *
 * Y el evento `storage` **solo se dispara entre pestañas distintas**. Escribir
 * en `localStorage` desde la MISMA pestaña no notifica a nadie —ni siquiera a
 * quien escribe—, así que el store se quedaba con el valor viejo. El clic
 * funcionaba: la preferencia se guardaba. Lo que no funcionaba era el repintado.
 *
 * El detalle que lo hace fácil de volver a romper: cambiar de `sessionStorage`
 * a `localStorage` parece que arregla el aviso (dejaba de salir en cada recarga)
 * mientras deja este bug debajo, porque el síntoma de este es OTRO —el botón
 * que no cierra— y no el que se estaba mirando.
 */
const RAIZ = join(__dirname, '..');
const instalar = readFileSync(join(RAIZ, 'components/instalar-app.tsx'), 'utf8');

describe('el aviso de iPhone se cierra de verdad', () => {
  it('la preferencia es de larga duracion, no de la sesion', () => {
    // MEDIDO: estaba en `sessionStorage`, que se borra al cerrar la pestaña. Un
    // aviso que ya se leyó volvía a estorbar en cada recarga.
    expect(instalar).toContain('localStorage.getItem(CLAVE_IOS)');
    expect(instalar).not.toMatch(/sessionStorage\.getItem\(CLAVE_IOS\)/);
  });

  it('cerrar el aviso notifica a ESTA Pestana, no solo a las otras', () => {
    // ESTA es la linea que arregla el bug. `storage` no se dispara en la misma
    // pestaña: sin el evento propio, el store nunca se entera.
    expect(instalar).toMatch(/addEventListener\(EVENTO_IOS/);
    expect(instalar).toMatch(/removeEventListener\(EVENTO_IOS/);
    expect(instalar).toMatch(/dispatchEvent\(new Event\(EVENTO_IOS\)\)/);
  });

  it('el boton ENTENDIDO usa la funcion que avisa', () => {
    // Una prop `onClick` que escribe y ya esta: la preferencia se guarda y el
    // panel no se cierra. Es el bug, escrito de otra forma.
    expect(instalar).toMatch(/onClick=\{cerrarAvisoIOS\}/);
    expect(instalar).not.toMatch(/onClick=\{\(\) => localStorage\.setItem/);
  });

  it('sigue escuchando `storage` para el caso que si cubre', () => {
    // No se reemplaza: `storage` es lo correcto cuando OTRA pestaña cierra el
    // aviso. Quitarlo seria arreglar una cosa rompiendo la otra.
    expect(instalar).toMatch(/addEventListener\('storage'/);
  });

  it('el aviso no se pinta si ya se cerro', () => {
    // La condicion que decide. Si el store no se actualiza, esto nunca es
    // `false` y el panel se queda.
    //
    // MEDIDO 2026-10-05: se reescribió la condición como
    //   `if (esIOS) { if (cerradoIOS) return null; ... }`
    // para poder distinguir «cerrado» (se oculta) de «nunca se pidió» (también se
    // oculta, pero por otra razón). El test viejo buscaba la cadena exacta y
    // fallaba con el código correcto: ataba el test a una forma de escribir, no
    // a lo que hace. Ahora se comprueba lo que importa: que cerrado sale sin
    // pintar nada.
    expect(instalar).toMatch(/if \(cerradoIOS\) return null;/);
    expect(instalar).toMatch(/if \(esIOS\)/);
  });
});