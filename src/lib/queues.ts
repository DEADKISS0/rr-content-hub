/**
 * Queue definitions.
 *
 * Four pages used to redeclare their own list of statuses inline
 * (`aprobaciones`, `produccion`, `publicaciones`, `metricas`). That made the
 * workflow engine optional: a new state would show up in `flow.ts` and stay
 * invisible in every queue. Now the queues derive from the engine.
 */
import { PHASES, type WorkflowStatus } from '@/lib/flow';

export type QueueKey = 'ideacion' | 'aprobaciones' | 'produccion' | 'publicaciones';

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
  aprobaciones: {
    title: 'APROBACIONES',
    statuses: [
      'pending_approval', 'needs_changes',
      'pending_script_review', 'ready_to_publish',
    ],
    empty: 'No hay nada esperando una decisión.',
  },
  produccion: {
    title: 'PRODUCCIÓN',
    statuses: [
      ...byPhase('script').filter((s) => s === 'script_approved'),
      ...byPhase('shoot'),
      ...byPhase('edit'),
    ],
    empty: 'No hay piezas en producción.',
  },
  publicaciones: {
    title: 'PUBLICACIONES',
    statuses: byPhase('live'),
    empty: 'Todavía no hay piezas publicadas.',
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
 */
export const BOARD_COLUMNS = [
  { key: 'ideas', label: 'IDEAS', plain: 'Propuesta y decisión del cliente', statuses: byPhase('idea') },
  { key: 'scripts', label: 'GUIONES', plain: 'Escritura y aprobación', statuses: byPhase('script') },
  { key: 'production', label: 'PRODUCCIÓN', plain: 'Rodaje, edición y revisión final', statuses: [...byPhase('shoot'), ...byPhase('edit')] },
  { key: 'published', label: 'PUBLICADO', plain: 'Salida y cierre', statuses: byPhase('live') },
] as const;
