'use client';

import Link from 'next/link';
import { BOARD_COLUMNS, statusMeta } from '@/lib/flow';
import { StatusBadge } from './status-badge';

type Idea = { id: string; code?: string; title: string; description?: string; status: string; category?: string };

/** The primary mental model: four columns, one card per piece, no hidden queue. */
export function FlowBoard({ ideas, projectSlug }: { ideas: Idea[]; projectSlug: string }) {
  return <section aria-labelledby="flow-board-title" className="mb-12">
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div><p className="eyebrow">[MAPA DE OPERACIÓN]</p><h2 id="flow-board-title" className="section-heading mt-2">TODO EL FLUJO, EN UNA VISTA.</h2></div>
      <p className="font-mono text-[10px] text-blanco-40">4 COLUMNAS · {ideas.length} PIEZAS</p>
    </div>
    <div className="flow-board grid gap-px border-2 border-blanco bg-blanco lg:grid-cols-4">
      {BOARD_COLUMNS.map((column, index) => {
        const items = ideas.filter((idea) => (column.statuses as readonly string[]).includes(idea.status));
        return <section key={column.key} className="min-h-[25rem] bg-negro p-4 sm:p-5">
          <header className="mb-5 border-b border-blanco-20 pb-4">
            <div className="flex items-start justify-between gap-3"><span className="font-mono text-[10px] text-mostaza">0{index + 1} / 04</span><span className="font-display text-4xl font-bold text-blanco">{items.length}</span></div>
            <h3 className="mt-2 font-display text-2xl font-bold text-blanco">{column.label}</h3>
            <p className="mt-2 text-xs leading-5 text-blanco-50">{column.plain}</p>
          </header>
          <div className="space-y-3">
            {items.map((idea) => { const meta = statusMeta(idea.status); return <Link key={idea.id} href={`/${projectSlug}/ideas/${idea.id}`} className="flow-card group block border border-blanco-20 bg-blanco-05 p-4 transition-all duration-200 hover:-translate-y-1 hover:border-fucsia hover:bg-fucsia/10">
              <div className="flex items-center justify-between gap-2"><span className="font-mono text-[10px] text-mostaza">{idea.code ?? 'IDEA'}</span><StatusBadge status={idea.status} /></div>
              <h4 className="mt-4 font-display text-lg font-bold leading-tight text-blanco group-hover:text-mostaza">{idea.title}</h4>
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-blanco-60">{meta.blurb}</p>
              <div className="mt-4 flex items-center justify-between border-t border-blanco-10 pt-3 font-mono text-[9px] text-blanco-40"><span>ACTÚA: {meta.who}</span><span className="text-fucsia">ABRIR →</span></div>
            </Link>; })}
            {!items.length && <p className="border border-dashed border-blanco-20 px-3 py-5 font-mono text-[10px] leading-5 text-blanco-40">Todavía no hay piezas aquí.</p>}
          </div>
        </section>;
      })}
    </div>
  </section>;
}
