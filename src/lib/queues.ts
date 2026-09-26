/**
 * Queue definitions.
 *
 * Four pages used to redeclare their own list of statuses inline
 * (`aprobaciones`, `produccion`, `publicaciones`, `metricas`). That made the
 * workflow engine optional: a new state would show up in `flow.ts` and stay
 * invisible in every queue. Now the queues derive from the engine.
 */
import { PHASES, type WorkflowStatus } from '@/lib/flow';

export type QueueKey = 'aprobaciones' | 'produccion' | 'publicaciones';

type QueueDef = { title: string; statuses: readonly WorkflowStatus[]; empty: string };

const byPhase = (key: string): readonly WorkflowStatus[] =>
  (PHASES.find((p) => p.key === key)?.statuses ?? []) as readonly WorkflowStatus[];

export const QUEUES: Record<QueueKey, QueueDef> = {
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
