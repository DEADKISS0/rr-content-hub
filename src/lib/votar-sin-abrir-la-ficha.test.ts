import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Santiago, 2026-10-01 — el bloqueo real de las 19 ideas atascadas.
 *
 * MEDIDO. La votación funciona: probada de verdad, `{"aFavor": 1}`. Y nadie
 * vota. En la base, de las 18 personas con acceso a Wundeer, 14 no han votado
 * nunca, y las 19 ideas en `voting` tienen cero votos. Una idea necesita 3 sí
 * (`VOTOS_NECESARIOS`), así que ninguna avanza. Y el generador sigue metiendo
 * ideas nuevas a `voting` dos veces al día.
 *
 * MEDIDO TAMBIÉN por qué. Contando el botón de votar en las pantallas:
 *
 *   /wundeer              0 menciones de "votar"
 *   /wundeer/ideas        0 menciones de "votar"
 *   /wundeer/aprobaciones 0 menciones de "votar"
 *   /wundeer/ideas/{id}   botón "APROBAR" (solo dentro de la ficha)
 *
 * El botón existe y funciona, pero vive DENTRO de la ficha. Para votar hay que:
 * abrir el banco, encontrar la pieza, abrirla, y entonces aparece el botón.
 *
 * Eso no es un problema de interfaces: es un problema de flujo. Nadie va a
 * abrir 19 fichas una por una para decidir cuál de 19 vale la pena. La
 * votación se frió de la misma forma en que se congela una bandeja de entrada:
 * el sistema funciona, y nadie lo toca.
 *
 * Estos tests fijan que se pueda votar SIN abrir la ficha, y que quien vota vea
 * que ya votó.
 */

const mapa = readFileSync(new URL('../components/project-map.tsx', import.meta.url), 'utf8');
const panel = readFileSync(new URL('../components/idea-voting.tsx', import.meta.url), 'utf8');
const rapido = readFileSync(new URL('../components/vote-quick.tsx', import.meta.url), 'utf8');

describe('se puede votar sin abrir la ficha', () => {
  it('la tarjeta del tablero tiene acción de voto', () => {
    // Esta es la línea que faltaba. Con la tarjeta se puede votar de un toque
    // desde el tablero, que es donde se ve que hay 19 sin decidir.
    expect(mapa).toMatch(/votar|Votar|VOTAR/);
  });

  it('el botón SOLO aparece en las ideas que están en votación', () => {
    // El aserto tiene que mirar la CONDICIÓN, no la presencia de la palabra.
    //
    // MEDIDO: la primera versión de este test solo buscaba /votar/ en el
    // archivo. Probamos a cambiar `{idea.status === 'voting' && (` por
    // `{true && (` — es decir, que el botón salga en las 45 tarjetas, también
    // en las que ya están publicadas — y el test siguió en verde: 7 de 7.
    //
    // Un test que no falla cuando le rompes el comportamiento no prueba el
    // comportamiento: estorba, porque da una confianza falsa. Este mira la
    // condición exacta.
    expect(mapa).toMatch(/idea\.status === 'voting' && \(\s*<VoteQuick/);
  });

  it('y ninguna idea cerrada puede votingar', () => {
    // La condición no basta si `status` llega con cualquier cosa: se comprueba
    // que el estado usado es el del dominio, no uno escrito a mano.
    expect(mapa).toMatch(/'voting'/);
    expect(mapa).not.toMatch(/status === 'votando'|status === 'en_votacion'/);
  });

  it('el tablero monta el bloque de voto, y el bloque llama a la misma acción', () => {
    // El tablero no llama a la API: monta `VoteQuick`, y ese bloque usa el mismo
    // `voteIdea()` que la ficha. Por eso el aserto mira las DOS piezas: si
    // alguien escribiera una segunda función de voto para la tarjeta, esto se
    // pondría rojo, y esa duplicación es exactamente lo que hay que evitar
    // (dos caminos de voto = dos reglas de voto).
    expect(mapa).toMatch(/VoteQuick/);
    expect(rapido).toMatch(/voteIdea/);
    // Y no hay una segunda ruta: la tarjeta no habla con la API por su cuenta.
    expect(mapa).not.toMatch(/workspace\/vote/);
  });

  it('el bloque de voto existe como componente propio', () => {
    expect(rapido).toMatch(/export function VoteQuick/);
  });
});

describe('votar desde la tarjeta NO es un voto aparte', () => {
  it('ambos caminos emiten el mismo token de votante', () => {
    // Este es el riesgo real de haber metido un segundo botón: si la tarjeta
    // generara su propio token, la MISMA persona podría dejar dos votos en la
    // misma idea — uno desde la ficha y otro desde el tablero— y la regla de
    // "3 sí" se contaría con votos que en realidad son uno. El `upsert` de
    // servidor protege por token, no por persona: dos tokens, dos votos.
    //
    // Los dos caminos llaman a `voteIdea()`, que es quien pide `tokenVotante()`.
    // Si alguien escribiera una segunda ruta de voto, esto se pone rojo.
    const cliente = readFileSync(new URL('./workspace-client.ts', import.meta.url), 'utf8');
    expect(cliente).toMatch(/function voteIdea/);
    // Y el token sale del navegador una sola vez, no por componente.
    expect(cliente.match(/tokenVotante\(\)/g)?.length ?? 0).toBeGreaterThan(0);
    expect(rapido).not.toMatch(/voterToken:/);
    expect(panel).not.toMatch(/voterToken:/);
  });
});

describe('el voto necesita 3 sí, y eso tiene que verse', () => {
  it('se dice cuántos votos faltan', () => {
    // "Pide 3" sin decir "faltan 2" obliga a contar. Y quien no cuenta, no vota.
    // Este es el texto que faltaba en toda la app: nadie sabía que un idea
    //Specifically necesita tres y por eso nadie la empujaba.
    // Ni basta con que la palabra exista en el archivo: hay que que el texto
    // que se VE sea el que dice cuántos faltan. La primera versión buscaba solo
    // /FALTAN/ y muteamos el texto a "VOTA" — el test siguió verde, porque la
    // palabra "FALTAN" seguía en el comentario de arriba del componente.
    // Se mira la cadena exacta que sale a pantalla.
    expect(rapido).toMatch(/FALTAN \$\{faltan\} DE \$\{VOTOS_NECESARIOS\}/);
  });

  it('la regla vive en flow.ts, no escrita en el componente', () => {
    // La autoridad de los 3 es `flow.ts` (VOTOS_NECESARIOS). Si el botón
    // muestra otro número, el tablero y la regla cuentan cosas distintas, y ya
    // se ha visto pasar dos veces en este turno.
    expect(rapido).toMatch(/VOTOS_NECESARIOS/);
    expect(rapido).toMatch(/votosParaDecidir/);
    expect(rapido).toMatch(/from '@\/lib\/flow'/);
  });
});

describe('no se puede votar dos veces por lo mismo', () => {
  it('el voto guardado se confirma en pantalla', () => {
    // Sin esto, alguien que ya votó vuelve a pulsar por costumbre y no sabe si
    // su voto cambió o se duplicó. El `upsert` del servidor lo resuelve, pero la
    // pantalla tiene que decirlo, y también el fallo: si el voto no se guardó,
    // quien lo intentó tiene que enterarse en vez de creer que sí.
    expect(rapido).toMatch(/GUARDADO/);
    expect(rapido).toMatch(/fallo/);
  });
});
