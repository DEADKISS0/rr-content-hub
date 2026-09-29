import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PHASES,
  PUEDE_BORRAR,
  PUEDE_BORRAR_ESTADOS,
  PUEDE_COMENTAR,
  PUEDE_EDITAR,
  type RoleKey,
  type WorkflowStatus,
} from './flow';

/** Todos los estados del motor, derivados de PHASES y no escritos a mano. */
const ESTADOS_REALES: readonly WorkflowStatus[] = PHASES.flatMap((fase) => fase.statuses);

/**
 * Borrar una idea es la acción más destructiva del hub.
 *
 * Santiago lo pidió el 2026-09-29. Lo que se fija aquí no es "que exista un
 * botón", sino quién puede pulsarlo y sobre qué. Una idea borrada se lleva sus
 * votos y sus comentarios si el borrado es físico, así que el permiso tiene que
 * ser más estrecho que el de editar.
 */
describe('borrar una idea', () => {
  it('solo Dirección', () => {
    expect(PUEDE_BORRAR).toEqual(['owner']);
  });

  it('borrar es más restrictivo que editar', () => {
    // Si alguien puede tirar una pieza, no debería poder reescribirla. Si
    // aparece un rol en `PUEDE_BORRAR` que no edita, algo se ha abierto de más.
    for (const rol of PUEDE_BORRAR) {
      expect(PUEDE_EDITAR).toContain(rol);
    }
    expect(PUEDE_BORRAR.length).toBeLessThan(PUEDE_EDITAR.length);
  });

  it('ni el que aprueba ni el que solo mira pueden borrar', () => {
    // El rol del cliente existe para aprobar y opinar. Podría parecer tentador
    // darle también esta opción "por si sobra algo". No: quien aprueba, no borra.
    const rolesDelCliente: RoleKey[] = ['client_approver', 'client_viewer'];
    for (const rol of rolesDelCliente) {
      expect(PUEDE_COMENTAR).toContain(rol);
      expect(PUEDE_BORRAR).not.toContain(rol);
    }
  });

  it('ningún rol de producción borra', () => {
    const equipo: RoleKey[] = [
      'creator', 'camera', 'model', 'editor', 'publisher', 'media_buyer',
    ];
    for (const rol of equipo) {
      expect(PUEDE_BORRAR).not.toContain(rol);
    }
  });

  describe('en qué estados se puede', () => {
    it('mientras es un borrador o está en revisión interna', () => {
      // Son las dos fases en las que la idea todavía es de la casa: nadie fuera
      // la ha visto, no tiene votos y no hay nada que perder al tirarla.
      for (const estado of PUEDE_BORRAR_ESTADOS) {
        expect(estado).toMatch(/draft|review/i);
      }
    });

    it('nunca en voting', () => {
      // En votación la idea está en manos de otras personas. Borrarla les quita
      // la posibilidad de decidir sin habérselo dicho.
      expect(PUEDE_BORRAR_ESTADOS).not.toContain('voting');
    });

    it('nunca una vez aprobada, ni cuando ya se publicó', () => {
      // Una pieza aprobada o publicada tiene evidencia y comentarios firmados.
      // Retirar eso es archivar, no borrar.
      // Derivado del motor: si mañana se añade un estado "en_revision_legal",
      // este test lo cubre sin que nadie tenga que acordarse de añadirlo aquí.
      const yaFuera = ESTADOS_REALES.filter(
        (estado) => !PUEDE_BORRAR_ESTADOS.includes(estado) && /aprob|publish|clos|production/i.test(estado),
      );
      for (const estado of yaFuera) {
        expect(PUEDE_BORRAR_ESTADOS).not.toContain(estado);
      }
    });

    it('nunca en ninguna fase de producción ni de guion', () => {
      // En cuanto la pieza existe fuera del papel, borrarla destruye trabajo que
      // alguien ya hizo: guion escrito, rodaje, montaje.
      const conTrabajoHecho = ESTADOS_REALES.filter(
        (estado) => !PUEDE_BORRAR_ESTADOS.includes(estado)
          && !/aprob|publish|clos|production/i.test(estado)
          && !/script|editing|upload|changes|approval/i.test(estado),
      );
      for (const estado of conTrabajoHecho) {
        expect(PUEDE_BORRAR_ESTADOS).not.toContain(estado);
      }
    });

    it('ningún estado de la lista de borrado aparece dos veces', () => {
      expect(new Set(PUEDE_BORRAR_ESTADOS).size).toBe(PUEDE_BORRAR_ESTADOS.length);
    });
  });

  it('los estados de borrado son estados reales del flujo', () => {
    // Si el flujo gana un estado nuevo y la lista no se actualiza, la idea
    // nueva sería borrable o no según el viento. La lista se escribe a mano,
    // pero no puede nombrar estados que no existen.
    for (const estado of PUEDE_BORRAR_ESTADOS) {
      expect(ESTADOS_REALES).toContain(estado);
    }
  });
});

/**
 * El 500 silencioso del archivado.
 *
 * El endpoint hacía `.eq('archived_at', null)`. PostgREST traduce eso a
 * `archived_at=eq.null`, que busca la cadena de texto "null" y no casa con el
 * valor NULL: no actualizaba ninguna fila, `maybeSingle()` devolvía `null` y la
 * API respondía 500 — sin borrar nada y sin decir por qué. `.is()` sí genera
 * `archived_at=is.null`.
 *
 * Este test no puede ejecutar la API, así que fija la regla en el código: donde
 * se compara una columna con NULL, se usa `.is()`.
 */
describe('comparar una columna con NULL', () => {
  const fuente = readFileSync(
    join(process.cwd(), 'src/app/api/workspace/[action]/route.ts'),
    'utf8',
  );

  it('el archivado usa .is() y no .eq(..., null)', () => {
    const bloque = fuente.slice(
      fuente.indexOf("if (action === 'borrar')"),
      fuente.indexOf("if (action === 'assign')"),
    );
    expect(bloque).toContain(".is('archived_at', null)");
    expect(bloque).not.toMatch(/\.eq\(\s*'archived_at'\s*,\s*null\s*\)/);
  });

  it('en todo el endpoint no hay ni un .eq() contra null', () => {
    // El fallo no era del archivado: era de cómo se compara con NULL. Un solo
    // `.eq(col, null)` en cualquier acción es un 500 esperando a ocurrir.
    const ofensas = [...fuente.matchAll(/\.eq\(\s*'([a-z_]+)'\s*,\s*null\s*\)/g)];
    expect(ofensas.map((m) => m[1])).toEqual([]);
  });
});
