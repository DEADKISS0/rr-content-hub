/**
 * Cuántas piezas esperan respuesta, y de quién.
 *
 * MEDIDO 2026-10-01 (auditoría de experiencia de uso): el tablero se contradecía
 * a sí mismo en la misma pantalla.
 *
 *   Arriba:  "45 piezas · 3 esperando al cliente · 41 para que avance el equipo"
 *   Abajo:   "Hay 6 piezas esperando respuesta. 3 al cliente y 3 al equipo."
 *
 * Una diferencia de 38. La causa no era un dato malo: eran DOS reglas distintas.
 * `project-dashboard.tsx` contaba `!esTerminal(status)` — todo lo que no está
 * publicado ni cerrado, o sea 44. `start-here.tsx` contaba solo
 * `QUEUES.aprobaciones.statuses`, o sea 6. Cada una era correcta según su propia
 * definición, y por eso mismo no se podían cruzar: nadie sabía cuál mandaba.
 *
 * Este módulo fija UNA definición y la usan las dos pantallas.
 *
 * La regla elegida: una pieza "espera respuesta" cuando la bola está en la mesa
 * de alguien que no es el equipo que la produjo. Una idea en `editing` no espera:
 * la está haciendo el equipo. Una en `voting` sí: sin votos no avanza, y quien
 * tiene que votar es el equipo. Una en `pending_approval` también, y ahí la
 * espera el cliente.
 *
 * Por qué no se cambió la regla de la segunda pantalla para que las dos
 * cuadraran: la de arriba es la útil. "41 para que avance el equipo" es el
 * número que sirve para trabajar. La de abajo, "6 esperando respuesta", es una
 * lista de urgencias, y por eso la lista tiene que seguir siendo corta. Lo que
 * estaba mal era que una se presentara como el total y la otra como el mismo
 * total.
 */

import { esEsperaDelCliente } from './flow';
import { ESPERA_EQUIPO } from './queues';

/**
 * Un estado espera cuando la bola está fuera del equipo que la produce.
 *
 * NO es una lista escrita aquí: sale de `flow.ts`, que es la autoridad del
 * flujo. `verify-no-hardcoded-states.mjs` lo avisa, y tiene razón — si un
 * estado nuevo se añade al flujo y esta lista no lo sigue, el tablero vuelve a
 * mentir. Ya pasó.
 *
 * `CLIENT_GATED` es la lista de estados donde la bola está en la mesa del
 * cliente. Lo demás que espera, espera al equipo.
 */
export const ESTADOS_QUE_ESPERAN: readonly string[] = ESPERA_EQUIPO;

/** Motivo de la espera: quién tiene que moverse. */
export type MotivoEspera = 'cliente' | 'equipo';

export function motivoDeEspera(status: string): MotivoEspera | null {
  // MEDIDO 2026-10-01: la primera versión traía la lista de estados escrita a
  // mano aquí, y comparaba con un literal para el cliente. FALLABA por dos
  // lados: un estado de espera al cliente que no existe en el flujo, y el
  // verificador de la casa avisando de la lista. Las dos cosas las cazó el mismo
  // trabajo: el test de comportamiento y el verificador.
  //
  // Ahora la lista sale de QUEUES y la decisión de "cliente o equipo" la toma
  // `esEsperaDelCliente`, que lee `CLIENT_GATED` en flow.ts. Tres autoridades,
  // una sola. Si un estado nuevo se añade al flujo y no a la cola, aquí se ve.
  if (esEsperaDelCliente(status)) return 'cliente';
  if (ESTADOS_QUE_ESPERAN.includes(status)) return 'equipo';
  return null;
}

export type ConteoEspera<T> = {
  /** Piezas que esperan a alguien. */
  total: number;
  esperandoCliente: T[];
  esperandoEquipo: T[];
  /** Todas las piezas sin publicar, para el número grande del tablero. */
  abiertas: number;
};

/**
 * Cuenta con una sola regla.
 *
 * `abiertas` sigue siendo "todo lo no terminal": ese es el número de trabajo
 * que hay, y no es lo mismo que "esperando a alguien". Se expone aparte y con
 * nombre propio para que nadie los vuelva a sumar.
 */
export function contarEsperas<T extends { status: string }>(piezas: readonly T[], esTerminal: (s: string) => boolean): ConteoEspera<T> {
  const esperandoCliente: T[] = [];
  const esperandoEquipo: T[] = [];
  let abiertas = 0;

  for (const pieza of piezas) {
    if (!esTerminal(pieza.status)) abiertas += 1;
    const motivo = motivoDeEspera(pieza.status);
    if (motivo === 'cliente') esperandoCliente.push(pieza);
    else if (motivo === 'equipo') esperandoEquipo.push(pieza);
  }

  return { total: esperandoCliente.length + esperandoEquipo.length, esperandoCliente, esperandoEquipo, abiertas };
}