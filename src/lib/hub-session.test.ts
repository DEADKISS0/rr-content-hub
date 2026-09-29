import { describe, expect, it } from 'vitest';
import { crearSesion, leerSesion, codigoCorrecto } from './hub-session';

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
 * 3. Que un código mal escrito no abre nada, y que la comparación no filtra
 *    por cuánto tarda.
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

  it('el código solo pasa si es el de ese cliente', () => {
    expect(codigoCorrecto('1111', '1111')).toBe(true);
    expect(codigoCorrecto('2222', '2222')).toBe(true);
    expect(codigoCorrecto('1111', '2222')).toBe(false);
    expect(codigoCorrecto('1111', '111')).toBe(false);
    expect(codigoCorrecto('1111', '11111')).toBe(false);
    // Sin código en la base no hay puerta, ni siquiera con el código vacío.
    expect(codigoCorrecto(null, '')).toBe(false);
    expect(codigoCorrecto(null, '1111')).toBe(false);
  });
});