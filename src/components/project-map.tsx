'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { actGroup, daysSince, statusMeta, TONE_CLASS, type WorkflowStatus } from '@/lib/flow';
import { fechaEs, cuantoPara } from '@/lib/fecha-salida';
import { VoteQuick } from './vote-quick';
import { BOARD_COLUMNS } from '@/lib/queues';
import { BoardControls, type BoardFilters } from './board-controls';
import { FlowGuide } from './flow-guide';
import { StartHere } from './start-here';
import { ContentTypeTabs } from './content-type-tabs';
import { OrigenTabs, type OrigenTab } from './origen-tabs';
import { IdeaOrigenTag } from '@/components/idea-origen';
import { StatusBadge } from './status-badge';
import { ActorChip, Chip } from './ui/chips';
import { EmptyState } from './ui/empty-state';
import { Icon } from './ui/icons';
import { BriefRail, briefState, SegMeter } from './ui/meter';
import { formatOf } from './ui/cover';
import { PublicationPreview } from './ui/preview';
import { IdeaCoverFrame } from './ui/idea-cover-frame';
import type { IdeaCover as IdeaCoverAsset } from '@/lib/idea-cover';

export type BoardIdea = {
  /** MEDIDO 2026-10-01: la fecha de salida llega del servidor desde el PR #18;
   *  sin declararla aquí, este componente no podía leerla. */
  due_at?: string | null;
  /**
   * Conteo de la votación, MEDIDO lo mismo: el botón de la tarjeta tiene que
   * mostrar "faltan 2 de 3", y para eso necesita el número al pintar. Si no
   * viene, el botón saldría en cero y la tarjeta mentiría más de lo que ya
   * mentía.
   */
  aFavor?: number;
  enContra?: number;
  id: string;
  code?: string | null;
  title: string;
  description?: string | null;
  objective?: string | null;
  content_type?: string | null;
  category?: string | null;
  /** `manual` la escribio una persona, `asistente` la genero Hermes. */
  origen?: string | null;
  status: string;
  priority?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  reference_url?: string | null;
  reference_urls?: unknown;
  /**
   * Portada real de la pieza (`rr_hub_assets` con `asset_stage = 'reference_brief'`,
   * elegida por `cover_asset_id`). Llega desde `getIdeas`; si es `null` la tarjeta
   * pinta el marco de marca con el título.
   */
  cover_asset?: IdeaCoverAsset;
  camera_brief?: string | null;
  talent_brief?: string | null;
  edit_brief?: string | null;
  script_content?: string | null;
};

type ContentTypeFilter = 'all' | 'organic' | 'paid';
function matches(idea: BoardIdea, filters: BoardFilters, contentType: ContentTypeFilter, origen: OrigenTab): boolean {
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
  if (contentType !== 'all' && idea.content_type !== contentType) return false;
  // Santiago, 2026-09-30: separar de un vistazo lo que monta el equipo de lo que
  // monta Hermes. `undefined` se cuenta como manual: lo que no declara origen es
  // de una persona, que es como lo trata la base.
  if (origen !== 'all' && (idea.origen ?? 'manual') !== origen) return false;
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
  const [contentType, setContentType] = useState<ContentTypeFilter>('all');
  const [origen, setOrigen] = useState<OrigenTab>('all');
  const onChange = (next: Partial<BoardFilters>) => setFilters((current) => ({ ...current, ...next }));

  const visible = useMemo(() => ideas.filter((idea) => matches(idea, filters, contentType, origen)), [ideas, filters, contentType, origen]);
  const maxColumn = Math.max(1, ...BOARD_COLUMNS.map((column) => visible.filter((idea) => (column.statuses as readonly string[]).includes(idea.status)).length));

  const waitingClient = ideas.filter((idea) => actGroup(idea.status as WorkflowStatus) === 'cliente').length;
  const dirty = filters.query !== '' || filters.phase !== 'all' || filters.act !== 'all' || contentType !== 'all' || origen !== 'all';

  const counts = {
    all: ideas.length,
    organic: ideas.filter((i) => i.content_type === 'organic').length,
    paid: ideas.filter((i) => i.content_type === 'paid').length,
  };

  // Los conteos de origen salen de `ideas`, no de `visible`: si salieran de
  // `visible`, al elegir "del equipo" el botón de Hermes mostraría 0 y el filtro
  // parecería roto en vez de vacío.Lo que importa es que los dos
  // numeros esten siempre a la vista, se este filtrando o no.
  const origenCounts = {
    all: ideas.length,
    manual: ideas.filter((i) => (i.origen ?? 'manual') === 'manual').length,
    asistente: ideas.filter((i) => i.origen === 'asistente').length,
  };

  return (
    <section aria-labelledby="board-title" className="anim-rise">
      {/* Encabezado puro: solo dice qué es esta zona. Los controles y sus
          conteos viven en UN bloque, la barra de abajo. Antes aquí había un
          botón de cliente y un contador de info faltante que repetían lo que
          la barra y cada tarjeta ya dicen. */}
      <div className="mb-4">
        <p className="eyebrow">[MAPA DE OPERACIÓN]</p>
        <h2 id="board-title" className="section-heading mt-2">Todo el flujo, en una vista.</h2>
      </div>

      {/* Lo primero ya no son 25 tarjetas: es lo que necesita respuesta. */}
      <StartHere ideas={ideas} projectSlug={projectSlug} />

      {/* División orgánico / pauta: tabs limpias con conteo real. */}
      <div className="mb-6">
        <ContentTypeTabs value={contentType} onChange={setContentType} counts={counts} />
        <div className="mt-2">
          <OrigenTabs value={origen} onChange={setOrigen} counts={origenCounts} />
        </div>
      </div>

      <FlowGuide ideas={ideas} phase={filters.phase} onPhase={(phase) => onChange({ phase, act: 'all' })} />

      {/* La barra va FUERA del desplegable a propósito, y NO es sticky. El
          buscador tiene que estar a la vista antes de que nadie abra nada
          (medido 2026-09-27: escondido en un <details> cerrado, quien buscaba
          "O1" tenía que descubrir primero que existía un filtro). Y sin
          `sticky`, escribir no deja un contador flotando sobre un tablero
          cerrado: `dirty` abre el <details> en el mismo gesto. */}
      <BoardControls filters={filters} onChange={onChange} total={ideas.length} shown={visible.length} waiting={waitingClient} />

      {/* El trabajo completo sigue aquí, a una línea de distancia. Si alguien
          filtra o busca, se abre solo: no hay que hacer dos gestos. */}
      <details open={dirty || undefined} className="group/todas border border-blanco-20">
        <summary className="inline-flex w-full cursor-pointer list-none items-center gap-2 px-4 py-3 font-mono text-sm text-blanco-60 transition-colors hover:bg-blanco-05 hover:text-blanco">
          <Icon name="chevron" size={13} className="transition-transform group-open/todas:rotate-180" />
          VER TODAS LAS {ideas.length} PIEZAS Y EL MAPA COMPLETO
        </summary>
        <div className="p-4 pt-0">

      {filters.view === 'map' ? (
        <div key={`map-${filters.phase}`} className={`view-in grid gap-px border border-blanco-20 bg-blanco-10 ${filters.phase === 'all' ? 'lg:grid-cols-2 xl:grid-cols-4' : 'xl:grid-cols-2'}`}>
          {BOARD_COLUMNS.filter((column) => filters.phase === 'all' || column.key === filters.phase).map((column, index) => {
            const items = visible.filter((idea) => (column.statuses as readonly string[]).includes(idea.status));
            const originalIndex = BOARD_COLUMNS.findIndex((item) => item.key === column.key);
            const filtered = filters.query !== '' || filters.phase !== 'all' || filters.act !== 'all';
            return (
              <section key={column.key} aria-label={column.label} className="flex min-h-[22rem] flex-col bg-negro p-4">
                <header className="mb-4 border-b border-blanco-10 pb-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-[10px] text-blanco-40">0{originalIndex + 1} / 04</span>
                    <b key={items.length} className="anim-count font-display text-xl font-bold leading-none text-blanco">{items.length}</b>
                  </div>
                  <h3 className="mt-1 font-display text-lg font-bold text-blanco">{column.label}</h3>
                  <p className="mt-1 text-[11px] leading-4 text-blanco-50">{column.plain}</p>
                  <div className="mt-2"><SegMeter filled={items.length} total={maxColumn} tone="blanco" label="CARGA" /></div>
                </header>

                <div className="space-y-3">
                  {items.map((idea, cardIndex) => {
                    const meta = statusMeta(idea.status);
                    const format = formatOf(idea.category, idea.content_type);
                    const days = daysSince(idea.updated_at ?? idea.created_at);
                    const fecha = fechaEs(idea.due_at);
                    const vencido = cuantoPara(idea.due_at)?.vencido ?? false;
                    const tono = TONE_CLASS[meta.tone];
                    return (
                      /*
                       * MEDIDO 2026-10-01: esto era un `<Link>` que envolvía toda
                       * la tarjeta. Meterle un botón de voto dentro sería HTML
                       * inválido —no se puede anidar un `<button>` en un `<a>`— y
                       * el navegador lo sube de nivel y rompe la tarjeta entera.
                       *
                       * Por eso ahora la tarjeta es un `<article>`: el enlace se
                       * queda en el código y en el título, que es donde se espera
                       * pinchar para abrir la ficha, y el voto vive abajo como lo
                       * que es: un botón.
                       */
                      <article
                        key={idea.id}
                        style={{ ['--delay' as string]: `${cardIndex * 45}ms` }}
                        className={`idea-card cascade sheen group block border border-l-[3px] bg-negro transition-all duration-200 hover:border-blanco-40 ${tono.borderLeft}`}
                      >
                        {/* La portada real mandada sobre la referencia: si la idea
                            tiene un brief que es imagen, se ve; si no, el marco
                            de marca. `PublicationPreview` no se reemplaza, se
                            queda como segunda opción para cuando hay una URL
                            de referencia pero ningún asset de portada. */}
                        {idea.cover_asset
                          ? <IdeaCoverFrame code={idea.code} title={idea.title} asset={idea.cover_asset} format={format.icon} />
                          : <PublicationPreview url={idea.reference_url} code={idea.code} title={idea.title} format={format.icon} />}
                        <div className="space-y-3 p-3">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <StatusBadge status={idea.status} compact />
                            {idea.priority === 'high' && <Chip icon="bolt" tone="blanco">ALTA</Chip>}
                            {days !== null && <Chip icon="clock" tone="neutro" title={`Última actividad hace ${days} días`}>{days}D</Chip>}
                            {/* MEDIDO 2026-10-01: la fecha de salida ya llegaba
                                aquí (getIdeas la pide, mapIdea la copia) pero la
                                tarjeta no la pintaba. Este chip es de "hace
                                cuánto NO se mueve", que es otra cosa: por eso va
                                al lado y no encima, para que no se confundan. */}
                            {fecha && <Chip icon="calendar" tone={vencido ? 'mostaza' : 'neutro'} title={`Salida ${fecha}`}>SALIDA {fecha}</Chip>}
                            <Chip icon={format.icon} tone="neutro">{format.label}</Chip>
                            {idea.origen === 'asistente' && <IdeaOrigenTag origen={idea.origen} />}
                            {idea.category && (
                              <span className="font-mono text-[10px] uppercase tracking-wider text-blanco-40">
                                {idea.category}
                              </span>
                            )}
                          </div>
                          <h4 className="font-display text-base font-bold leading-tight text-blanco group-hover:text-blanco-90">
                            <Link
                              href={`/${projectSlug}/ideas/${idea.id}`}
                              className="outline-none after:absolute after:inset-0 after:content-[''] hover:underline"
                            >
                              {idea.title}
                            </Link>
                          </h4>
                          <BriefRail states={briefState(idea)} />
                          <div className="flex items-center gap-3 border-t border-blanco-10 pt-3">
                            <ActorChip who={meta.who} />
                          </div>

                          {/* MEDIDO 2026-10-01: 19 ideas carrying `voting` con
                              CERO votos, y el botón de votar solo existía dentro
                              de la ficha. Cero menciones de "votar" en el tablero,
                              en el banco y en aprobaciones. El sistema funcionaba
                              y nadie lo tocaba. */}
                          {idea.status === 'voting' && (
                            <VoteQuick
                              ideaId={idea.id}
                              inicial={{ aFavor: idea.aFavor ?? 0, enContra: idea.enContra ?? 0 }}
                            />
                          )}
                        </div>
                      </article>
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
        <div key="list-view" className="view-in border border-blanco-20">
          <div className="hidden grid-cols-[6rem_1fr_auto_auto_2px_auto] gap-4 border-b border-blanco-20 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.08em] text-blanco-60 lg:grid">
            <span>CÓDIGO</span><span>PIEZA</span><span>INFO</span><span>ESPERA A</span><span /><span>ESTADO</span>
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
                className="idea-row cascade grid grid-cols-1 items-center gap-3 px-4 py-3 transition-colors hover:bg-blanco-05 lg:grid-cols-[6rem_1fr_auto_auto_2px_auto] lg:gap-4"
              >
                <span className="w-24 shrink-0 overflow-hidden">
                  <PublicationPreview url={idea.reference_url} code={null} title={idea.title} format={format.icon} size="sm" />
                </span>
                <span className="min-w-0">
                  <b className="block truncate font-display text-base font-bold text-blanco">{idea.code ?? 'IDEA'} · {idea.title}</b>
                  <small className="flex flex-wrap items-center gap-x-2 font-mono text-[10px] uppercase tracking-[0.06em] text-blanco-60">
                    <span>{format.label}{days !== null ? ` · ${days}D` : ''}{idea.priority === 'high' ? ' · ALTA' : ''}</span>
                    {idea.origen === 'asistente' && <IdeaOrigenTag origen={idea.origen} />}
                  </small>
                </span>
                <span className="flex items-center gap-1" title="Qué información clave tiene cargada">
                  {states.map((state) => (
                    <span key={state.key} title={state.label} className={`h-4 w-4 border ${state.done ? 'border-blanco-50 bg-blanco-30' : 'border-blanco-30 bg-negro'}`} />
                  ))}
                </span>
                <span className="font-mono text-[10px] text-blanco-60">{meta.who}</span>
                <span className={`block h-4 w-1 shrink-0 ${TONE_CLASS[meta.tone].dot}`} aria-hidden />
                <StatusBadge status={idea.status} compact />
              </Link>
            );
          })}
          {!visible.length && <div className="p-5"><EmptyState icon="search" title="Nada coincide con la búsqueda." hint="Prueba con otro código (O1, P7), título o categoría." /></div>}
        </div>
      )}
        </div>
      </details>
    </section>
  );
}
