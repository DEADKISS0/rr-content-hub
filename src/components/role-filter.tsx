'use client';

import { actGroup, type ActGroup } from '@/lib/flow';

export type ActOption = { key: ActGroup; label: string; count: number };

/**
 * "Who has to act now" filter. Each chip shows its own count so a stuck queue
 * is visible without opening anything.
 */
export function RoleFilter({ options, value, onChange, total }: { options: ActOption[]; value: ActGroup | 'all'; onChange: (value: ActGroup | 'all') => void; total: number }) {
  return <div className="mb-6 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Filtrar por quién actúa">
    <button role="tab" aria-selected={value === 'all'} onClick={() => onChange('all')} className={`whitespace-nowrap border-2 px-4 py-2 font-mono text-[10px] tracking-wide transition-colors ${value === 'all' ? 'border-blanco bg-blanco text-negro' : 'border-blanco-20 text-blanco-60 hover:border-mostaza'}`}>
      TODAS <span className="ml-1 opacity-70">{total}</span>
    </button>
    {options.map((option) => <button key={option.key} role="tab" aria-selected={value === option.key} onClick={() => onChange(option.key)} className={`whitespace-nowrap border-2 px-4 py-2 font-mono text-[10px] tracking-wide transition-colors ${value === option.key ? 'border-mostaza bg-mostaza text-negro' : option.count > 0 ? 'border-mostaza text-mostaza hover:bg-mostaza/10' : 'border-blanco-20 text-blanco-40 hover:border-blanco-40'}`}>
      {option.label} <span className="ml-1 opacity-80">{option.count}</span>
    </button>)}
  </div>;
}

/** Counts ideas per act group so callers can build the chips in one pass. */
export function countsByGroup(ideas: { status: string }[]): Record<ActGroup, number> {
  const out: Record<ActGroup, number> = { cliente: 0, camara: 0, editor: 0, publisher: 0, equipo: 0 };
  for (const idea of ideas) out[actGroup(idea.status as any)] += 1;
  return out;
}
