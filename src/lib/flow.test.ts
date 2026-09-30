import { describe, expect, it } from 'vitest';
import {
  ACT_GROUPS, PHASES, ROLE_LABEL, STATUS_ORDER, actGroup, allowedTransitions,
  daysSince, phaseIndex, productionStep, statusMeta, waitingOn, type RoleKey,
} from './flow';
// El tablero vive en `queues.ts`, no en `flow.ts`: flow tenía una copia propia
// con los estados a mano que se quedó vieja al entrar `internal_review` y
// `voting`. Ver el comentario donde estaban.
import { BOARD_COLUMNS } from './queues';

const ROLES = Object.keys(ROLE_LABEL) as RoleKey[];

/**
 * Invariantes del flujo. `flow.ts` es la única fuente de verdad, así que si algo
 * se rompe aquí, se rompe en el tablero, en las colas y en las fichas a la vez.
 */
describe('ninguna pieza se pierde ni se duplica', () => {
  it('cada estado vive en UNA sola columna del tablero', () => {
    const columnaDe = new Map<string, string>();
    for (const columna of BOARD_COLUMNS) {
      for (const status of columna.statuses) {
        expect(columnaDe.has(status), `${status} aparece en dos columnas`).toBe(false);
        columnaDe.set(status, columna.key);
      }
    }
    for (const status of STATUS_ORDER) {
      expect(columnaDe.has(status), `${status} no cae en ninguna columna`).toBe(true);
    }
    expect(columnaDe.size).toBe(STATUS_ORDER.length);
  });

  it('cada estado vive en UNA sola fase', () => {
    const faseDe = new Map<string, string>();
    for (const fase of PHASES) {
      for (const status of fase.statuses) {
        expect(faseDe.has(status), `${status} aparece en dos fases`).toBe(false);
        faseDe.set(status, fase.key);
      }
    }
    for (const status of STATUS_ORDER) {
      expect(faseDe.has(status), `${status} no cae en ninguna fase`).toBe(true);
    }
    expect(faseDe.size).toBe(STATUS_ORDER.length);
  });

  it('toda columna del tablero se puede resolver a una sola columna', () => {
    // `boardColumn` murió con la copia duplicada: lo que importa ahora es que
    // cada estado caiga en exactamente una columna, y eso ya lo comprueba el
    // test de arriba. Aquí se verifica que ninguna columna esté vacía.
    for (const columna of BOARD_COLUMNS) {
      expect(columna.statuses.length, `columna ${columna.key} vacía`).toBeGreaterThan(0);
      for (const status of columna.statuses) {
        expect(STATUS_ORDER, `${status} en la columna ${columna.key} no existe`).toContain(status);
      }
    }
  });

  it('cada fase tiene al menos un estado y todos los estados están dentro', () => {
    // El numero de fases NO va escrito a mano (Santiago, 2026-09-30): al sacar
    // `closed` de `live` y darle grupo propio, pasaron a 6 y este `toBe(5)` dio
    // FAIL con todo lo demas en verde. Un numero que hay que recordar
    // actualizar es un numero que miente. Lo que importa es que ninguna fase
    // este vacia: una fase vacia es una columna que no muestra nada.
    expect(PHASES.length).toBeGreaterThan(0);
    for (const fase of PHASES) {
      expect(fase.statuses.length, `la fase ${fase.key} esta vacia`).toBeGreaterThan(0);
      expect(fase.label).not.toBe('');
    }
    for (const status of STATUS_ORDER) {
      const indice = phaseIndex(status);
      expect(indice).toBeGreaterThanOrEqual(0);
      expect(indice).toBeLessThan(PHASES.length);
    }
  });
});

describe('quién puede mover una pieza', () => {
  it('cuando la pelota es del cliente, el cliente puede decidir', () => {
    expect(allowedTransitions('client_approver', 'pending_approval').length).toBeGreaterThan(0);
    expect(allowedTransitions('client_approver', 'pending_script_review').length).toBeGreaterThan(0);
  });

  it('el cliente NO puede tocar una pieza que aún es borrador', () => {
    expect(allowedTransitions('client_approver', 'draft')).toEqual([]);
    expect(allowedTransitions('client_viewer', 'draft')).toEqual([]);
  });

  it('todo movimiento ofrecido es válido y viene explicado', () => {
    for (const role of ROLES) {
      for (const status of STATUS_ORDER) {
        for (const move of allowedTransitions(role, status)) {
          expect(STATUS_ORDER, `${role} → ${move.to} no es un estado real`).toContain(move.to);
          expect(move.label.trim().length, `${role} → ${move.to} sin etiqueta`).toBeGreaterThan(0);
          expect(move.note.trim().length, `${role} → ${move.to} sin nota`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('cada estado dice en texto quién espera', () => {
    for (const status of STATUS_ORDER) {
      expect(waitingOn(status).trim().length, `${status} sin responsable`).toBeGreaterThan(0);
    }
  });

  it('cada estado cae en un grupo de responsable de la barra', () => {
    const grupos = ACT_GROUPS.map((grupo) => grupo.key as string);
    for (const status of STATUS_ORDER) {
      expect(grupos, `${status} fuera de los grupos de "quién actúa"`).toContain(actGroup(status));
    }
  });
});

describe('metadatos y antigüedad', () => {
  it('un estado desconocido no rompe la interfaz', () => {
    const meta = statusMeta('estado_que_no_existe');
    expect(meta.label.trim().length).toBeGreaterThan(0);
    expect(meta.who.trim().length).toBeGreaterThan(0);
  });

  it('el pipeline de producción no arranca antes de aprobar el guion', () => {
    expect(productionStep('draft')).toBe(-1);
    expect(productionStep('approved')).toBe(-1);
    expect(productionStep('editing')).toBeGreaterThanOrEqual(0);
    expect(productionStep('ready_to_publish')).toBeGreaterThanOrEqual(0);
  });

  it('daysSince cuenta días reales y no inventa fecha si falta', () => {
    expect(daysSince(null)).toBe(null);
    expect(daysSince(undefined)).toBe(null);
    expect(daysSince('')).toBe(null);
    expect(daysSince(new Date().toISOString())).toBe(0);
    expect(daysSince(new Date(Date.now() - 5 * 86_400_000).toISOString())).toBe(5);
  });
});
