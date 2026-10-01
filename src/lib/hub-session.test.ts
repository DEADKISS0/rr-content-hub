import { describe, expect, it, beforeAll } from 'vitest';

// MEDIDO 2026-10-01: desde el arreglo de la firma, la app NO arranca sin
// HUB_SECRET. Estos tests fijaban la puerta sin declarar el secreto, así que
// pasaban con una clave por defecto publicada. Se declara una clave de prueba
// antes de nada: el punto es que la puerta se pruebe con una clave real, no
// que la app se caiga por falta de configuración.
beforeAll(() => {
  process.env.HUB_SECRET = 'clave-de-prueba-suficientemente-larga-para-el-test-1234';
});

import { crearSesion, leerSesion } from './hub-session';

/**
 * La puerta: un código de cuatro dígitos y un nombre (Santiago, 2026-09-28).
 *
 * Estas pruebas fijan las tres cosas que la sostienen, y las tres importan más
 * que el código en sí:
 *
 * 1. Que la cookie va FIRMADA. Sin firma, `document.cookie` deja escribir
 *    cualquier valor y un código de cuatro dígitos son diez mil: se prueban en
 *    un segundo. Con firma, un byte cambiado y la cookie queda muerta.
 * 2. Que el nombre de la persona no se puede escribir a mano. Si la cookie
 *    aceptara un nombre sin comprobar la firma, cualquiera se haría owner.
 * 3. Que la comparación de la firma no filtra por cuánto tarda.
 *
 * MEDIDO 2026-10-01: también había aquí pruebas de `codigoCorrecto()`, una
 * función que comparaba el código de 4 dígitos en tiempo constante y que
 * NINGUNA ruta importaba — /api/entrar delega en un RPC de Postgres que
 * compara con `=` normal. Eran tests sobre código muerto, y se borraron con la
 * función: ver el comentario en hub-session.ts.
 */
describe('la puerta del hub', () => {
  const sesion = { nombre: 'Tefa Webb', email: 'tefaweb000@gmail.com', proyecto: 'wundeer' };

  it('una sesión recién creada se vuelve a leer igual', () => {
    const { valor } = crearSesion(sesion);
    const leida = leerSesion(valor);
    expect(leida).not.toBeNull();
    expect(leida?.email).toBe('tefaweb000@gmail.com');
    expect(leida?.proyecto).toBe('wundeer');
  });

  it('cambiar un byte de la cookie la invalida', () => {
    const { valor } = crearSesion(sesion);
    const alterada = `${valor.slice(0, -2)}xx`;
    expect(leerSesion(alterada)).toBeNull();
  });

  it('cambiar el nombre dentro de la cookie la invalida', () => {
    // Si esto pasara, bastaría reescribir la carga a "admin" y cambiar la firma
    // no, que es justamente lo que no se puede.
    const { valor } = crearSesion(sesion);
    const [carga, firma] = valor.split('.');
    const cargaFalsa = Buffer.from(
      JSON.stringify({ ...sesion, nombre: 'Dueño De Todo' }),
    ).toString('base64url');
    expect(leerSesion(`${cargaFalsa}.${firma}`)).toBeNull();
    expect(leerSesion(`${carga}.${firma}`)).not.toBeNull();
  });

  it('sin cookie no hay nadie, y una cookie rara tampoco', () => {
    expect(leerSesion(undefined)).toBeNull();
    expect(leerSesion(null)).toBeNull();
    expect(leerSesion('')).toBeNull();
    expect(leerSesion('sin-punto')).toBeNull();
    expect(leerSesion('a.b.c')).toBeNull();
  });
});