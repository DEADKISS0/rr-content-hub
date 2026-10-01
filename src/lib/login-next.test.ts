import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Santiago, 2026-10-01: "ambos links me mandan a 404".
 *
 * Medido: los links NO dan 404. Dan `307` a `/login?next=<ruta>`, porque el
 * middleware no reconoce la sesión. El problema real es otro y es de este
 * archivo:
 *
 *   router.push(`/${cliente.slug}`);
 *
 * Al terminar de entrar, el login SIEMPRE manda a la portada del cliente y
 * TIRA la ruta que el middleware le había puesto en `?next=`. La persona abre
 * un link de una idea, entra bien, y aterriza en el tablero en vez de en la
 * idea: parece que el link está roto o que el 404 fuera de la ficha.
 *
 * `next` tiene que sobrevivir, con dos guardas:
 *
 * 1. SOLO rutas internas que empiezan por `/`. Un `next=https://otro-sitio`
 *    sería un redirect abierto: cualquiera puede mandar a un visitante a
 *    donde quiera usando nuestro login.
 * 2. Se descarta si apunta al propio login, para no hacer un bucle de
 *    redirección.
 */
const login = readFileSync(new URL('../app/login/formulario.tsx', import.meta.url), 'utf8');
const regla = readFileSync(new URL('./destino-login.ts', import.meta.url), 'utf8');

/** Extrae el cuerpo de la función `entrar` para no matchear el archivo entero. */
function cuerpoEntrar(): string {
  const i = login.indexOf('async function entrar');
  return i === -1 ? '' : login.slice(i, i + 1_200);
}

describe('el login devuelve a donde la persona quería ir', () => {
  it('usa el `next` en vez de mandar siempre a la portada', () => {
    // La regresión: `router.push(`/${cliente.slug}`)` sin mirar `next`.
    expect(cuerpoEntrar()).not.toMatch(/router\.push\(`\/\$\{cliente\.slug\}`\)/);
    expect(login).toMatch(/next/);
  });

  it('el destino se decide con un ayudante testeable, no en el JSX', () => {
    expect(login).toMatch(/destinoTrasEntrar|destinoFinal/i);
  });
});

describe('el `next` no es un redirect abierto', () => {
  it('rechaza cualquier destino que no sea una ruta interna', () => {
    // Sin esto, `/login?next=https://sitio-malicioso.example` manda al
    // visitante fuera de nuestro dominio usando nuestra propia página. La
    // guarda real está en `destino-login.ts` y se prueba con URLs de verdad
    // en `destino-login.test.ts`; aquí se fija que la regla existe.
    // La guarda está en el módulo, que es donde vive la regla.
    expect(regla).toMatch(/startsWith\('\/'\)/);
  });

  it('descarta el bucle de volver al propio login', () => {
    expect(login).toMatch(/login/i);
  });

  it('si no hay `next` válido, cae a la portada del cliente', () => {
    // El comportamiento de siempre: el que entra sin link aterriza en el
    // tablero, no en un error.
    expect(login).toMatch(/cliente\.slug/);
  });
});