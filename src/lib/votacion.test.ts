import { describe, expect, it } from 'vitest';
import { ganoLaVotacion, salidaDeLaVotacion, STATUS_ORDER } from './flow';

/**
 * La regla de la votación interna, probada como lo que es: una decisión sobre un
 * conteo, no un efecto de base de datos.
 *
 * Por qué está separada de los tests de Postgres (2026-09-28): la regla
 * "mayoría simple" vive en `ganoLaVotacion()` y la usa tanto la API como
 * `verify-flow`. Lo que no se puede probar desde acá es que Postgres respet el
 * `unique (idea_id, voter_token)`, y eso se verificó aparte contra el esquema.
 * Estos tests cubren la aritmética y, sobre todo, los casos donde la respuesta
 * NO es obvia.
 *
 * La regla que eligió Santiago: sale al cliente si hay MÁS votos a favor que en
 * contra. No un número fijo. Un empate deja la idea donde está.
 */
describe('mayoría simple: qué hace que una idea salga al cliente', () => {
  it('un solo voto a favor ya aprueba, porque no hay ninguno en contra', () => {
    expect(ganoLaVotacion(1, 0)).toBe(true);
  });

  it('gana por uno solo: 3 a favor contra 2 en contra', () => {
    expect(ganoLaVotacion(3, 2)).toBe(true);
  });

  it('un empate NO aprueba: nadie ganó', () => {
    // Este es el caso que un ">=" silencioso aprobaría, y no debe.
    expect(ganoLaVotacion(1, 1)).toBe(false);
    expect(ganoLaVotacion(2, 2)).toBe(false);
    expect(ganoLaVotacion(0, 0)).toBe(false);
  });

  it('solo votos en contra NO aprueba: nadie avanza por hablar más fuerte', () => {
    expect(ganoLaVotacion(0, 1)).toBe(false);
    expect(ganoLaVotacion(0, 5)).toBe(false);
    expect(ganoLaVotacion(1, 4)).toBe(false);
  });

  it('la diferencia siempre manda, nunca la cantidad total', () => {
    // 4 contra 1 es "mucha gente", pero pierde. Si la regla fuera "más votos en
    // total", esta pieza aprobaría y nadie la miró.
    expect(ganoLaVotacion(1, 4)).toBe(false);
  });
});

/**
 * La salida de la votación se lee del motor, no de una constante escrita en la
 * API. Si mañana `voting` sale a otro estado, esto lo sigue sin editar nada.
 */
describe('a dónde lleva la votación', () => {
  it('la salida es un estado real del motor', () => {
    const salida = salidaDeLaVotacion();
    expect(salida).not.toBeNull();
    expect(STATUS_ORDER).toContain(salida!);
  });

  it('la salida NO es volver a revisión interna', () => {
    // Volver atrás también está en la tabla de `voting`, pero es el cierre
    // manual, no el premio por ganar. Confundirlas haría que ganar una votación
    // devolviera la idea a donde estaba.
    expect(salidaDeLaVotacion()).not.toBe('internal_review');
  });
});

/**
 * El voto se relee de la tabla, nunca de lo que el cliente dijo. Este test
 * fija esa regla con un conteo a mano, que es lo que hace la API: cuenta
 * filas, no confía en el número que le mandaron.
 */
describe('el conteo sale de las filas, no de lo que dice el votante', () => {
  type Fila = { decision: 'yes' | 'no' };

  const cuenta = (filas: Fila[]) => {
    const aFavor = filas.filter((f) => f.decision === 'yes').length;
    const enContra = filas.filter((f) => f.decision === 'no').length;
    return { gano: ganoLaVotacion(aFavor, enContra), aFavor, enContra };
  };

  it('cuenta bien una mezcla', () => {
    // 2 a favor y 2 en contra es EMPATE: con mayoría simple no sale. El conteo
    // está bien; lo que se comprueba aquí es que se cuente, no que gane.
    const empatada: Fila[] = [
      { decision: 'yes' }, { decision: 'no' }, { decision: 'yes' }, { decision: 'no' },
    ];
    expect(cuenta(empatada)).toEqual({ gano: false, aFavor: 2, enContra: 2 });

    const ganador: Fila[] = [
      { decision: 'yes' }, { decision: 'no' }, { decision: 'yes' },
    ];
    expect(cuenta(ganador)).toEqual({ gano: true, aFavor: 2, enContra: 1 });
  });

  it('cambiar el voto de contra a favor por la fila, no la suma', () => {
    // El servidor hace upsert sobre (idea_id, voter_token): la misma persona
    // cambiando de opinión deja UNA fila. Si se sumara, un voto contra seguido
    // de uno a favor parecían dos personas.
    const antes: Fila[] = [{ decision: 'no' }];
    const despues: Fila[] = [{ decision: 'yes' }];
    expect(cuenta(antes).gano).toBe(false);
    expect(cuenta(despues).gano).toBe(true);
    expect(despues).toHaveLength(1);
  });
});
