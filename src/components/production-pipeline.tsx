import { PRODUCTION_STEPS } from '@/lib/flow';

/**
 * The four steps of the production leg, side by side. The current step lights
 * up in fucsia; the rest stay muted. Reads left-to-right as GRABACIÓN → LISTO.
 */
export function ProductionPipeline({ status, compact = false }: { status: string; compact?: boolean }) {
  const active = PRODUCTION_STEPS.findIndex((step) => (step.statuses as readonly string[]).includes(status));
  return <ol className={`grid gap-px border-2 bg-blanco-10 ${active >= 0 ? 'border-fucsia' : 'border-blanco-20'} ${compact ? 'grid-cols-4' : 'grid-cols-2 md:grid-cols-4'}`}>
    {PRODUCTION_STEPS.map((step, index) => {
      const isActive = index === active;
      const isDone = active >= 0 && index < active;
      return <li key={step.key} className={`p-3 ${isActive ? 'bg-fucsia/20' : isDone ? 'bg-blanco-05' : 'bg-negro'}`}>
        <div className="flex items-center justify-between">
          <span className={`font-mono text-[10px] font-bold ${isActive ? 'text-fucsia' : isDone ? 'text-mostaza' : 'text-blanco-40'}`}>{String(index + 1).padStart(2, '0')}</span>
          {isDone && <span className="text-mostaza" aria-hidden>✓</span>}
          {isActive && <span className="h-2 w-2 animate-pulse bg-fucsia" aria-hidden />}
        </div>
        <p className={`mt-2 font-display text-sm font-bold ${isActive ? 'text-blanco' : 'text-blanco-60'}`}>{step.label}</p>
        {!compact && <p className="mt-1 text-[10px] leading-4 text-blanco-40">{step.detail}</p>}
      </li>;
    })}
  </ol>;
}
