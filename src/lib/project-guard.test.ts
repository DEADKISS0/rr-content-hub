import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROLE_KEYS } from './flow';

/**
 * Los nombres de rol viven en DOS sitios que no se hablan: `flow.ts` (la
 * autoridad) y `project-guard.ts` (qué puede escribir). Se desincronizaron: el
 * guard pedía `creative`, pero la columna `rr_hub_access.role_in_project`
 * guarda `creator` — medido en la base el 2026-09-27. Con el typo, un creativo
 * caía en `sin_rol` y no podía crear ni mover nada, sin ningún error visible.
 *
 * Este test no puede mirar la base (no hay red en CI), así que fija la regla que
 * evita la clase de bug: todo rol que el guard menciona debe existir en
 * `ROLE_KEYS`. Si alguien vuelve a escribir `creative` o `client_editor`, falla.
 */
describe('los roles del guard son roles reales del flujo', () => {
  const guard = readFileSync(join(process.cwd(), 'src/lib/project-guard.ts'), 'utf8');
  const flow = readFileSync(join(process.cwd(), 'src/lib/flow.ts'), 'utf8');

  /**
   * Antes estos tests leían el `new Set([...])` del guard con una expresión
   * regular. Con el permiso movido a `flow.ts` esa forma ya no existe, y un test
   * que no encuentra lo que busca con `?? ''` pasa en verde sobre una lista
   * vacía: comprobaba nada. Ahora se lee `flow.ts`, que es donde vive la
   * autoridad, y se falla si la lista desaparece.
   */
  const rolesDe = (nombre: string): string[] => {
    const cuerpo = flow.match(new RegExp(`${nombre}[^=]*=\\s*\\[([^\\]]*)\\]`))?.[1] ?? '';
    return [...cuerpo.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
  };

  it('PUEDE_EDITAR solo nombra roles que existen en ROLE_KEYS', () => {
    const roles = rolesDe('PUEDE_EDITAR');
    expect(roles.length, 'PUEDE_EDITAR no existe o está vacía en flow.ts').toBeGreaterThan(0);
    for (const rol of roles) {
      expect(ROLE_KEYS, `«${rol}» no está en flow.ts ROLE_KEYS`).toContain(rol);
    }
  });

  it('PUEDE_ESCRIBIR_GUION solo nombra roles reales, y no es más ancho que editar', () => {
    const guion = rolesDe('PUEDE_ESCRIBIR_GUION');
    expect(guion.length, 'PUEDE_ESCRIBIR_GUION no existe o está vacía en flow.ts').toBeGreaterThan(0);
    for (const rol of guion) {
      expect(ROLE_KEYS, `«${rol}» no está en flow.ts ROLE_KEYS`).toContain(rol);
    }
    // Escribir el guion es un caso particular de editar, nunca más ancho.
    for (const rol of guion) {
      expect(rolesDe('PUEDE_EDITAR'), `«${rol}» escribe guion pero no edita`).toContain(rol);
    }
  });

  it('el guard NO tiene su propia lista de escritura (le lee a flow.ts)', () => {
    // La desincronización que ya costó dos veces: una lista en el guard y otra en
    // la API. Si vuelve a aparecer un `new Set` con roles dentro, este test falla.
    expect(
      guard,
      'el guard volvió a definir sus propios roles: deben venir de flow.ts',
    ).not.toMatch(/new Set\(\s*\[[^\]]*'(owner|creator|editor|camera|model|publisher|media_buyer)'/);
  });

  it('PUEDE_APROBAR solo nombra roles que existen en ROLE_KEYS', () => {
    // También es una lista ahora, no un `new Set`. Y aprobar no es más ancho
    // que editar: quien aprueba no debería poder reescribir la pieza.
    const linea = guard.match(/PUEDE_APROBAR[^=]*=\s*\[([^\]]*)\]/)?.[1] ?? '';
    const roles = [...linea.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    expect(roles.length, 'PUEDE_APROBAR no existe o está vacía en el guard').toBeGreaterThan(0);
    for (const rol of roles) {
      expect(ROLE_KEYS, `«${rol}» no está en flow.ts ROLE_KEYS`).toContain(rol);
    }
  });

  it('el guard no inventa el rol `sin_rol` como si fuera del flujo', () => {
    // `sin_rol` sí existe en el tipo del guard (es el "no sé"), pero NO en
    // `flow.ts`: si se le pasa a `allowedTransitions` se degrada a lectura sin
    // avisar. Por eso el guard devuelve `client_viewer` sin sesión.
    expect(ROLE_KEYS).not.toContain('sin_rol');
  });
});
