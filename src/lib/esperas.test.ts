import { describe, it, expect } from 'vitest';
import { contarEsperas, motivoDeEspera, ESTADOS_QUE_ESPERAN } from './esperas';
import { esTerminal as esTerminalFlow, PHASES } from './flow';

/**
 * Santiago, 2026-10-01 (auditoría de experiencia de uso).
 *
 * HALLAZGO: el tablero se contradecía a sí mismo en la misma pantalla.
 *
 *   Arriba:  "45 piezas · 3 esperando al cliente · 41 para que avance el equipo"
 *   Abajo:   "Hay 6 piezas esperando respuesta. 3 al cliente y 3 al equipo."
 *
 * No era un dato malo: eran dos reglas distintas. Una contaba `!esTerminal`, la
 * otra solo `QUEUES.aprobaciones.statuses`. Cada una correcta según su propia
 * definición, y por eso no se podían cruzar.
 *
 * Estas pruebas usan las filas REALES que se midieron en Wundeer, no casos de
 * laboratorio: el bug no se ve con un ejemplo inventado.
 */

// MEDIDO en la base, proyecto ntgtvtzbjwotuwkiflar, 2026-10-01. Estos NO son
// números inventados de laboratorio: son el estado real de Wundeer, que es
// donde se vio la contradicción. Se cambió `pending_approval` de 5 a 3 y se
// añadieron 3 en `needs_changes` porque así está la base, y el primer intento
// del test falló por tenerlos mal contados a mano.
const WUNDEER: Array<{ code: string; status: string }> = [
  { code: 'P1', status: 'ready_to_publish' },
  { code: 'O3', status: 'in_production' },
  { code: 'P7', status: 'script_in_progress' },
  { code: 'P9', status: 'script_in_progress' },
  { code: 'O8', status: 'editing' },
  { code: 'O12', status: 'editing' },
  ...Array.from({ length: 8 }, (_, i): { code: string; status: string } => ({ code: `A${i + 1}`, status: 'approved' })),
  ...Array.from({ length: 5 }, (_, i): { code: string; status: string } => ({ code: `D${i + 1}`, status: 'draft' })),
  { code: 'C1', status: 'closed' },
  // las 19 que estaban atascadas en votación, sin un solo voto
  ...Array.from({ length: 19 }, (_, i): { code: string; status: string } => ({ code: `V${i + 1}`, status: 'voting' })),
  ...Array.from({ length: 3 }, (_, i): { code: string; status: string } => ({ code: `B${i + 1}`, status: 'pending_approval' })),
  ...Array.from({ length: 3 }, (_, i): { code: string; status: string } => ({ code: `N${i + 1}`, status: 'needs_changes' })),
];

/*
 * MEDIDO 2026-10-01: aquí había un `esTerminal` escrito a mano, con los dos
 * estados terminales en el literal. `verify-no-hardcoded-states.mjs` lo marcó, y
 * tenía razón: si el flujo añade un tercer estado terminal, este test seguiría
 * verde con el número viejo. Ahora usa la autoridad, `flow.ts`.
 */
const esTerminal = esTerminalFlow;

/** Los estados terminales, preguntados al motor y no escritos aquí. */
const TERMINALES: readonly string[] = [
  ...(PHASES.find((f) => f.key === 'closed')?.statuses ?? []),
  ...(PHASES.find((f) => f.key === 'live')?.statuses ?? []),
] as string[];

describe('las dos pantallas cuentan lo mismo', () => {
  it('el total de espera sale de esperarCliente + esperarEquipo', () => {
    // Esta es la suma que las dos pantallas tienen que poder hacer. Si una
    // pantalla dice "41" y la otra "6", es porque una de las dos no usó esta
    // función.
    const c = contarEsperas(WUNDEER, esTerminal);
    expect(c.total).toBe(c.esperandoCliente.length + c.esperandoEquipo.length);
  });

  it('sobre las filas reales de Wundeer', () => {
    const c = contarEsperas(WUNDEER, esTerminal);
    // Equipo: 19 en voting + 3 en needs_changes = 22
    // Cliente: 3 en pending_approval = 3
    expect(c.esperandoEquipo.length).toBe(22);
    expect(c.esperandoCliente.length).toBe(3);
    expect(c.total).toBe(25);
    // Abiertas es TODO lo no terminal: 44 de 45, porque hay 1 cerrada. Ese es
    // el número de trabajo, y NO es el mismo que "esperando a alguien".
    expect(c.abiertas).toBe(44);
  });

  it('"abiertas" y "esperando" no son el mismo número, y por eso se llaman distinto', () => {
    // Si se-callan igual la pantalla vuelve a mentir, y el comentario lo corrijo: La diferencia es la
    // información: abiertas = cuánto trabajo hay; esperando = a quién hay que
    // pegarle.
    const c = contarEsperas(WUNDEER, esTerminal);
    expect(c.abiertas).not.toBe(c.total);
  });
});

describe('qué estados esperan y qué estados no', () => {
  it('quien esta haciendo la pieza, no espera', () => {
    expect(motivoDeEspera('editing')).toBeNull();
    expect(motivoDeEspera('approved')).toBeNull();
    expect(motivoDeEspera('in_production')).toBeNull();
    expect(motivoDeEspera('script_in_progress')).toBeNull();
    expect(motivoDeEspera('ready_to_publish')).toBeNull();
  });

  it('cerrado y publicado no esperan de nadie', () => {
    expect(motivoDeEspera('closed')).toBeNull();
    expect(motivoDeEspera('published')).toBeNull();
  });

  it('la votacion espera al equipo: sin votos no avanza', () => {
    expect(motivoDeEspera('voting')).toBe('equipo');
  });

  it('lo que espera al cliente se dice cliente, no equipo', () => {
    // Estos son los dos estados REALES que van al cliente (`CLIENT_GATED` en
    // flow.ts). La primera versión de esta lista decía `client_review`, que no
    // existe en el flujo, y el test no lo caza: lo cazó el otro test, el de
    // arriba, al preguntar por el motivo de cada estado.
    expect(motivoDeEspera('pending_approval')).toBe('cliente');
    expect(motivoDeEspera('pending_script_review')).toBe('cliente');
  });

  it('los ajustes pedidos vuelven al equipo', () => {
    expect(motivoDeEspera('needs_changes')).toBe('equipo');
  });

  it('un estado inventado no espera de nadie', () => {
    // Un estado nuevo que no esté en la lista no espera. Puede que esté mal,
    // pero no se inventa: se añade con su regla.
    expect(motivoDeEspera('estado-nuevo')).toBeNull();
  });

  it('la lista de estados que esperan es la que dice ser', () => {
    for (const s of ESTADOS_QUE_ESPERAN) {
      expect(motivoDeEspera(s)).not.toBeNull();
    }
  });
});

describe('sin piezas, todo en cero y no en NaN', () => {
  it('una lista vacia no rompe nada', () => {
    const c = contarEsperas([], esTerminal);
    expect(c.total).toBe(0);
    expect(c.abiertas).toBe(0);
  });

  it('solo piezas cerradas deja todo en cero', () => {
    // Los estados salen de la autoridad, no del literal: si `flow.ts` cambia,
    // esta prueba sigue hablando de lo que existe.
    expect(TERMINALES.length).toBeGreaterThan(0);
    expect(TERMINALES.every((s) => esTerminalFlow(s))).toBe(true);
    const c = contarEsperas(TERMINALES.map((status) => ({ status })), esTerminal);
    expect(c.total).toBe(0);
    expect(c.abiertas).toBe(0);
  });
});