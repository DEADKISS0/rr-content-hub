import { statusMeta, TONE_CLASS, PRODUCTION_STEPS, productionStep, statusShort, type WorkflowStatus } from '@/lib/flow';
import { Icon, type IconName } from './ui/icons';

/** De cada estado, su ícono propio. El emoji se fue: ahora es trazo de marca. */
export const STATUS_ICON: Record<WorkflowStatus, IconName> = {
  draft: 'pen', pending_approval: 'clock', needs_changes: 'alert', approved: 'check',
  script_in_progress: 'file', pending_script_review: 'eye', script_approved: 'flag',
  in_production: 'camera', raw_uploaded: 'upload', editing: 'scissors',
  ready_to_publish: 'target', published: 'publish', closed: 'check',
};

/**
 * Pastilla de estado: ícono + tono + etiqueta legible. Nunca depende solo del
 * color, y en versión compacta dice el estado en una palabra para las
 * tarjetas densas del tablero.
 */
export function StatusBadge({ status, showStep = false, animate = false, compact = false }: { status: string; showStep?: boolean; animate?: boolean; compact?: boolean }) {
  const meta = statusMeta(status);
  const tone = TONE_CLASS[meta.tone];
  const step = productionStep(status as WorkflowStatus);
  const icon = STATUS_ICON[status as WorkflowStatus] ?? 'flag';
  return (
    <span title={`${meta.label} — ${meta.blurb}`} className={`inline-flex items-center gap-2 whitespace-nowrap border ${tone.border} ${tone.bg} ${compact ? 'px-2 py-1' : 'px-3 py-1.5'} font-mono text-[10px] tracking-wide ${tone.text} ${animate ? 'anim-pop' : ''}`}>
      <Icon name={icon} size={compact ? 11 : 13} />
      <span className="font-bold uppercase">{compact ? statusShort(status) : meta.label}</span>
      {showStep && step >= 0 && <span className="text-blanco-40">· {step + 1}/{PRODUCTION_STEPS.length}</span>}
    </span>
  );
}

/** Punto + etiqueta, para filas apretadas. */
export function StatusDot({ status }: { status: string }) {
  const meta = statusMeta(status);
  const tone = TONE_CLASS[meta.tone];
  return <span className="inline-flex items-center gap-2 font-mono text-[10px] text-blanco-60">
    <span className={`h-2 w-2 ${tone.dot}`} aria-hidden />
    {meta.label}
  </span>;
}
