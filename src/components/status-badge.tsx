import { statusMeta, TONE_CLASS, PRODUCTION_STEPS, productionStep, type WorkflowStatus } from '@/lib/flow';

/**
 * Rich status pill: icon + tone color + readable label. Never relies on color
 * alone, so the state reads the same for everyone. When the piece is in the
 * production leg, it also shows which of the four steps it sits on.
 */
export function StatusBadge({ status, showStep = false, animate = false }: { status: string; showStep?: boolean; animate?: boolean }) {
  const meta = statusMeta(status);
  const tone = TONE_CLASS[meta.tone];
  const step = productionStep(status as WorkflowStatus);
  return <span className={`inline-flex items-center gap-2 border ${tone.border} ${tone.bg} px-3 py-1.5 font-mono text-[10px] tracking-wide ${tone.text} ${animate ? 'anim-pop' : ''}`}>
    <span aria-hidden>{meta.icon}</span>
    <span className="font-bold">{meta.label}</span>
    {showStep && step >= 0 && <span className="text-blanco-40">· {step + 1}/{PRODUCTION_STEPS.length}</span>}
  </span>;
}

/** Compact dot + label, for dense rows. */
export function StatusDot({ status }: { status: string }) {
  const meta = statusMeta(status);
  const tone = TONE_CLASS[meta.tone];
  return <span className="inline-flex items-center gap-2 font-mono text-[10px] text-blanco-60">
    <span className={`h-2 w-2 ${tone.dot}`} aria-hidden />
    {meta.label}
  </span>;
}
