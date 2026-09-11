'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { StatusBadge } from './status-badge';
import { ProductionPipeline } from './production-pipeline';

/**
 * Queue view shared by every phase. Simplified for presenting ideas: the cards
 * are told with the same four signals (icon + color + text + responsible), and
 * production queues show the exact step. No role gating here.
 */
export function QueueSection({ title, eyebrow, description, guide, ideas, projectSlug, empty, showPipeline = false }: {
  title: string; eyebrow: string; description: string; owner: string; guide: string;
  ideas: any[]; projectSlug: string; empty: string; showPipeline?: boolean;
}) {
  const sorted = useMemo(() => [...ideas].sort((a, b) => (a.code ?? '').localeCompare(b.code ?? '', undefined, { numeric: true })), [ideas]);

  return <main className="min-h-screen bg-negro">
    <div className="mx-auto max-w-7xl px-5 py-10 md:px-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-6 border-b border-blanco-10 pb-8">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="display-title">{title}<br/><em>EN CONTROL.</em></h1>
          <p className="mt-5 max-w-xl text-sm leading-7 text-blanco-60">{description}</p>
        </div>
        <Link href={`/${projectSlug}/ideas`} className="btn-brutal">VER BANCO →</Link>
      </div>

      <section className="mb-8 border-2 border-mostaza bg-mostaza/5 p-5 anim-rise">
        <p className="mono-label text-mostaza">[QUÉ PASA AQUÍ]</p>
        <p className="mt-3 text-sm leading-6 text-blanco-60">{guide}</p>
      </section>

      <div className="mb-5 flex items-end justify-between border-b border-blanco-10 pb-3">
        <p className="eyebrow">[PIEZAS EN ESTA FASE]</p>
        <span className="font-mono text-[10px] text-blanco-40">{sorted.length} EN ESTA COLA</span>
      </div>

      {sorted.length ? <div className="stagger grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sorted.map((idea) => {
          const meta = idea.status;
          return <Link key={idea.id} href={`/${projectSlug}/ideas/${idea.id}`} className="brutal-panel group">
            <div className="mb-5 flex flex-wrap justify-between gap-3"><span className="mono-label text-mostaza">{idea.code ?? 'ITEM'} · {idea.category}</span><StatusBadge status={meta} showStep={showPipeline} /></div>
            <h2 className="font-display text-2xl font-bold text-blanco group-hover:text-fucsia">{idea.title}</h2>
            <p className="mt-3 line-clamp-3 text-sm leading-6 text-blanco-60">{idea.description}</p>
            {showPipeline && <div className="mt-5"><ProductionPipeline status={meta} compact /></div>}
            <div className="mt-6 flex items-center justify-between border-t border-blanco-10 pt-4 font-mono text-[10px] text-blanco-40">
              <span>RESPONSABLE: {idea.creator ?? 'RR ALIADOS'}</span>
              <span className="text-fucsia">ABRIR →</span>
            </div>
          </Link>;
        })}
      </div> : <section className="border-2 border-dashed border-blanco-20 px-6 py-16 text-center anim-pop">
        <p className="eyebrow">[COLA VACÍA]</p>
        <h2 className="mt-3 font-display text-3xl font-bold text-blanco">{empty}</h2>
        <div className="mt-6 flex flex-wrap justify-center gap-4">
          <Link href={`/${projectSlug}/ideas`} className="font-mono text-xs text-mostaza underline">IR AL BANCO DE IDEAS →</Link>
        </div>
      </section>}
    </div>
  </main>;
}
