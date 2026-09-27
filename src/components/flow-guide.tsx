'use client';

import { useState } from 'react';
import { BOARD_COLUMNS, statusMeta, type WorkflowStatus } from '@/lib/flow';
import { Icon, type IconName } from './ui/icons';

/**
 * Guía paso a paso del flujo.
 *
 * Antes había que adivinar el camino: nueve botones sueltos y ninguna
 * explicación de la secuencia. Esto cuenta los cuatro pasos reales del tablero,
 * cuántas piezas hay en cada uno, quién actúa y qué pasa ahí. Cada paso filtra
 * el tablero — el filtro y la explicación son el mismo control, así que hay
 * menos botones y más contexto.
 */
const STEP_ICON: Record<string, IconName> = {
  ideas: 'spark',
  scripts: 'pen',
  production: 'camera',
  published: 'publish',
};

const STEP_ACTION: Record<string, string> = {
  ideas: 'La creativa propone y el cliente decide.',
  scripts: 'Se escribe el guion y se aprueba.',
  production: 'Se rueda, se sube el crudo, se monta y se aprueba el corte.',
  published: 'Se publica, se registra la evidencia y se cierra.',
};

export function FlowGuide({
  ideas,
  phase,
  onPhase,
}: {
  ideas: { status: string }[];
  phase: string;
  onPhase: (phase: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const counts = BOARD_COLUMNS.map((item) => ({
    ...item,
    count: ideas.filter((idea) => (item.statuses as readonly string[]).includes(idea.status)).length,
  }));
  const total = Math.max(1, ideas.length);
  // El conteo global salió de aquí a propósito: las cuatro tarjetas de paso ya
  // dicen cuántas piezas hay en cada uno y la barra de control dice el total
  // filtrado. Repetirlo en tres lugares era parte del ruido.

  return (
    <section aria-label="Guía del flujo" className="anim-rise mb-6 border border-blanco-20">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-blanco-10 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-blanco-50"><Icon name="roadmap" size={16} /></span>
          <h2 className="font-display text-lg font-bold text-blanco">ASÍ AVANZA UNA PIEZA</h2>
          <span className="hidden font-mono text-xs text-blanco-40 sm:inline">TOCA UN PASO Y VES SOLO ESAS</span>
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="inline-flex items-center gap-1.5 border border-blanco-20 px-2.5 py-1.5 font-mono text-xs text-blanco-60 transition-colors hover:border-blanco-40 hover:text-blanco"
        >
          <Icon name={open ? 'close' : 'eye'} size={13} />
          {open ? 'OCULTAR LA EXPLICACIÓN' : '¿QUÉ SIGNIFICA ESTO?'}
        </button>
      </div>

      <ol className="grid grid-cols-1 gap-px bg-blanco-10 sm:grid-cols-2 lg:grid-cols-5">
        {counts.map((item, index) => {
          const active = phase === item.key;
          const empty = item.count === 0;
          return (
            <li key={item.key} className="bg-negro">
              <button
                type="button"
                onClick={() => onPhase(active ? 'all' : item.key)}
                aria-pressed={active}
                title={`${item.label} · ${item.plain}`}
                className={`step-card group flex h-full w-full flex-col gap-2 p-4 text-left transition-all ${active ? 'bg-blanco-10' : 'hover:bg-blanco-05'}`}
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <span className="flex items-center justify-between">
                  <span className={`font-mono text-[10px] tracking-[0.1em] ${active ? 'text-blanco' : 'text-blanco-40'}`}>
                    PASO {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className={`transition-transform duration-200 group-hover:translate-x-0.5 ${active ? 'text-blanco' : 'text-blanco-30'}`}>
                    <Icon name={STEP_ICON[item.key] ?? 'piezas'} size={14} />
                  </span>
                </span>

                <span className={`font-display text-xl font-bold leading-none ${empty ? 'text-blanco-40' : 'text-blanco'}`}>{item.label}</span>

                <span className="flex items-baseline gap-2">
                  <b className={`font-display text-3xl font-bold leading-none ${empty ? 'text-blanco-20' : 'text-blanco'}`}>{item.count}</b>
                  <span className="font-mono text-[10px] text-blanco-40">{item.count === 1 ? 'PIEZA' : 'PIEZAS'}</span>
                </span>

                <span className="rail-track">
                  <span className="rail-fill" style={{ width: item.count ? `max(6%, ${Math.round((item.count / total) * 100)}%)` : '0%', animationDelay: `${index * 90 + 120}ms` }} />
                </span>

                <span className="font-mono text-[10px] leading-4 text-blanco-50">{STEP_ACTION[item.key] ?? item.plain}</span>

                <span className="font-mono text-[10px] leading-4 text-blanco-40">
                  {item.count ? firstActor(ideas, item.statuses) : 'NADIE ESPERANDO'}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {open && (
        <div className="anim-slide-down border-t border-blanco-20 bg-blanco-05 px-4 py-4">
          <p className="mono-label text-blanco-40">[CÓMO FUNCIONA, EN TRES LÍNEAS]</p>
          <ol className="mt-3 space-y-2 text-sm leading-6 text-blanco-60">
            <li><b className="text-blanco">1.</b> Cada pieza nace como idea y avanza hacia la derecha. Nadie la salta: cada paso tiene un responsable.</li>
            <li><b className="text-blanco">2.</b> Cuando el cliente tiene la pelota, la pieza se marca en mostaza. Cuando le toca al equipo, en orquídea. Cuando está en rodaje o edición, en fucsia.</li>
            <li><b className="text-blanco">3.</b> El medidor INFO de cada tarjeta dice cuánta información clave está cargada (0 a 5). Si está bajo, alguien va a preguntar.</li>
          </ol>
        </div>
      )}
    </section>
  );
}

/** Quién tiene la pelota en este paso — dato real del estado, no inventado. */
function firstActor(ideas: { status: string }[], statuses: readonly string[]): string {
  const inStep = ideas.filter((idea) => statuses.includes(idea.status));
  if (!inStep.length) return 'NADIE ESPERANDO';
  const actors = inStep.map((idea) => statusMeta(idea.status as WorkflowStatus).who);
  const unique = Array.from(new Set(actors));
  return `ESPERA A: ${unique.slice(0, 2).join(' · ')}`;
}
