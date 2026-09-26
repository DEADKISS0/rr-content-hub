'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { actGroup, BOARD_COLUMNS, daysSince, statusMeta, type WorkflowStatus } from '@/lib/flow';
import { BoardControls, type BoardFilters } from './board-controls';
import { FlowGuide } from './flow-guide';
import { StatusBadge } from './status-badge';
import { ActorChip, Chip } from './ui/chips';
import { EmptyState } from './ui/empty-state';
import { Icon } from './ui/icons';
import { BriefRail, briefState, SegMeter } from './ui/meter';
import { formatOf } from './ui/cover';
import { PublicationPreview } from './ui/preview';

export type BoardIdea = {
  id: string;
  code?: string | null;
  title: string;
  description?: string | null;
  objective?: string | null;
  content_type?: string | null;
  category?: string | null;
  status: string;
  priority?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  reference_url?: string | null;
  reference_urls?: unknown;
  camera_brief?: string | null;
  talent_brief?: string | null;
  edit_brief?: string | null;
  script_content?: string | null;
};

function matches(idea: BoardIdea, filters: BoardFilters): boolean {
  const query = filters.query.trim().toLowerCase();
  if (query) {
    const haystack = [idea.code, idea.title, idea.category, idea.description, idea.objective]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (!haystack.includes(query)) return false;
  }
  if (filters.phase !== 'all') {
    const column = BOARD_COLUMNS.find((item) => item.key === filters.phase);
    if (!column || !(column.statuses as readonly string[]).includes(idea.status)) return false;
  }
  if (filters.act !== 'all' && actGroup(idea.status as WorkflowStatus) !== filters.act) return false;
  return true;
}

/**
 * Mapa de producción del proyecto.
 *
 * Jerarquía de la pantalla, de arriba a abajo: guía del flujo (dónde estoy y
 * qué sigue) → controles (buscar, filtrar, ver) → las piezas. Los botones se
 * recortaron a lo mínimo: crear vive en el header del shell y en los estados
 * vacíos, no repetido en cada sección. Cada filtro tiene un solo lugar.
 */
export function ProjectMap({ ideas, projectSlug }: { ideas: BoardIdea[]; projectSlug: string }) {
  const [filters, setFilters] = useState<BoardFilters>({ query: '', phase: 'all', act: 'all', view: 'map' });
  const onChange = (next: Partial<BoardFilters>) => setFilters((current) => ({ ...current, ...next }));

  const visible = useMemo(() => ideas.filter((idea) => matches(idea, filters)), [ideas, filters]);
  const maxColumn = Math.max(1, ...BOARD_COLUMNS.map((column) => visible.filter((idea) => (column.statuses as readonly string[]).includes(idea.status)).length));

  const waitingClient = ideas.filter((idea) => actGroup(idea.status as WorkflowStatus) === 'cliente').length;

  return (
    <section aria-labelledby="board-title" className="anim-rise">
      {/* Encabezado puro: solo dice qué es esta zona. Los controles y sus
          conteos viven en UN bloque, la barra de abajo. Antes aquí había un
          botón de cliente y un contador de info faltante que repetían lo que
          la barra y cada tarjeta ya dicen. */}
      <div className="mb-4">
        <p className="eyebrow">[MAPA DE OPERACIÓN]</p>
        <h2 id="board-title" className="section-heading mt-2">TODO EL FLUJO, EN UNA VISTA.</h2>
      </div>

      <FlowGuide ideas={ideas} phase={filters.phase} onPhase={(phase) => onChange({ phase, act: 'all' })} />

      <BoardControls filters={filters} onChange={onChange} total={ideas.length} shown={visible.length} waiting={waitingClient} />

      {filters.view === 'map' ? (
        <div key={`map-${filters.phase}`} className={`view-in grid gap-px border-2 border-blanco bg-blanco-20 ${filters.phase === 'all' ? 'lg:grid-cols-2 xl:grid-cols-4' : 'xl:grid-cols-2'}`}>
          {BOARD_COLUMNS.filter((column) => filters.phase === 'all' || column.key === filters.phase).map((column, index) => {
            const items = visible.filter((idea) => (column.statuses as readonly string[]).includes(idea.status));
            const originalIndex = BOARD_COLUMNS.findIndex((item) => item.key === column.key);
            const filtered = filters.query !== '' || filters.phase !== 'all' || filters.act !== 'all';
            return (
              <section key={column.key} aria-label={column.label} className="flex min-h-[22rem] flex-col bg-negro p-4">
                <header className="mb-4 border-b border-blanco-20 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-mono text-[10px] text-mostaza">0{originalIndex + 1} / 04</span>
                    {/* key={items.length}: al cambiar el número el span se remonta
                        y el contador vuelve a entrar en vez de cambiar en silencio. */}
                    <b key={items.length} className="anim-count font-display text-3xl font-bold leading-none text-blanco">{items.length}</b>
                  </div>
                  <h3 className="mt-2 font-display text-xl font-bold text-blanco">{column.label}</h3>
                  <p className="mt-1 text-[11px] leading-4 text-blanco-60">{column.plain}</p>
                  <div className="mt-3"><SegMeter filled={items.length} total={maxColumn} tone={index === 2 ? 'fucsia' : index === 3 ? 'orquidea' : 'mostaza'} label="CARGA" /></div>
                </header>

                <div className="space-y-3">
                  {items.map((idea, cardIndex) => {
                    const meta = statusMeta(idea.status);
                    const format = formatOf(idea.category, idea.content_type);
                    const days = daysSince(idea.updated_at ?? idea.created_at);
                    return (
                      <Link
                        key={idea.id}
                        href={`/${projectSlug}/ideas/${idea.id}`}
                        style={{ ['--delay' as string]: `${cardIndex * 45}ms` }}
                        className="idea-card cascade sheen group block border-2 border-blanco-20 bg-negro transition-all duration-200 hover:-translate-y-1 hover:border-fucsia"
                      >
                        <PublicationPreview url={idea.reference_url} code={idea.code} title={idea.title} format={format.icon} />
                        <div className="space-y-3 p-3">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <StatusBadge status={idea.status} compact />
                            {idea.priority === 'high' && <Chip icon="bolt" tone="mostaza">ALTA</Chip>}
                            {days !== null && <Chip icon="clock" tone={days > 14 ? 'fucsia' : 'neutro'} className={days > 14 ? 'anim-pulse' : ''} title={`Última actividad hace ${days} días`}>{days}D</Chip>}
                            <Chip icon={format.icon} tone="neutro">{format.label}</Chip>
                          </div>
                          <h4 className="font-display text-base font-bold leading-tight text-blanco group-hover:text-mostaza">{idea.title}</h4>
                          <BriefRail states={briefState(idea)} />
                          <div className="flex items-center justify-between gap-3 border-t border-blanco-10 pt-3">
                            <ActorChip who={meta.who} />
                            <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap font-mono text-[10px] text-fucsia">
                              ABRIR <Icon name="arrow" size={12} className="transition-transform group-hover:translate-x-0.5" />
                            </span>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                  {!items.length && (
                    <EmptyState
                      icon={originalIndex === 2 ? 'camera' : originalIndex === 3 ? 'publish' : 'pieces'}
                      title={filtered ? 'Sin piezas con ese filtro.' : 'Todavía no hay piezas aquí.'}
                      hint={filtered ? 'Prueba limpiando los filtros o busca otro código.' : column.plain}
                      action={filtered ? undefined : { href: `/${projectSlug}/ideas/nueva`, label: 'CREAR LA PRIMERA' }}
                    />
                  )}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div key="list-view" className="view-in border-2 border-blanco">
          <div className="hidden grid-cols-[6rem_1fr_auto_auto_auto] gap-4 border-b-2 border-blanco px-4 py-2 font-mono text-[10px] uppercase tracking-[0.08em] text-blanco-60 lg:grid">
            <span>CÓDIGO</span><span>PIEZA</span><span>INFO</span><span>ESPERA A</span><span>ESTADO</span>
          </div>
          {visible.map((idea, rowIndex) => {
            const meta = statusMeta(idea.status);
            const format = formatOf(idea.category, idea.content_type);
            const days = daysSince(idea.updated_at ?? idea.created_at);
            const states = briefState(idea);
            return (
              <Link
                key={idea.id}
                href={`/${projectSlug}/ideas/${idea.id}`}
                style={{ ['--delay' as string]: `${Math.min(rowIndex, 12) * 28}ms` }}
                className="idea-row cascade grid grid-cols-1 items-center gap-3 px-4 py-3 transition-colors hover:bg-fucsia/10 lg:grid-cols-[6rem_1fr_auto_auto_auto] lg:gap-4"
              >
                <span className="w-24 shrink-0 overflow-hidden">
                  <PublicationPreview url={idea.reference_url} code={null} title={idea.title} format={format.icon} size="sm" />
                </span>
                <span className="min-w-0">
                  <b className="block truncate font-display text-base font-bold text-blanco">{idea.code ?? 'IDEA'} · {idea.title}</b>
                  <small className="font-mono text-[10px] uppercase tracking-[0.06em] text-blanco-60">{format.label}{days !== null ? ` · ${days}D` : ''}{idea.priority === 'high' ? ' · ALTA' : ''}</small>
                </span>
                <span className="flex items-center gap-1">
                  {states.map((state) => <span key={state.key} title={state.label} className={`h-4 w-4 border ${state.done ? 'border-fucsia bg-fucsia' : 'border-blanco-30'}`} />)}
                </span>
                <span className="font-mono text-[10px] text-blanco-60">{meta.who}</span>
                <StatusBadge status={idea.status} compact />
              </Link>
            );
          })}
          {!visible.length && <div className="p-5"><EmptyState icon="search" title="Nada coincide con la búsqueda." hint="Prueba con otro código (O1, P7), título o categoría." /></div>}
        </div>
      )}
    </section>
  );
}
