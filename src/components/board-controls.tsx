'use client';

import { useEffect } from 'react';
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
 * Barra de control del tablero.
 *
 * Reescrita el 2026-09-26 por una razón medida: la pantalla tenía 47 cosas
 * clicables y nadie encontraba nada.
 *
 * Rehecha el 2026-09-27 por otra razón igual de medida: el buscador había
 * quedado DENTRO de un `<details>` que arrancaba cerrado, así que quien llegaba
 * sabiendo qué buscaba ("¿dónde está O1?") tenía que descubrir primero que
 * existía un filtro. Búsqueda siempre visible, con atajo de `/`. Lo demás
 * —cambiar de vista y filtrar por responsable— sí es de exploración, así que
 * se repliega detrás de un resumen que NOMBRA las dos cosas: un cajón con
 * tres cosas distintas dentro es un cajón de sastre.
 *
 * `sticky` es opcional y el tablero lo apaga a propósito: la barra vive fuera
 * del `<details>` que guarda las tarjetas, así que si flotara se quedaría
 * pegada sobre un tablero cerrado, con un contador que cambia y nada visible
 * que lo explique.
 */
export function BoardControls({
  filters,
  onChange,
  total,
  shown,
  waiting,
  sticky = true,
}: {
  filters: BoardFilters;
  onChange: (next: Partial<BoardFilters>) => void;
  total: number;
  shown: number;
  waiting: number;
  sticky?: boolean;
}) {
  const dirty = filters.query !== '' || filters.phase !== 'all' || filters.act !== 'all';
  const activeGroup = filters.act === 'all'
    ? 'TODOS'
    : ACT_GROUPS.find((group) => group.key === filters.act)?.label ?? filters.act.toUpperCase();

  // Atajo "/" para buscar. Se registra en `document` y se salta si el foco ya
  // está escribiendo: teclear "/" dentro del buscador tiene que seguir
  // escribiendo "/", no robar la tecla.
  useEffect(() => {
    const alTeclear = (event: KeyboardEvent) => {
      const foco = document.activeElement;
      const escribiendo = foco instanceof HTMLInputElement || foco instanceof HTMLTextAreaElement;
      const atajo = event.key === '/' && !escribiendo && !event.metaKey && !event.ctrlKey && !event.altKey;
      if (atajo) {
        event.preventDefault();
        document.querySelector<HTMLInputElement>('[data-atajo-buscar]')?.focus();
        return;
      }
      const enBuscador = foco === document.querySelector('[data-atajo-buscar]');
      if (event.key === 'Escape' && enBuscador && filters.query) onChange({ query: '' });
    };
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [filters.query, onChange]);

  return (
    <div className={`${sticky ? 'sticky top-[68px] z-20' : ''} -mx-5 mb-6 border-y border-blanco-20 bg-negro/95 px-5 py-3 backdrop-blur md:-mx-10 md:px-10`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="group flex min-w-[16rem] flex-1 items-center gap-2 border border-blanco-20 bg-negro px-3 py-2 transition-colors focus-within:border-blanco-40">
          <Icon name="search" size={14} className="shrink-0 text-blanco-50 transition-colors group-focus-within:text-blanco" />
          <input
            value={filters.query}
            onChange={(event) => onChange({ query: event.target.value })}
            placeholder="Buscar por código, título o categoría…"
            aria-label="Buscar piezas"
            data-atajo-buscar
            className="w-full bg-transparent font-mono text-sm text-blanco outline-none placeholder:text-blanco-50"
          />
          {filters.query ? (
            <button type="button" aria-label="Limpiar búsqueda" onClick={() => onChange({ query: '' })} className="anim-pop shrink-0 text-blanco-60 transition-colors hover:text-blanco">
              <Icon name="close" size={13} />
            </button>
          ) : (
            <kbd className="hidden shrink-0 border border-blanco-20 px-1.5 py-0.5 font-mono text-[10px] text-blanco-40 lg:inline">/</kbd>
          )}
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <span aria-live="polite" className="font-mono text-xs text-blanco-60">
            <b className="anim-count text-blanco">{shown}</b>/{total} PIEZAS · <b className="anim-count text-blanco">{waiting}</b> ESPERANDO
          </span>

          <details className="group/ver">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 border border-blanco-20 px-2.5 py-1.5 font-mono text-xs text-blanco-60 transition-colors hover:border-blanco-40 hover:text-blanco">
              <Icon name="filter" size={12} />
              VISTA
              {filters.act !== 'all' ? ` · ${activeGroup}` : ''} Y RESPONSABLE
              <Icon name="chevron" size={12} className="transition-transform group-open/ver:rotate-180" />
            </summary>
            <div className="anim-slide-down mt-2 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1 border border-blanco-20 p-0.5" role="group" aria-label="Vista">
                {(['map', 'list'] as BoardView[]).map((view) => {
                  const active = filters.view === view;
                  return (
                    <button
                      key={view}
                      type="button"
                      onClick={() => onChange({ view })}
                      aria-pressed={active}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 font-mono text-xs transition-colors ${active ? 'bg-blanco text-negro' : 'text-blanco-60 hover:text-blanco'}`}
                    >
                      <Icon name={view === 'map' ? 'grid' : 'list'} size={13} />
                      {view === 'map' ? 'TARJETAS' : 'LISTA'}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onChange({ act: 'all' })}
                  aria-pressed={filters.act === 'all'}
                  className={`border px-2.5 py-1.5 font-mono text-xs uppercase tracking-[0.06em] transition-colors ${filters.act === 'all' ? 'border-blanco bg-blanco text-negro' : 'border-blanco-20 text-blanco-60 hover:border-blanco hover:text-blanco'}`}
                >
                  TODOS
                </button>
                {ACT_GROUPS.map((group) => {
                  const active = filters.act === group.key;
                  return (
                    <button
                      key={group.key}
                      type="button"
                      onClick={() => onChange({ act: active ? 'all' : group.key, phase: 'all' })}
                      aria-pressed={active}
                      className={`border px-2.5 py-1.5 font-mono text-xs uppercase tracking-[0.06em] transition-colors ${active ? 'border-blanco bg-blanco text-negro' : 'border-blanco-20 text-blanco-60 hover:border-blanco hover:text-blanco'}`}
                    >
                      {group.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </details>

          {dirty && (
            <button
              type="button"
              onClick={() => onChange({ query: '', phase: 'all', act: 'all' })}
              className="anim-pop inline-flex items-center gap-1 border border-blanco-20 px-2.5 py-1.5 font-mono text-xs text-blanco-60 transition-colors hover:border-blanco-40 hover:bg-blanco-10 hover:text-blanco"
            >
              <Icon name="close" size={12} /> VER TODAS OTRA VEZ
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
