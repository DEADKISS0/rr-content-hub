import { PHASES, STATUS_LABEL, type WorkflowStatus } from '@/lib/flow';

export function StatusBadge({ status }: { status: string }) {
  const label = STATUS_LABEL[status as WorkflowStatus] ?? status;
  const phase = PHASES.findIndex((item) => (item.statuses as readonly string[]).includes(status));
  return <span className={`status status-${status}`} data-phase={phase}>[{label}]</span>;
}
