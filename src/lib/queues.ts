/**
 * Queue definitions.
 *
 * Four pages used to redeclare their own list of statuses inline
 * (`aprobaciones`, `produccion`, `publicaciones`, `metricas`). That made the
 * workflow engine optional: a new state would show up in `flow.ts` and stay
 * invisible in every queue. Now the queues derive from the engine.
 */
import { PHASES, type WorkflowStatus } from '@/lib/flow';

/**
 * `descartadas` es nueva (Santiago, 2026-09-30). Antes `closed` estaba dentro de
 * `publicaciones` porque `live` agrupaba `published` y `closed` juntos, y una idea
 * que se descartó a propósito aparecia en la cola de PUBLICACIONES. Lo que salió
 * y lo que se tiró son dos hechos distintos y necesitan dos sitios.
 */
export type QueueKey = 'ideacion' | 'aprobaciones' | 'produccion' | 'publicaciones' | 'descartadas';

type QueueDef = { title: string; statuses: readonly WorkflowStatus[]; empty: string };

const byPhase = (key: string): readonly WorkflowStatus[] =>
  (PHASES.find((p) => p.key === key)?.statuses ?? []) as readonly WorkflowStatus[];

export const QUEUES: Record<QueueKey, QueueDef> = {
  // `draft`, `approved` and `script_in_progress` belonged to no queue at all:
  // a piece being written was invisible outside the board. The bank's home is
  // /ideas, so that is the queue — the definition lives here so the invariant
  // "every state has a home" is checkable.
  ideacion: {
    title: 'IDEA',
    statuses: [
      ...byPhase('idea').filter((s) => s !== 'pending_approval' && s !== 'needs_changes'),
      ...byPhase('script').filter((s) => s !== 'pending_script_review' && s !== 'script_approved'),
    ],
    empty: 'No hay piezas en el banco.',
  },
  // Every state that waits on a decision rather than on production work.
  // `ready_to_publish` NO va aquí: el cliente no decide la revisión final, la
  // decide el publisher. Vive solo en `publicaciones` (decisión D3 de la
  // auditoría del 2026-09-26: un estado, una sola cola).
  aprobaciones: {
    title: 'APROBACIONES',
    statuses: [
      'pending_approval', 'needs_changes',
      'pending_script_review',
    ],
    empty: 'No hay nada esperando una decisión.',
  },
  produccion: {
    title: 'PRODUCCIÓN',
    statuses: [
      ...byPhase('script').filter((s) => s === 'script_approved'),
      ...byPhase('shoot'),
      ...byPhase('edit').filter((s) => s !== 'ready_to_publish'),
    ],
    empty: 'No hay piezas en producción.',
  },
  publicaciones: {
    title: 'PUBLICACIONES',
    statuses: ['ready_to_publish', ...byPhase('live')],
    empty: 'Todavía no hay piezas publicadas.',
  },
  // Lo que NO va a salir. Se conserva con todo su historial —no se borra— pero
  // fuera de la cola de lo publicado, para no volver a mirarla creyendo que se
  // publicó.
  descartadas: {
    title: 'DESCARTADAS',
    statuses: [...byPhase('closed')],
    empty: 'No se ha descartado nada.',
  },
};

/** Narrowing helper so queue pages stop casting every idea to `any`. */
export function inQueue(status: string, queue: QueueKey): boolean {
  return (QUEUES[queue].statuses as readonly string[]).includes(status);
}

/**
 * The two states that hand a piece over to the shooting team. Derived from the
 * production queue so a change there cannot leave this tile behind.
 */
export const READY_FOR_SHOOTING: readonly WorkflowStatus[] = QUEUES.produccion.statuses
  .filter((s) => s === 'script_approved' || s === 'approved');

/**
 * The four-column board. It reads from the same queues, so a state added to the
 * engine shows up here automatically — this used to be a second, hand-kept
 * list that silently drifted from the queues the pages actually used.
 *
 * LA CUARTA COLUMNA TENIA UN BUG QUE SE VEIA EN CADA CARRGA (Santiago,
 * 2026-09-30: "bloqueamos una idea que no nos gustó y meterse bloqueado se fue a
 * otra categoría que se llama publicado"). Decía PUBLICADO y sus estados venían
 * de `byPhase('live')`, que incluía `closed`. O sea: una idea DESCARTADA
 * aparecía en la columna de lo publicado. Al revés, y sin que nada fallara.
 *
 * Ahora hay dos columnas y cada una dice lo que es: lo que salió, y lo que se
 * descartó. Se cuentan por separado, que es lo que hace falta para no volver a
 * mirar una idea archivada creyendo que se publicó.
 */
export const BOARD_COLUMNS = [
  { key: 'ideas', label: 'IDEAS', plain: 'Propuesta y decisión del cliente', statuses: byPhase('idea') },
  { key: 'scripts', label: 'GUIONES', plain: 'Escritura y aprobación', statuses: byPhase('script') },
  { key: 'production', label: 'PRODUCCIÓN', plain: 'Rodaje, edición y revisión final', statuses: [...byPhase('shoot'), ...byPhase('edit')] },
  { key: 'published', label: 'PUBLICADO', plain: 'Ya salió a la cuenta', statuses: byPhase('live') },
  { key: 'closed', label: 'DESCARTADAS', plain: 'No salió y no va a salir', statuses: byPhase('closed') },
] as const;
