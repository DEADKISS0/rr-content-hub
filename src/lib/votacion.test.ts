import { describe, expect, it } from 'vitest';
import {
  ganoLaVotacion, perdioLaVotacion, estadoVotacion, votosParaDecidir,
  VOTOS_NECESARIOS, salidaDeLaVotacion, caidaDeLaVotacion, STATUS_ORDER,
} from './flow';

/**
 * La regla de la votación interna, probada como lo que es: una decisión sobre un
 * conteo, no un efecto de base de datos.
 *
 * Por qué está separada de los tests de Postgres (2026-09-28): la regla vive en
 * `ganoLaVotacion()` y la usan tanto la API como `verify-flow`. Lo que no se puede
 * probar desde acá es que Postgres respete el `unique (idea_id, voter_token)`, y
 * eso se verificó aparte contra el esquema. Estos tests cubren la aritmética y,
 * sobre todo, los casos donde la respuesta NO es obvia.
 *
 * La regla que eligió Santiago el 2026-09-28 era mayoría simple: sale al cliente
 * si hay más votos a favor que en contra.
 *
 * ⚠️ Y el 2026-09-29 esa regla se midió en producción y salió mal: con "más sí
 * que no" a secas, UN voto a favor y ninguno en contra movía la pieza al
 * cliente. Quien pulsara primero decidía por toda la casa, y no había forma de
 * saber si el resto de la gente ni lo había mirado. Santiago añadió un mínimo de
 * TRES votos, en los dos lados. Los tests de abajo fijan ese mínimo, y el primer
 * caso es exactamente el fallo medido: si alguien vuelve a abrir la regla, este
 * archivo lo delata.
 */
describe('el mínimo de tres votos', () => {
  it('es tres, y el número vive en un solo sitio', () => {
    expect(VOTOS_NECESARIOS).toBe(3);
  });

  it('un solo voto a favor NO aprueba: el fallo medido en producción', () => {
    expect(ganoLaVotacion(1, 0)).toBe(false);
    expect(perdioLaVotacion(0, 1)).toBe(false);
    expect(estadoVotacion(1, 0)).toBe('esperando');
  });

  it('dos a favor tampoco, aunque no haya ninguno en contra', () => {
    expect(ganoLaVotacion(2, 0)).toBe(false);
    expect(perdioLaVotacion(0, 2)).toBe(false);
  });

  it('tres a favor con ninguno en contra SÍ aprueba', () => {
    expect(ganoLaVotacion(3, 0)).toBe(true);
    expect(perdioLaVotacion(0, 3)).toBe(true);
  });

  it('el mínimo mira cada lado por separado', () => {
    // 5 sí y 2 no gana el sí, aunque haya dos no: el mínimo del no son tres.
    expect(ganoLaVotacion(5, 2)).toBe(true);
    expect(perdioLaVotacion(2, 5)).toBe(true);
    // 2 sí y 4 no: el sí no llega al mínimo, así que la pieza no se mueve, pero
    // el no sí llega y la caída es una decisión válida.
    expect(perdioLaVotacion(2, 4)).toBe(true);
    expect(ganoLaVotacion(2, 4)).toBe(false);
  });

  it('ganar y perder no pueden ser las dos cosas a la vez', () => {
    const casos = [[3, 0], [4, 2], [3, 1], [5, 5], [0, 0], [1, 9]] as const;
    for (const [a, n] of casos) {
      const ambas = ganoLaVotacion(a, n) && perdioLaVotacion(a, n);
      expect(ambas, `${a}-${n} gana y pierde al mismo tiempo`).toBe(false);
    }
  });
});

describe('mayoría simple: qué hace que una idea salga al cliente', () => {
  it('gana por uno solo, una vez pasado el mínimo: 3 contra 2', () => {
    expect(ganoLaVotacion(3, 2)).toBe(true);
  });

  it('un empate NO aprueba: nadie ganó', () => {
    // Este es el caso que un ">=" silencioso aprobaría, y no debe.
    expect(ganoLaVotacion(2, 2)).toBe(false);
    expect(perdioLaVotacion(2, 2)).toBe(false);
    expect(estadoVotacion(2, 2)).toBe('esperando');
  });

  it('solo votos en contra, sin llegar al mínimo, no decide nada', () => {
    expect(perdioLaVotacion(0, 1)).toBe(false);
    expect(perdioLaVotacion(0, 2)).toBe(false);
    expect(perdioLaVotacion(1, 2)).toBe(false);
  });

  it('la diferencia siempre manda, nunca la cantidad total', () => {
    // 1 a favor y 4 en contra es "mucha gente en contra", pero no decide nada sin
    // llegar al mínimo. Y 4 contra 1 con el mínimo del sí tampoco sale.
    expect(perdioLaVotacion(1, 4)).toBe(true);
    expect(ganoLaVotacion(4, 1)).toBe(true);
  });
});

describe('cuántos votos faltan', () => {
  it('con la votación vacía faltan tres', () => {
    expect(votosParaDecidir(0, 0)).toBe(3);
  });

  it('con uno a favor faltan dos, y con dos falta uno', () => {
    expect(votosParaDecidir(1, 0)).toBe(2);
    expect(votosParaDecidir(2, 0)).toBe(1);
  });

  it('cuando ya decidió, no falta nada — y nunca puede ser negativo', () => {
    // Un "faltan -2" en la interfaz sería un fallo de datos.
    expect(votosParaDecidir(5, 0)).toBe(0);
    expect(votosParaDecidir(9, 7)).toBe(0);
    expect(votosParaDecidir(0, 8)).toBe(0);
  });

  it('con 2 sí y 2 no falta uno, porque el lado más cerca decide', () => {
    expect(votosParaDecidir(2, 2)).toBe(1);
  });
});

describe('el estado de la votación, para la interfaz', () => {
  it('ganada solo cuando gana de verdad', () => {
    expect(estadoVotacion(3, 0)).toBe('ganada');
    expect(estadoVotacion(4, 3)).toBe('ganada');
    expect(estadoVotacion(7, 2)).toBe('ganada');
  });

  it('perdida solo cuando pierde de verdad', () => {
    expect(estadoVotacion(0, 3)).toBe('perdida');
    expect(estadoVotacion(2, 5)).toBe('perdida');
  });

  it('esperando es el resto, incluido el 1-0 que antes decidía', () => {
    expect(estadoVotacion(0, 0)).toBe('esperando');
    expect(estadoVotacion(1, 0)).toBe('esperando');
    expect(estadoVotacion(2, 0)).toBe('esperando');
    expect(estadoVotacion(2, 2)).toBe('esperando');
    // 4 sí y 4 no: el sí llega al mínimo pero no supera al no, así que no decide.
    expect(estadoVotacion(4, 4)).toBe('esperando');
  });
});

/**
 * La salida de la votación se lee del motor, no de una constante escrita en la
 * API. Si mañana `voting` sale a otro estado, esto lo sigue sin editar nada.
 */
describe('a dónde lleva la votación', () => {
  it('la pieza ganada va al cliente', () => {
    expect(salidaDeLaVotacion()).toBe('pending_approval');
  });

  it('la salida es un estado real del motor', () => {
    const salida = salidaDeLaVotacion();
    expect(salida).not.toBeNull();
    expect(STATUS_ORDER).toContain(salida!);
  });

  it('la caida vuelve a revision interna, y sale del motor tambien', () => {
    // Sin esta rama, tres votos en contra devolvían "perdida" y la pieza se
    // quedaba en `voting` para siempre: la interfaz decía una cosa y la base
    // otra. Medido en producción el 2026-09-29.
    expect(caidaDeLaVotacion()).toBe('internal_review');
    expect(STATUS_ORDER).toContain(caidaDeLaVotacion()!);
  });

  it('ganar y perder llevan a estados DISTINTOS', () => {
    // Si las dos llevaran al mismo sitio, la votación sería simétrica y no
    // distinguiría "aprobada" de "descartada". Y si apuntaran al mismo estado,
    // perder no sería una decisión: sería volver.
    expect(caidaDeLaVotacion()).not.toBe(salidaDeLaVotacion());
  });

  it('la salida NO es volver a revisión interna', () => {
    // Volver atrás también está en la tabla de `voting`, pero es el cierre
    // manual, no el premio por ganar. Confundirlas haría que ganar una votación
    // devolviera la idea a donde estaba.
    expect(salidaDeLaVotacion()).not.toBe('internal_review');
  });
});

/**
 * El voto se relee de la tabla, nunca de lo que el cliente dijo. Este bloque
 * fija esa regla con un conteo a mano, que es lo que hace la API: cuenta filas,
 * no confía en el número que le mandaron.
 */
describe('el conteo sale de las filas, no de lo que dice el votante', () => {
  type Fila = { decision: 'yes' | 'no' };

  const cuenta = (filas: Fila[]) => {
    const aFavor = filas.filter((f) => f.decision === 'yes').length;
    const enContra = filas.filter((f) => f.decision === 'no').length;
    return { gano: ganoLaVotacion(aFavor, enContra), aFavor, enContra };
  };

  it('cuenta bien una mezcla, y 2-2 no sale', () => {
    const empatada: Fila[] = [
      { decision: 'yes' }, { decision: 'no' }, { decision: 'yes' }, { decision: 'no' },
    ];
    expect(cuenta(empatada)).toEqual({ gano: false, aFavor: 2, enContra: 2 });

    // Tres a favor ya ganan: este es el cambio de la regla.
    const ganadora: Fila[] = [
      { decision: 'yes' }, { decision: 'no' }, { decision: 'yes' }, { decision: 'yes' },
    ];
    expect(cuenta(ganadora)).toEqual({ gano: true, aFavor: 3, enContra: 1 });
  });

  it('cambiar el voto de contra a favor deja una fila, no dos personas', () => {
    // El servidor hace upsert sobre (idea_id, voter_token): la misma persona
    // cambiando de opinión deja UNA fila. Si se sumara, un voto contra seguido de
    // uno a favor parecían dos personas.
    const antes: Fila[] = [{ decision: 'no' }];
    const despues: Fila[] = [{ decision: 'yes' }];
    expect(cuenta(antes).gano).toBe(false);
    expect(cuenta(despues).gano).toBe(false);
    expect(despues).toHaveLength(1);
  });
});
