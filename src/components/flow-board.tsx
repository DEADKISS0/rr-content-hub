'use client';

import Link from 'next/link';
import { statusMeta } from '@/lib/flow';
import { fechaEs, cuantoPara } from '@/lib/fecha-salida';
import { BOARD_COLUMNS } from '@/lib/queues';
import { StatusBadge } from './status-badge';

type Idea = {
  id: string;
  code?: string;
  title: string;
  description?: string;
  status: string;
  category?: string;
  /**
   * MEDIDO 2026-10-01: la fecha de salida llegaba al servidor y se perdía antes
   * de la tarjeta. Este tipo local no la declaraba, así que aunque `mapIdea` la
   * devolviera, aquí no había forma de leerla. Un tipo que no declara un campo
   * no es un tipo incompleto: es un campo que no existe para el compilador.
   */
  due_at?: string | null;
};

/** The primary mental model: four columns, one card per piece, no hidden queue. */
export function FlowBoard({ ideas, projectSlug }: { ideas: Idea[]; projectSlug: string }) {
  return <section aria-labelledby="flow-board-title" className="mb-12">
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div><p className="eyebrow">[MAPA DE OPERACIÓN]</p><h2 id="flow-board-title" className="section-heading mt-2">Todo el flujo, en una vista.</h2></div>
      <p className="font-mono text-[10px] text-blanco-40">4 COLUMNAS · {ideas.length} PIEZAS</p>
    </div>
    <div className="flow-board grid gap-px border border-blanco-20 bg-blanco-10 lg:grid-cols-4">
      {BOARD_COLUMNS.map((column, index) => {
        const items = ideas.filter((idea) => (column.statuses as readonly string[]).includes(idea.status));
        return <section key={column.key} className="min-h-[25rem] bg-negro p-4 sm:p-5">
          <header className="mb-5 border-b border-blanco-20 pb-4">
            <div className="flex items-start justify-between gap-3"><span className="font-mono text-[10px] text-blanco-50">0{index + 1} / 04</span><span className="font-display text-2xl font-bold text-blanco">{items.length}</span></div>
            <h3 className="mt-2 font-display text-2xl font-bold text-blanco">{column.label}</h3>
            <p className="mt-2 text-xs leading-5 text-blanco-50">{column.plain}</p>
          </header>
          <div className="space-y-3">
            {items.map((idea) => { const meta = statusMeta(idea.status);
              const fecha = fechaEs(idea.due_at);
              const faltan = cuantoPara(idea.due_at);
              const vencido = faltan?.vencido ?? false;
              return <Link key={idea.id} href={`/${projectSlug}/ideas/${idea.id}`} className="flow-card group block border border-blanco-20 bg-blanco-05 p-4 transition-colors duration-200 hover:border-blanco-40 hover:bg-blanco-10">
              <div className="flex items-center justify-between gap-2"><span className="font-mono text-[10px] text-blanco-50">{idea.code ?? 'IDEA'}</span><StatusBadge status={idea.status} /></div>
              <h4 className="mt-4 font-display text-lg font-bold leading-tight text-blanco group-hover:text-blanco-90">{idea.title}</h4>
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-blanco-60">{meta.blurb}</p>
              {/* MEDIDO 2026-10-01: la fecha de salida ya llegaba al tablero
                  (`getIdeas` la pide y `mapIdea` la copia) pero la tarjeta no la
                  pintaba. Se veía en la ficha y no en el tablero, que es donde se
                  mira "qué sale primero". */}
              {fecha && <p className="mt-2 font-mono text-[9px] text-blanco-40">
                SALIDA · <span className={vencido ? 'text-mostaza' : 'text-blanco-70'}>{fecha}</span>
                {faltan && <span> · {faltan.texto}</span>}
              </p>}
              <div className="mt-4 flex items-center justify-between border-t border-blanco-10 pt-3 font-mono text-[9px] text-blanco-40"><span>ACTÚA: {meta.who}</span><span className="text-blanco-60">ABRIR →</span></div>
            </Link>; })}
            {!items.length && <p className="border border-dashed border-blanco-20 px-3 py-5 font-mono text-[10px] leading-5 text-blanco-40">Todavía no hay piezas aquí.</p>}
          </div>
        </section>;
      })}
    </div>
  </section>;
}
