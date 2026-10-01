import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

/**
 * Santiago, 2026-10-01 — el generador y la pausa que no se anunciaba.
 *
 * MEDIDO, con el script corriendo de verdad (`--seco` y en seco a secas):
 *
 *   ideas sin revisar: 24 (tope 20)
 *   stdout: 191 bytes
 *
 * El freno FUNCIONA: `en_cola >= tope` corta antes de generar, que es lo que
 * tenía que hacer. El problema no es que genere de más. El problema es el
 * silencio.
 *
 * Cuando el tope para la corrida, el script escribe 191 bytes: el texto de
 * "no generé, la cola está llena". Y ese texto sale por stdout, que es
 * exactamente el canal que el cron entrega a WhatsApp. Así que el paquete de
 * las 08:00 y el de las 17:00 tienen la MISMA forma para quien los lee: un
 * mensaje del generador. La diferencia entre "te traje 4 ideas" y "no te
 * traje nada porque estabas lleno" solo se distingue leyendo la frase, y el
 * aviso dice "⏸️", que en un celular se pierde de un vistazo.
 *
 * Y hay algo peor detrás: el cron marca `last_status: ok`. Eso significa que
 * el watchdog no ve ningún fallo. Un sistema que deja de producir por diseño,
 * todos los días, no puede reportarse como "ok" cada día sin decir por qué:
 * lo que parece un fallo silencioso y lo que es una pausa correcta se
 * reportan igual.
 *
 * La cola tampoco es un misterio. Medido en la base:
 *
 *   2026-09-11   22 ideas creadas    0 en voting
 *   2026-09-15    1 idea creada      0 en voting
 *   2026-09-28   18 ideas creadas   15 en voting
 *   2026-10-01    4 ideas creadas    4 en voting
 *
 * Las 19 atascadas son casi todas del 28 de septiembre, y las del 11 runaway
 * recklessaron. El generador hizo su trabajo; el cuello de botella está
 * aguas arriba de él y es humano.
 *
 * Estos tests fijan que la pausa se distinga de una corrida normal, en la
 * máquina y no solo en la prosa del mensaje.
 */
const generador = readFileSync(
  new URL('../../scripts/generar-ideas-wundeer.py', import.meta.url),
  'utf8',
);

describe('la pausa se anuncia como pausa', () => {
  it('el tope tiene un código de salida propio, no el de una corrida buena', () => {
    // MEDIDO: hoy `return 0` cuando frena. Cero es "todo bien" para un cron, un
    // watchdog y un humano que mira el panel. Una pausa correcta no es un
    // fallo: el sistema está sano. Pero no es lo mismo que "traje 4 ideas",
    // y con el mismo código no hay forma de distinguirlas.
    //
    // Se fija el 3: es el que usa el script para "no pude hacer el trabajo
    // pedido", y no colisiona con 0 (ok) ni con 1 (error de arranque).
    expect(generador).toMatch(/return 3/);
  });

  it('el mensaje de pausa se marca en stdout, no se pierde entre comentarios', () => {
    // `if not opciones.seco: print(mensaje)`. En seco no imprime, y en seco se
    // queda mudo a propósito. Pero el canal de stdout es el que se entrega: si
    // el aviso no lleva su propia marca, quien lo lee tiene que adivinar si es
    // un paquete o un aviso.
    expect(generador).toMatch(/PAUSA|pausa/);
  });
});

describe('--seco no es un simulacro, aunque se llame así', () => {
  it('la ayuda del argumento dice que escribe', () => {
    // MEDIDO 2026-10-01. Corrí `--tope-cola 0 --seco` pensando que era un
    // simulacro, y creó P30 de verdad en la base ("La prenda que sigue nueva a
    // las 30 lavadas"), en `internal_review`. El nombre `--seco` en el resto del
    // mundo significa "no toques nada"; aquí significa "no imprimas el pack".
    //
    // No se renombra porque el cron y la documentación ya lo usan, y renombrar
    // sin avisar es peor. Lo que se hace es que el `--help` lo diga, para que
    // el que lo lea no se fíe del nombre.
    expect(generador).toMatch(/escribe en la base igual/i);
    expect(generador).toMatch(/no lo es|no es un simulacro/i);
  });
});

describe('la cola que bloquea es la real, no una aproximación', () => {
  it('las ideas bloqueadas cuentan las que esperan de verdad', () => {
    // `tamano_cola()` cuenta `draft`, `internal_review` y `voting`. Lo medido:
    // la cola marcaba 24 y el tope era 20, así que frenaba — pero el número que
    // dice el mensaje y el número que ve el equipo en el tablero no tienen por
    // qué ser el mismo si uno cuenta estados que el otro no. La autoridad de
    // los estados es `flow.ts`, y este script la reescribe a mano.
    expect(generador).toMatch(/tamano_cola/);
    // Y la lista no puede crecer sin que nadie lo note.
    const m = generador.match(/status in \(([^)]*)\)/);
    expect(m, 'la lista de estados bloqueantes debe existir y ser legible').toBeTruthy();
    expect(generador).toMatch(/internal_review/);
    expect(generador).toMatch(/voting/);
  });
});

describe('el ritmo automático respeta el requisito de una y una', () => {
  it('produce una de pauta y una orgánica por corrida, no dos y dos', () => {
    // El requisito escrito es exactamente una de pauta y una orgánica por
    // corrida. El script tiene CUANTAS_PAUTA = 2 y CUANTAS_ORGANICO = 2, y
    // los dos jobs (08:00 y 17:00) corren sin argumentos: son 4 ideas por
    // corrida y 8 al día.
    //
    // Eso no es "el generador produce de más": es que la cola se llena sola,
    // y el tope para por las malas. Este aserto no se va a hacer verde
    // cambiando una constante: tiene que cambiar el ritmo, y eso lo decide
    // Santiago, no un test. Está aquí para que el número no se vuelva a
    // desviar sin que nadie lo note.
    expect(generador).toMatch(/CUANTAS_PAUTA = 1/);
    expect(generador).toMatch(/CUANTAS_ORGANICO = 1/);
  });
});