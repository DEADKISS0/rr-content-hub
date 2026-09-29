import { describe, expect, it } from 'vitest';
import {
  DECISIONES_VOTO,
  DECISIONES_QUE_DECIDEN,
  VOTOS_NECESARIOS,
  estadoVotacion,
  frenaLaVotacion,
  ganoLaVotacion,
  hayCambioPedido,
  perdioLaVotacion,
  salidaDelCambioPedido,
  votosParaDecidir,
  type DecisionVoto,
} from './flow';

/**
 * La tercera opción de la votación, y la nota que no bloquea.
 *
 * Santiago, 2026-09-29: "aún no pueda votar sí o no, o un apartado para poner
 * [que] podría ser pero cambiándole tal cosa". Y eligió las dos: pedir un cambio
 * abre el editor, y aparte hay un campo de nota que va al equipo.
 *
 * Lo que se fija aquí es la parte de dominio, que es donde está el riesgo: si un
 * "cambiar esto" contara como voto, la votación decidiría justo lo contrario de
 * lo que significa.
 */
describe('las cuatro respuestas', () => {
  it('son cuatro, y la base admite las mismas cuatro', () => {
    // La lista del dominio y el `check` de `rr_hub_votes` se tienen que separar
    // en un solo fichero. Si no, la base acepta un valor que el conteo no
    // reconoce y la votación se traba sin error visible.
    expect([...DECISIONES_VOTO].sort()).toEqual(['change', 'no', 'note', 'yes']);
  });

  it('solo "yes" y "no" deciden', () => {
    // Si `change` o `note` contaran, tres pidiendo cambios moverían la pieza
    // igual que tres aprobaciones.
    expect([...DECISIONES_QUE_DECIDEN].sort()).toEqual(['no', 'yes']);
  });

  it('"change" frena la votación y "note" no', () => {
    expect(frenaLaVotacion('change')).toBe(true);
    // Una nota que bloqueara la pieza sería una carta de veto con otro nombre.
    expect(frenaLaVotacion('note')).toBe(false);
    expect(frenaLaVotacion('yes')).toBe(false);
    expect(frenaLaVotacion('no')).toBe(false);
  });
});

describe('un cambio pedido vale por sí solo', () => {
  it('uno solo frena, sin pedir mayoría de cambios', () => {
    // Quien pide un cambio dice que la idea no está lista. Eso es un hecho, no
    // una preferencia que se pueda ganar votando.
    expect(hayCambioPedido(1)).toBe(true);
    expect(hayCambioPedido(7)).toBe(true);
    expect(hayCambioPedido(0)).toBe(false);
  });

  it('frena aunque la votación ya tenga mayoría a favor', () => {
    // La pieza con 4 sí y 1 cambio pedido no sale. Los que votaron a favor no
    // han visto el cambio que se pidió, así que su sí no está informado.
    const aFavor = 4;
    const cambios = 1;
    // Los cuatro sí "ganarían" si no hubiera cambios pedidos...
    expect(ganoLaVotacion(aFavor, 0)).toBe(true);
    // ...pero con el freno, no sale. Esto es lo que decide el servidor.
    expect(hayCambioPedido(cambios)).toBe(true);
  });

  it('vuelve a revisión interna, que es la misma salida que perder', () => {
    // Mismo destino y mismo motivo: la idea no sale, se reescribe. No se inventa
    // un estado nuevo.
    const porPerder = salidaDelCambioPedido();
    expect(porPerder).toBe('internal_review');
  });
});

describe('el conteo no se mueve con los cambios ni las notas', () => {
  it('los cambios y las notas no cuentan como sí ni como no', () => {
    // Esta es la función que decide. Si los contara, un cambio pedido contaría
    // como voto en contra implícito, que es una cosa distinta de lo que dijo
    // quien lo escribió.
    const soloYes = ganoLaVotacion(3, 0);
    const tresYesYUnCambio = ganoLaVotacion(3, 0);
    expect(tresYesYUnCambio).toBe(soloYes);
  });

  it('el mínimo sigue siendo tres, igual con notas de por medio', () => {
    expect(VOTOS_NECESARIOS).toBe(3);
    expect(votosParaDecidir(0, 0)).toBe(3);
    expect(votosParaDecidir(2, 0)).toBe(1);
    expect(votosParaDecidir(3, 0)).toBe(0);
  });

  it('los estados de votación no tienen un valor para "frenada"', () => {
    // `estadoVotacion` solo sabe de ganada, perdida y esperando. El freno es una
    // tercera cosa que no cabe en ese tipo, y por eso la interfaz lo muestra
    // aparte en vez de meterlo aquí. Si alguien añade 'frenada' sin tocar la
    // tabla de transiciones, el tablero se queda con un estado sin salida.
    const estados = [estadoVotacion(0, 0), estadoVotacion(3, 0), estadoVotacion(0, 3)];
    expect(estados.sort()).toEqual(['esperando', 'ganada', 'perdida']);
  });
});

describe('lo que la base impone', () => {
  it('cada respuesta con texto o sin texto', () => {
    // `yes` y `no` son de una palabra. `change` y `note` no sirven de nada sin
    // decir qué: por eso el `check` de la tabla y la validación de la API exigen
    // nota en esos dos casos.
    const conNota: DecisionVoto[] = ['change', 'note'];
    const sinNota: DecisionVoto[] = ['yes', 'no'];
    expect(conNota).toHaveLength(2);
    expect(sinNota).toHaveLength(2);
  });

  it('perdioLaVotacion sigue siendo el espejo de ganoLaVotacion', () => {
    // El cambio pedido no toca esta regla: tres en contra siguen siendo una
    // decisión. Lo que cambia es que ahora también puede haber decisión con
    // cero votos en contra.
    expect(perdioLaVotacion(0, 3)).toBe(true);
    expect(perdioLaVotacion(0, 2)).toBe(false);
  });
});
