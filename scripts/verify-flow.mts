// Verificacion del motor de flujo: comprueba que cada estado es alcanzable,
// que ninguna transicion queda muerta y que los roles no se salen de su carril.
// Corre con:  node --experimental-strip-types scripts/verify-flow.mts
// La tabla de estados es la que verifica que ninguna transicion quede muerta.
// `STATUS_OWNERS` se importa del motor, no se re-declara aqui: duplicar las
// reglas en el test es exactamente como un test empieza a mentir.
import {
  STATUS_ORDER, PHASES, STATUS_OWNERS, TRANSITIONS_FOR_TEST,
  allowedTransitions, waitingOn, nextStatus, esEsperaDelCliente, esTerminal,
  ganoLaVotacion, perdioLaVotacion, VOTOS_NECESARIOS, votosParaDecidir,
  salidaDeLaVotacion, caidaDeLaVotacion,
} from '../src/lib/flow.ts';
import { QUEUES, BOARD_COLUMNS, inQueue } from '../src/lib/queues.ts';

let fails = 0;
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) fails += 1;
};

// 1. Todo estado declarado tiene owners (aunque sea lista vacia) y aparece en PHASES.
check('los 15 estados estan en STATUS_ORDER', STATUS_ORDER.length === 15, `${STATUS_ORDER.length}`);
const inPhases = new Set(PHASES.flatMap(p => p.statuses as readonly string[]));
const missingPhase = STATUS_ORDER.filter(s => !inPhases.has(s));
check('todo estado pertenece a una fase', missingPhase.length === 0, missingPhase.join(', ') || 'todas');
const missingOwners = STATUS_ORDER.filter(s => !(s in STATUS_OWNERS));
check('todo estado tiene entrada en STATUS_OWNERS', missingOwners.length === 0, missingOwners.join(', ') || 'todos');

// 2. Toda transicion apunta a un estado que existe.
const allTargets = [...Object.values(TRANSITIONS_FOR_TEST)].flat().map(t => t.to);
const badTargets = allTargets.filter(t => !STATUS_ORDER.includes(t));
check('toda transicion apunta a un estado valido', badTargets.length === 0, [...new Set(badTargets)].join(', ') || 'todas');

// 3. Todo estado salvo `closed` tiene al menos una salida.
const noSalida = STATUS_ORDER.filter(s => s !== 'closed' && !(TRANSITIONS_FOR_TEST[s]?.length));
check('todo estado no terminal tiene salida', noSalida.length === 0, noSalida.join(', ') || 'todos');

// 4. Regresion: `published -> closed` debe ser ejecutable por publisher.
//    Antes solo el owner podia cerrarla, porque el filtro miraba los owners
//    del estado de origen y `closed` no tiene ninguno.
const pubMoves = allowedTransitions('publisher', 'published').map(m => m.to);
check('publisher puede cerrar una pieza publicada', pubMoves.includes('closed'), pubMoves.join(',') || 'ninguna');
const buyerMoves = allowedTransitions('media_buyer', 'published').map(m => m.to);
check('media_buyer puede cerrar una pieza publicada', buyerMoves.includes('closed'), buyerMoves.join(',') || 'ninguna');
const editorCloses = allowedTransitions('editor', 'published').map(m => m.to);
check('el editor NO puede cerrar (solo owner/publisher/pauta)', !editorCloses.includes('closed'), editorCloses.join(',') || 'ninguna');

// 5. Regresion: pedir cambios de guion ya no vuelve a la fase IDEA.
const scriptMoves = allowedTransitions('client_approver', 'pending_script_review').map(m => m.to);
check('el cliente puede pedir cambios de guion', scriptMoves.includes('script_in_progress'), scriptMoves.join(','));
check('pedir cambios de guion NO vuelve a needs_changes', !scriptMoves.includes('needs_changes'));

// 6. Un visitante anonimo no puede hacer nada.
for (const role of ['client_viewer'] as const) {
  const puede = STATUS_ORDER.flatMap(s => allowedTransitions(role, s).map(m => `${s}->${m.to}`));
  check(`${role} no tiene ninguna transicion`, puede.length === 0, puede.join(', ') || 'ninguna');
}

// 7. Ningun rol puede saltarse el motor hacia un estado terminal desde el inicio.
//    Regresión del 2026-09-28: `draft` ya no salta al cliente, pasa por
//    `internal_review`. Lo que se sigue exigiendo es lo importante: nadie entra
//    al cliente sin pasar por la revisión interna.
const desdeDraft = (['creator', 'camera', 'editor', 'publisher', 'media_buyer'] as const)
  .flatMap(r => allowedTransitions(r, 'draft').map(m => `${r}: draft->${m.to}`));
check('desde draft se entra a revision interna, nunca al cliente',
  [...new Set(desdeDraft.map(s => s.split('->')[1]))].every(t => t === 'internal_review'),
  desdeDraft.join(', ') || 'ninguno');
const haciaCliente = (['creator', 'camera', 'editor', 'publisher', 'media_buyer'] as const)
  .flatMap(r => allowedTransitions(r, 'internal_review').map(m => `${r}: ->${m.to}`));
check('el cliente NO se puede saltar desde revision interna sin pasar por voting',
  haciaCliente.some(s => s.endsWith('->voting')), haciaCliente.join(', ') || 'ninguna');

// 8. Las colas cubren estados reales y no se solapan.
const queueStates = new Set(Object.values(QUEUES).flatMap(q => q.statuses));
const badQueue = [...queueStates].filter(s => !STATUS_ORDER.includes(s));
check('las colas solo usan estados validos', badQueue.length === 0, badQueue.join(', ') || 'todos');
// La invariante que faltaba: ningun estado se queda sin cola. Antes, `draft`,
// `approved` y `script_in_progress` no aparecian en ninguna — una pieza en
// elaboracion era invisible fuera del tablero.
const sinCola = STATUS_ORDER.filter(s => !queueStates.has(s));
check('TODO estado pertenece al menos a una cola', sinCola.length === 0, sinCola.join(', ') || 'todos');
// Y cada estado debe estar exactamente en una, salvo la frontera final.
const enDos = STATUS_ORDER.filter(s =>
  Object.values(QUEUES).filter(q => q.statuses.includes(s)).length > 1);
check('ningun estado esta en dos colas salvo la frontera', enDos.every(s => s === 'ready_to_publish'),
  enDos.join(', ') || 'solo la frontera');
check('inQueue reconoce un estado de su cola', inQueue('editing', 'produccion') && !inQueue('draft', 'produccion'));
// `aprobaciones` y `produccion` comparten ready_to_publish a proposito: es la
// ultima frontera, la ven cliente y produccion.
const solape = QUEUES.aprobaciones.statuses.filter(s => QUEUES.produccion.statuses.includes(s));
check('el solape entre colas es solo la frontera final',
  solape.every(s => s === 'ready_to_publish'), solape.join(', ') || 'sin solape');

// 8b. El tablero de 4 columnas y las colas no pueden desincronizarse. El
//     tablero tenia su propia lista escrita a mano, y por eso un estado nuevo
//     aparecia en un sitio y no en el otro.
const boardStates = BOARD_COLUMNS.flatMap(c => c.statuses as readonly string[]);
check('el tablero tiene 4 columnas', BOARD_COLUMNS.length === 4, `${BOARD_COLUMNS.length}`);
check('el tablero cubre los 15 estados sin repetir', new Set(boardStates).size === 15, `${new Set(boardStates).size} unicos`);
const boardMissing = STATUS_ORDER.filter(s => !boardStates.includes(s));
check('el tablero incluye todo estado del motor', boardMissing.length === 0, boardMissing.join(', ') || 'todos');
const queuesCovered = new Set(Object.values(QUEUES).flatMap(q => q.statuses));
check('cada estado del tablero aparece en alguna cola', boardStates.every(s => queuesCovered.has(s)),
  boardStates.filter(s => !queuesCovered.has(s)).join(', ') || 'todas');

// 9. waitingOn nunca devuelve una cadena vacia, y `closed` no espera a nadie.
const waits = STATUS_ORDER.map(s => waitingOn(s));
check('waitingOn responde siempre', waits.every(w => typeof w === 'string' && w.length > 0));
check('una pieza cerrada no espera a nadie', waitingOn('closed').includes('nadie'), waitingOn('closed'));
check('los estados que esperan al cliente lo dicen', waitingOn('pending_approval') === 'el cliente' && waitingOn('pending_script_review') === 'el cliente');

// 10. nextStatus devuelve el movimiento del equipo, no la primera fila. Antes
//     devolvia options[0].to, que para pending_approval era `approved`: la rama
//     mas optimista, que no predice nada.
check('nextStatus de draft es internal_review', nextStatus('draft') === 'internal_review', String(nextStatus('draft')));
check('nextStatus de closed es null (no hay salida)', nextStatus('closed') === null, String(nextStatus('closed')));
check('nextStatus nunca devuelve un estado que no existe',
  STATUS_ORDER.every(s => { const n = nextStatus(s); return n === null || STATUS_ORDER.includes(n); }));
check('nextStatus de un estado con salida nunca es null',
  STATUS_ORDER.filter(s => s !== 'closed').every(s => nextStatus(s) !== null));

// 11. La votación interna (2026-09-28). Estas reglas son la razón de existir de
//     `internal_review` y `voting`, así que se comprueban en el motor y no solo
//     en la UI: si alguien los cambia, el test avisa.
// `waitingOn` devuelve los ROLOS, no la etiqueta de `STATUS_META.who`: por eso
// el assertion mira que ningún rol sea de cliente y no que diga "EQUIPO".
check('internal_review NO espera al cliente', !esEsperaDelCliente('internal_review')
  && !STATUS_OWNERS.internal_review.some(r => r.startsWith('client')), waitingOn('internal_review'));
check('voting NO espera al cliente', !esEsperaDelCliente('voting'), waitingOn('voting'));
check('internal_review no es terminal', !esTerminal('internal_review'));
check('draft entra a revision interna y no al cliente',
  allowedTransitions('creator', 'draft').every(m => m.to === 'internal_review'),
  allowedTransitions('creator', 'draft').map(m => m.to).join(','));
check('un visitante no vota ni mueve la idea en revision interna',
  allowedTransitions('client_viewer', 'internal_review').length === 0
  && allowedTransitions('client_viewer', 'voting').length === 0);
check('el cliente no toca la revision interna: es interna',
  allowedTransitions('client_approver', 'internal_review').length === 0
  && allowedTransitions('client_approver', 'voting').length === 0);
check('pauta puede abrir la votacion (las ideas de pauta las vota quien las pauta)',
  allowedTransitions('media_buyer', 'internal_review').some(m => m.to === 'voting'));
check('la votacion cerrada se puede devolver a revision interna',
  allowedTransitions('owner', 'voting').some(m => m.to === 'internal_review'));

// 12. La regla de la votación: mayoría simple CON un mínimo de tres.
//
//     El mínimo no es un detalle, es lo que impide que la primera persona que
//     pulse mueva la pieza. Medido en producción el 2026-09-29: con "más sí que
//     no" a secas, 1-0 sacaba la idea al cliente. Santiago pidió tres en los dos
//     lados. Estos checks son el sitio donde la regla se lee sin abrir el código
//     de la acción, y el que fuerza a actualizarlos cuando cambie.
check('el minimo de la votacion son tres', VOTOS_NECESARIOS === 3);
check('mayoria simple con minimo: 1 a favor 0 en contra NO gana (el fallo medido)',
  !ganoLaVotacion(1, 0));
check('mayoria simple con minimo: 2 a favor 0 en contra TAMPOCO gana',
  !ganoLaVotacion(2, 0));
check('mayoria simple con minimo: 3 a favor 0 en contra gana', ganoLaVotacion(3, 0));
check('mayoria simple con minimo: 3 a favor 2 en contra gana', ganoLaVotacion(3, 2));
check('mayoria simple con minimo: 1 a favor 1 en contra es empate y NO gana',
  !ganoLaVotacion(1, 1));
check('mayoria simple con minimo: 0 y 0 no aprueba una idea sin votos',
  !ganoLaVotacion(0, 0));
check('el lado que pierde tambien necesita el minimo: 2 en contra no decae',
  !perdioLaVotacion(1, 2));
check('3 en contra si hacen caer la idea', perdioLaVotacion(0, 3));
check('ganar y perder nunca coinciden a la vez',
  [[3, 0], [4, 2], [2, 2], [0, 0]].every(([a, n]) => !(ganoLaVotacion(a, n) && perdioLaVotacion(a, n))));
check('los votos que faltan nunca son negativos',
  [votosParaDecidir(0, 0), votosParaDecidir(5, 0), votosParaDecidir(9, 9)].every((n) => n >= 0));
check('con 1 a favor faltan 2, con 2 a favor falta 1',
  votosParaDecidir(1, 0) === 2 && votosParaDecidir(2, 0) === 1);
check('mayoria simple: 3 a favor 2 en contra gana', ganoLaVotacion(3, 2));
// La salida de la votación tiene que ser un estado REAL, no un string inventado.
check('la votacion tiene salida y es un estado del motor',
  salidaDeLaVotacion() !== null && STATUS_ORDER.includes(salidaDeLaVotacion()!),
  String(salidaDeLaVotacion()));
check('la caida de la votacion vuelve a revision interna', caidaDeLaVotacion() === 'internal_review');
check('ganar y perder no llevan al mismo estado', caidaDeLaVotacion() !== salidaDeLaVotacion());
check('la salida de la votacion NO es volver a revision interna',
  salidaDeLaVotacion() !== 'internal_review', String(salidaDeLaVotacion()));

console.log(fails === 0 ? '\nTODO OK' : `\n${fails} FALLO(S)`);
process.exit(fails === 0 ? 0 : 1);
