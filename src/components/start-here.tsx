'use client';

import Link from 'next/link';
import { actGroup, daysSince, statusMeta, type WorkflowStatus } from '@/lib/flow';
import { QUEUES } from '@/lib/queues';
import { Icon } from './ui/icons';

type Pieza = {
  id: string;
  code?: string | null;
  title: string;
  status: string;
  created_at?: string | null;
  updated_at?: string | null;
};

/**
 * "Empieza por aquí".
 *
 * Por qué existe: medido el 2026-09-26, al abrir el hub lo primero que aparecía
 * eran **25 tarjetas en cuatro columnas** — 225 datos sueltos antes de que nadie
 * supiera qué mirar. Esto pone delante lo único que importa al entrar: las pocas
 * piezas que están esperando una respuesta, ordenadas por lo que más lleva
 * parado, en renglones grandes con una sola acción cada uno.
 *
 * El resto del tablero sigue ahí, una línea más abajo y plegado: no se esconde
 * nada, solo deja de ser lo primero.
 */
const ESPERAN: readonly string[] = QUEUES.aprobaciones.statuses;

export function StartHere({ ideas, projectSlug }: { ideas: Pieza[]; projectSlug: string }) {
  const esperando = ideas
    .filter((idea) => ESPERAN.includes(idea.status))
    .map((idea) => ({ idea, dias: daysSince(idea.updated_at ?? idea.created_at) ?? 0 }))
    .sort((a, b) => b.dias - a.dias);

  const urgentes = esperando.slice(0, 5);
  const cliente = esperando.filter(({ idea }) => actGroup(idea.status as WorkflowStatus) === 'cliente').length;

  return (
    <section aria-labelledby="empezar-aqui" className="anim-rise mb-8 border-2 border-fucsia bg-fucsia/10">
      <div className="border-b-2 border-fucsia px-5 py-4">
        <p className="mono-label text-fucsia">[EMPIEZA POR AQUÍ]</p>
        <h2 id="empezar-aqui" className="mt-2 font-display text-2xl font-bold leading-tight text-blanco sm:text-3xl">
          {esperando.length === 0
            ? 'HOY NO HAY NADA PARADO.'
            : <>HAY {esperando.length} {esperando.length === 1 ? 'PIEZA ESPERANDO' : 'PIEZAS ESPERANDO'} RESPUESTA.</>}
        </h2>
        <p className="mt-3 max-w-3xl text-base leading-7 text-blanco-70">
          {esperando.length === 0
            ? 'Todo avanza solo. Puedes bajar a ver el trabajo completo cuando quieras.'
            : cliente === esperando.length
              ? 'Todas están esperando al cliente. Abre una y decide: aprobar o pedir cambios.'
              : `${cliente} esperan al cliente y ${esperando.length - cliente} al equipo de RR. Abre la de arriba: es la que más lleva parada.`}
        </p>
      </div>

      {urgentes.length > 0 && (
        <ol className="divide-y-2 divide-fucsia/40">
          {urgentes.map(({ idea, dias }) => {
            const meta = statusMeta(idea.status as WorkflowStatus);
            const esCliente = actGroup(idea.status as WorkflowStatus) === 'cliente';
            return (
              <li key={idea.id}>
                <Link
                  href={`/${projectSlug}/ideas/${idea.id}`}
                  className="group flex flex-wrap items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-fucsia/15"
                >
                  <span className="min-w-0">
                    <span className="block font-mono text-xs text-mostaza">
                      {idea.code ?? 'IDEA'} · {esCliente ? 'ESPERA TU RESPUESTA' : `ESPERA A ${meta.who}`}
                      {dias > 0 ? ` · ${dias} ${dias === 1 ? 'DÍA' : 'DÍAS'}` : ' · HOY'}
                    </span>
                    <span className="mt-1 block font-display text-lg font-bold leading-tight text-blanco group-hover:text-mostaza sm:text-xl">
                      {idea.title}
                    </span>
                  </span>
                  <span className="btn-brutal inline-flex shrink-0 items-center gap-2">
                    ABRIR <Icon name="arrow" size={14} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}

      {esperando.length > urgentes.length && (
        <p className="border-t-2 border-fucsia px-5 py-3 font-mono text-xs text-blanco-60">
          Y {esperando.length - urgentes.length} más abajo, en el trabajo completo.
        </p>
      )}
    </section>
  );
}
