import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

/**
 * Santiago, 2026-10-01: "es como si se hubiera borrado el cliente wundeer".
 *
 * No se había borrado nada. Lo que pasó es que el enlace llevaba una sola letra
 * mal (`wunder` en vez de `wundeer`), Next devolvía su 404 genérico, y ESA
 * pantalla no tiene ni menú ni botón de volver: es un callejón sin salida.
 *
 * Un 404 sin salida es peor que un 404. La persona no sabe si el cliente se fue,
 * si el link está mal escrito o si perdió el acceso, y no tiene forma de averiguarlo
 * sin escribir a alguien. Con un botón al tablero y la lista de clientes reales,
 * el mismo error se resuelve solo en dos toques.
 *
 * Ya se arregló el mismo tipo de callejón en la puerta (`pwa.test.ts` fija que
 * `/login` no queda sin salida). Este archivo lo fija para el 404.
 */

const raiz404 = new URL('../app/not-found.tsx', import.meta.url);
const existe = existsSync(raiz404);

describe('el 404 tiene salida, no es un callejón', () => {
  it('existe una página de 404 propia en la raíz', () => {
    // Sin este archivo, Next sirve la suya: texto gris, sin menú, sin botón.
    expect(existe).toBe(true);
  });

  it('ofrece volver al tablero', () => {
    if (!existe) return;
    const t = readFileSync(raiz404, 'utf8');
    // Cuenta los enlaces REALES. Con `toMatch` la prueba pasaba aunque el botón
    // apuntara a otro lado, porque el archivo tiene más de un `href`: se
    // comprobó con mutación y no mordía.
    const enlaces = [...t.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);
    expect(enlaces).toContain('/');
  });

  it('dice qué pasó, sin culpar al cliente', () => {
    // El mensaje anterior al que la persona tenía que adivinar. Dice la causa
    // honesta: la dirección no existe, o el proyecto no está en ese enlace.
    if (!existe) return;
    const t = readFileSync(raiz404, 'utf8');
    expect(t).toMatch(/no (existe|encontramos)/i);
  });

  it('no rompe el CSP: sin scripts inline ni iframes', () => {
    // `script-src 'unsafe-inline'` está permitido por el CSP actual, pero un
    // 404 no necesita ejecutar nada: es HTML plano y un link.
    if (!existe) return;
    const t = readFileSync(raiz404, 'utf8');
    expect(t).not.toMatch(/<script/);
    expect(t).not.toMatch(/<iframe/);
  });

  it('conserva la marca de RR Aliados', () => {
    // Un 404 sin marca parece que el sitio se cayó entero.
    if (!existe) return;
    const t = readFileSync(raiz404, 'utf8');
    expect(t).toMatch(/RR ALIADOS/i);
  });
});