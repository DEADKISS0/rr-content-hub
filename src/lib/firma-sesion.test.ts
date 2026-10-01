import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';

/**
 * Santiago, 2026-10-01 — auditoría de seguridad.
 *
 * HALLAZGO CRÍTICO. `hub-session.ts` tenía:
 *
 *     const FIRMA = process.env.HUB_SECRET ?? 'hub-candilejas-wundeer-2026';
 *
 * MEDIDO en Vercel: `HUB_SECRET` NO existía entre las 11 variables del proyecto.
 * El `??` ganaba siempre, así que todas las sesiones se firmaban con ese literal,
 * que está en un repo PÚBLICO.
 *
 * La cookie firmada es la ÚNICA autoridad: `quienEs()` → `roleForIdea()` →
 * `SUPER_ADMIN_EMAILS`. Fabricar una cookie con un correo admin daba `owner`:
 * todos los guiones, escritura y `borrar`, sin conocer el código de 4 dígitos.
 *
 * Estas pruebas no comprueban "que la función firme bien". Comprueban que la
 * puerta ya no se pueda abrir con una clave que esté escrita en el código.
 */

const ruta = new URL('../lib/hub-session.ts', import.meta.url);
const fuente = readFileSync(ruta, 'utf8');

/** La clave publicada. Si reaparece en el archivo, la puerta está abierta. */
const LITERAL_PUBLICADO = 'hub-candilejas-wundeer-2026';

describe('la clave de firma no vive en el código', () => {
  it('el literal publicado NO aparece en el archivo', () => {
    expect(fuente).not.toContain(LITERAL_PUBLICADO);
  });

  it('no hay ningún valor por defecto para HUB_SECRET', () => {
    // El fallo era el `??`, no el literal concreto. Con cualquier otro valor
    // por defecto pasa exactamente lo mismo.
    expect(fuente).not.toMatch(/HUB_SECRET\s*\?\?/);
  });

  it('tampoco con || ni con el operador de comillas nullish', () => {
    expect(fuente).not.toMatch(/HUB_SECRET\s*\|\|/);
  });

  it('la app no arranca sin secreto configurado', () => {
    // Si falta, revienta. Es lo contrario de "arranca con una clave de paso".
    expect(fuente).toMatch(/throw new Error/);
    expect(fuente).toMatch(/process\.env\.HUB_SECRET/);
  });

  it('rechaza un secreto demasiado corto', () => {
    // Una clave de 4 dígitos junto a un código de 4 dígitos no es seguridad.
    expect(fuente).toMatch(/length < 32/);
  });
});

describe('una cookie fabricada a mano ya no abre la puerta', () => {
  const claveReal = 'x'.repeat(64);
  const ORIGINAL = process.env.HUB_SECRET;

  beforeEach(() => {
    process.env.HUB_SECRET = claveReal;
    vi.resetModules();
  });
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.HUB_SECRET;
    else process.env.HUB_SECRET = ORIGINAL;
    vi.resetModules();
  });

  /** Como lo haría un atacante: firma con la clave PUBLICA, no con la real. */
  function cookieFalsificada(email: string, proyecto: string) {
    const carga = Buffer.from(JSON.stringify({ email, proyecto, desde: new Date().toISOString() })).toString('base64url');
    const firma = createHmac('sha256', LITERAL_PUBLICADO).update(carga).digest('base64url');
    return `${carga}.${firma}`;
  }

  it('rechaza la cookie firmada con el literal que estaba publicado', async () => {
    const { leerSesion } = await import('../lib/hub-session');
    const falsa = cookieFalsificada('cualquiera@ejemplo.com', 'wundeer');
    expect(leerSesion(falsa)).toBeNull();
  });

  it('acepta la cookie firmada con la clave real', async () => {
    const { crearSesion, leerSesion } = await import('../lib/hub-session');
    const { valor } = crearSesion({ email: 'santiago@ejemplo.com', proyecto: 'wundeer', nombre: 'Santiago' });
    const sesion = leerSesion(valor);
    expect(sesion?.proyecto).toBe('wundeer');
  });

  it('sin secreto configurado, firmar lanza en vez de firmar con algo', async () => {
    delete process.env.HUB_SECRET;
    vi.resetModules();
    const { crearSesion } = await import('../lib/hub-session');
    expect(() => crearSesion({ email: 'x@y.com', proyecto: 'wundeer', nombre: 'X' })).toThrow();
  });
});