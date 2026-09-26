// Verificacion del motor de flujo: comprueba que cada estado es alcanzable,
// que ninguna transicion queda muerta y que los roles no se salen de su carril.
// Corre con:  node --experimental-strip-types scripts/verify-flow.mts
// La tabla de estados es la que verifica que ninguna transicion quede muerta.
// `STATUS_OWNERS` se importa del motor, no se re-declara aqui: duplicar las
// reglas en el test es exactamente como un test empieza a mentir.
import {
  STATUS_ORDER, PHASES, STATUS_OWNERS, TRANSITIONS_FOR_TEST,
  allowedTransitions, waitingOn,
} from '../src/lib/flow.ts';
import { QUEUES, BOARD_COLUMNS, inQueue } from '../src/lib/queues.ts';

let fails = 0;
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) fails += 1;
};

// 1. Todo estado declarado tiene owners (aunque sea lista vacia) y aparece en PHASES.
check('los 13 estados estan en STATUS_ORDER', STATUS_ORDER.length === 13, `${STATUS_ORDER.length}`);
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
const saltos = (['creator', 'camera', 'editor', 'publisher'] as const)
  .flatMap(r => allowedTransitions(r, 'draft').map(m => `${r}: draft->${m.to}`));
check('desde draft solo se va a pending_approval', saltos.every(s => s.endsWith('->pending_approval')), saltos.join(', ') || 'ninguno');

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
check('el tablero cubre los 13 estados sin repetir', new Set(boardStates).size === 13, `${new Set(boardStates).size} unicos`);
const boardMissing = STATUS_ORDER.filter(s => !boardStates.includes(s));
check('el tablero incluye todo estado del motor', boardMissing.length === 0, boardMissing.join(', ') || 'todos');
const queuesCovered = new Set(Object.values(QUEUES).flatMap(q => q.statuses));
check('cada estado del tablero aparece en alguna cola', boardStates.every(s => queuesCovered.has(s)),
  boardStates.filter(s => !queuesCovered.has(s)).join(', ') || 'todas');

// 9. waitingOn nunca devuelve una cadena vacia.
const waits = STATUS_ORDER.map(s => waitingOn(s));
check('waitingOn responde siempre', waits.every(w => typeof w === 'string' && w.length > 0));

console.log(fails === 0 ? '\nTODO OK' : `\n${fails} FALLO(S)`);
process.exit(fails === 0 ? 0 : 1);
