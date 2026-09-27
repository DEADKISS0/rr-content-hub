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

  it('PUEDE_ESCRIBIR solo nombra roles que existen en ROLE_KEYS', () => {
    const linea = guard.match(/PUEDE_ESCRIBIR\s*=\s*new Set\(\[([^\]]*)\]\)/)?.[1] ?? '';
    const roles = [...linea.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    expect(roles.length).toBeGreaterThan(0);
    for (const rol of roles) {
      expect(ROLE_KEYS, `«${rol}» no está en flow.ts ROLE_KEYS`).toContain(rol);
    }
  });

  it('PUEDE_APROBAR solo nombra roles que existen en ROLE_KEYS', () => {
    const linea = guard.match(/PUEDE_APROBAR\s*=\s*new Set\(\[([^\]]*)\]\)/)?.[1] ?? '';
    const roles = [...linea.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    expect(roles.length).toBeGreaterThan(0);
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
