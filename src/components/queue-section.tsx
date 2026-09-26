'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { StatusBadge } from './status-badge';
import { ProductionPipeline } from './production-pipeline';
import { ActorChip, Chip } from './ui/chips';
import { EmptyState } from './ui/empty-state';
import { Icon } from './ui/icons';
import { BriefRail, briefState } from './ui/meter';
import { formatOf } from './ui/cover';
import { PublicationPreview } from './ui/preview';
import { statusMeta, daysSince } from '@/lib/flow';

/** Días desde el último movimiento real de la pieza. */
function ageOf(idea: any): number | null {
  return daysSince(idea.updated_at ?? idea.created_at);
}

/**
 * Cola compartida por las cuatro fases.
 *
 * Misma gramática que el mapa: portada, estado con ícono, formato, antigüedad,
 * completitud de la información y responsable. Así una pieza se reconoce igual
 * en el tablero, en la lista y en su cola — sin reaprender nada por pantalla.
 */
export function QueueSection({ title, eyebrow, description, guide, ideas, projectSlug, empty, showPipeline = false, notice }: {
  title: string; eyebrow: string; description: string; owner: string; guide: string;
  ideas: any[]; projectSlug: string; empty: string; showPipeline?: boolean;
  /** Aviso honesto cuando esta pantalla depende de algo que todavía no existe. */
  notice?: { title: string; body: string };
}) {
  /**
   * Orden por urgencia, no por código: lo que más lleva parado va arriba.
   * Medido en /aprobaciones: ordenada por código, la pieza de 15 días quedaba
   * enterrada entre las de ayer (O1, O4, O9, O11, P1, P2, P7). Una cola de
   * decisiones tiene que abrir con lo que hay que atender, no con la A.
   */
  const sorted = useMemo(
    () => [...ideas].sort((a, b) => {
      const diasA = ageOf(a) ?? -1;
      const diasB = ageOf(b) ?? -1;
      if (diasA !== diasB) return diasB - diasA;
      return (a.code ?? '').localeCompare(b.code ?? '', undefined, { numeric: true });
    }),
    [ideas],
  );
  const incomplete = sorted.filter((idea) => briefState(idea).some((state) => !state.done)).length;
  const oldest = sorted.reduce((max, idea) => Math.max(max, ageOf(idea) ?? 0), 0);

  return <main className="min-h-screen bg-negro">
    <div className="mx-auto max-w-7xl px-5 py-10 md:px-10">
      <div className="anim-rise mb-8 flex flex-wrap items-end justify-between gap-6 border-b border-blanco-10 pb-8">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="display-title">{title}<br /><em>EN CONTROL.</em></h1>
          <p className="mt-5 max-w-xl text-sm leading-7 text-blanco-70">{description}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Chip icon="pieces" tone="blanco"><b className="anim-count">{sorted.length}</b>&nbsp;EN ESTA COLA</Chip>
            {oldest > 0 && <Chip icon="clock" tone={oldest > 14 ? 'fucsia' : 'mostaza'} className={oldest > 14 ? 'anim-pulse' : ''}><b className="anim-count">{oldest}</b>&nbsp;DÍAS LA MÁS VIEJA</Chip>}
            <Chip icon="alert" tone={incomplete ? 'mostaza' : 'neutro'}><b className="anim-count">{incomplete}</b>&nbsp;CON INFO FALTANTE</Chip>
          </div>
        </div>
        <Link href={`/${projectSlug}/ideas`} className="btn-brutal inline-flex items-center gap-2">VER BANCO <Icon name="arrow" size={14} /></Link>
      </div>

      <section className="anim-rise mb-8 flex items-start gap-3 border-2 border-mostaza bg-mostaza/5 p-5">
        <span className="mt-[2px] text-mostaza"><Icon name="eye" size={16} /></span>
        <div>
          <p className="mono-label text-mostaza">[QUÉ PASA AQUÍ]</p>
          <p className="mt-2 text-sm leading-6 text-blanco-70">{guide}</p>
        </div>
      </section>

      {notice && <section className="anim-rise mb-8 flex items-start gap-3 border-2 border-orquidea bg-orquidea/10 p-5">
        <span className="mt-[2px] text-orquidea"><Icon name="alert" size={16} /></span>
        <div>
          <p className="mono-label text-orquidea">{notice.title}</p>
          <p className="mt-2 text-sm leading-6 text-blanco-70">{notice.body}</p>
        </div>
      </section>}

      <div className="mb-5 flex items-end justify-between border-b border-blanco-10 pb-3">
        <p className="eyebrow">[PIEZAS EN ESTA FASE]</p>
        <span className="font-mono text-[10px] text-blanco-50">PRIMERO LO QUE MÁS LLEVA PARADO</span>
      </div>

      {sorted.length ? <div className="stagger grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sorted.map((idea) => {
          const format = formatOf(idea.category, idea.content_type);
          const meta = statusMeta(idea.status);
          const age = ageOf(idea);
          return <Link key={idea.id} href={`/${projectSlug}/ideas/${idea.id}`} className="idea-card cascade sheen group block border-2 border-blanco-20 bg-negro transition-all duration-200 hover:-translate-y-1 hover:border-fucsia">
            <PublicationPreview url={idea.reference_url} code={idea.code} title={idea.title} format={format.icon} />
            <div className="space-y-3 p-4">
              <div className="flex flex-wrap items-center gap-1.5">
                <StatusBadge status={idea.status} showStep={showPipeline} />
                {idea.priority === 'high' && <Chip icon="bolt" tone="mostaza">ALTA</Chip>}
                {age !== null && <Chip icon="clock" tone={age > 14 ? 'fucsia' : 'neutro'} className={age > 14 ? 'anim-pulse' : ''} title={`Última actividad hace ${age} días`}>{age}D</Chip>}
                <Chip icon={format.icon} tone="neutro">{format.label}</Chip>
              </div>
              <h2 className="font-display text-xl font-bold leading-tight text-blanco group-hover:text-mostaza">{idea.title}</h2>
              {idea.description && <p className="line-clamp-2 text-xs leading-5 text-blanco-60">{idea.description}</p>}
              {showPipeline && <ProductionPipeline status={idea.status} compact />}
              <BriefRail states={briefState(idea)} />
              <div className="flex items-center justify-between gap-3 border-t border-blanco-10 pt-3">
                {meta.who === '—'
                  ? <Chip icon="check" tone="neutro">CERRADA · NADIE ESPERA</Chip>
                  : <ActorChip who={meta.who} prefix="AQUÍ ACTÚA" />}
                <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap font-mono text-[10px] text-fucsia">
                  ABRIR <Icon name="arrow" size={12} className="transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </div>
          </Link>;
        })}
      </div> : <section className="border-2 border-dashed border-blanco-20 p-6">
        <p className="eyebrow mb-4">[COLA VACÍA]</p>
        <EmptyState icon="decisions" title={empty} hint="Cuando una pieza llegue a esta fase aparecerá aquí, con su responsable y su brief." action={{ href: `/${projectSlug}/ideas`, label: 'IR AL BANCO DE IDEAS' }} />
      </section>}
    </div>
  </main>;
}
