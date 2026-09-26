'use client';

import { ACT_GROUPS } from '@/lib/flow';
import { Icon } from './ui/icons';

export type BoardView = 'map' | 'list';

export type BoardFilters = {
  query: string;
  phase: string;
  act: string;
  view: BoardView;
};

/**
 * Barra de control pegajosa.
 *
 * Deliberadamente corta: buscar, filtrar por quién actúa, cambiar de vista. El
 * filtro por paso vive en la guía del flujo — tenerlo en dos lugares era la
 * razón de que nadie supiera cuál manda. "Limpiar" aparece solo si hay algo que
 * limpiar, y el contador avisa en voz alta para lectores de pantalla.
 */
export function BoardControls({
  filters,
  onChange,
  total,
  shown,
  waiting,
}: {
  filters: BoardFilters;
  onChange: (next: Partial<BoardFilters>) => void;
  total: number;
  shown: number;
  waiting: number;
}) {
  const dirty = filters.query !== '' || filters.phase !== 'all' || filters.act !== 'all';
  const activeGroup = filters.act === 'all'
    ? 'TODOS'
    : ACT_GROUPS.find((group) => group.key === filters.act)?.label ?? filters.act.toUpperCase();

  return (
    <div className="sticky top-[84px] z-20 -mx-5 mb-6 border-y-2 border-blanco bg-negro/95 px-5 py-3 backdrop-blur md:-mx-10 md:px-10">
      <div className="flex flex-wrap items-center gap-3">
        <label className="group flex min-w-[15rem] flex-1 items-center gap-2 border-2 border-blanco-20 bg-negro px-3 py-2 transition-colors focus-within:border-fucsia">
          <Icon name="search" size={14} className="text-blanco-50 transition-colors group-focus-within:text-fucsia" />
          <input
            value={filters.query}
            onChange={(event) => onChange({ query: event.target.value })}
            placeholder="Busca por código, título o categoría…"
            aria-label="Buscar piezas"
            className="w-full bg-transparent font-mono text-xs text-blanco outline-none placeholder:text-blanco-50"
          />
          {filters.query && (
            <button type="button" aria-label="Limpiar búsqueda" onClick={() => onChange({ query: '' })} className="anim-pop text-blanco-60 transition-colors hover:text-fucsia">
              <Icon name="close" size={13} />
            </button>
          )}
        </label>

        <div className="flex items-center gap-1 border-2 border-blanco-20 p-0.5" role="group" aria-label="Vista">
          {(['map', 'list'] as BoardView[]).map((view) => {
            const active = filters.view === view;
            return (
              <button
                key={view}
                type="button"
                onClick={() => onChange({ view })}
                aria-pressed={active}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 font-mono text-[10px] transition-colors ${active ? 'bg-mostaza text-negro' : 'text-blanco-60 hover:text-mostaza'}`}
              >
                <Icon name={view === 'map' ? 'grid' : 'list'} size={12} />
                {view === 'map' ? 'MAPA' : 'LISTA'}
              </button>
            );
          })}
        </div>

        <span aria-live="polite" className="font-mono text-[10px] text-blanco-60">
          <b className="anim-count text-blanco">{shown}</b>/{total} PIEZAS · <b className="anim-count text-mostaza">{waiting}</b> ESPERANDO
        </span>

        {dirty && (
          <button
            type="button"
            onClick={() => onChange({ query: '', phase: 'all', act: 'all' })}
            className="anim-pop inline-flex items-center gap-1 border border-fucsia px-2 py-1.5 font-mono text-[10px] text-fucsia transition-colors hover:bg-fucsia hover:text-blanco"
          >
            <Icon name="close" size={12} /> LIMPIAR
          </button>
        )}
      </div>

      <div className="mt-3">
        {/* Los seis responsables viven dentro de un desplegable: la barra pasa de
            siete botones siempre visibles a uno que dice quién está filtrando.
            Sin estado controlado a propósito — así el navegador maneja el
            abrir/cerrar y no pelea con React. */}
        <details className="group/act">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 border border-blanco-20 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-blanco-60 transition-colors hover:border-fucsia hover:text-fucsia">
            <Icon name="filter" size={11} />
            QUIÉN ACTÚA: <b className={filters.act === 'all' ? 'text-blanco' : 'text-fucsia'}>{activeGroup}</b>
            <Icon name="chevron" size={11} className="transition-transform group-open/act:rotate-180" />
          </summary>
          <div className="anim-slide-down mt-2 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => onChange({ act: 'all' })}
              aria-pressed={filters.act === 'all'}
              className={`border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em] transition-colors ${filters.act === 'all' ? 'border-blanco bg-blanco text-negro' : 'border-blanco-20 text-blanco-60 hover:border-blanco hover:text-blanco'}`}
            >
              TODOS
            </button>
            {ACT_GROUPS.map((group) => {
              const active = filters.act === group.key;
              const isClient = group.key === 'cliente';
              return (
                <button
                  key={group.key}
                  type="button"
                  onClick={() => onChange({ act: active ? 'all' : group.key, phase: 'all' })}
                  aria-pressed={active}
                  className={`border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em] transition-colors ${active ? (isClient ? 'border-mostaza bg-mostaza text-negro' : 'border-fucsia bg-fucsia text-blanco') : 'border-blanco-20 text-blanco-60 hover:border-fucsia hover:text-fucsia'}`}
                >
                  {group.label}
                </button>
              );
            })}
          </div>
        </details>
      </div>
    </div>
  );
}
