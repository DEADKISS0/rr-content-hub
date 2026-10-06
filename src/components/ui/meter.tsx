import { PHASES, phaseIndex, type WorkflowStatus } from '@/lib/flow';
import { Icon, type IconName } from './icons';

type Tone = 'fucsia' | 'mostaza' | 'orquidea' | 'blanco';

const TONE_FILL: Record<Tone, string> = {
  fucsia: 'bg-fucsia border-fucsia',
  mostaza: 'bg-mostaza border-mostaza',
  orquidea: 'bg-orquidea border-orquidea',
  blanco: 'bg-blanco border-blanco',
};

/**
 * Medidor de segmentos. Se usa para dos preguntas concretas: "¿en qué fase
 * está la pieza?" y "¿qué tan completa va la información?". En ambos casos el
 * número solo no alcanza: la etiqueta dice qué falta.
 */
export function SegMeter({ filled, total, tone = 'fucsia', label, compact = false }: { filled: number; total: number; tone?: Tone; label?: string; compact?: boolean }) {
  const safe = Math.max(0, Math.min(filled, total));
  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-1 gap-[3px]" role="img" aria-label={label ?? `${safe} de ${total}`}>
        {Array.from({ length: total }).map((_, index) => (
          <span key={index} className={`h-[7px] flex-1 border ${index < safe ? TONE_FILL[tone] : 'border-blanco-30 bg-blanco-10'}`} />
        ))}
      </div>
      {label && <span className="font-mono text-[10px] tracking-[0.08em] text-blanco-50 whitespace-nowrap">{label}</span>}
    </div>
  );
}

/** Los cuatro pasos de producción como riel, no como número escondido. */
export function PhaseRail({ status, compact = false }: { status: string; compact?: boolean }) {
  const active = phaseIndex(status as WorkflowStatus);
  return (
    /*
     * MEDIDO 2026-10-01: los `<span>` eran `flex-1` sin `min-w-0` y sin wrap, y
     * el riel medía 414px en una ficha de 390: la sexta pastilla (DESCARTADAS)
     * acababa en x=454, 64px fuera de pantalla. En un iPhone era imposible
     * saber que existía una sexta fase.
     *
     * Ahora `min-w-0` permite que encojan y `flex-wrap` las pasa a la línea de
     * abajo si aun así no caben. Nada queda fuera de la pantalla, que es lo
     * único que importa: que se vean estrechas es aceptable, que no se vean no.
     */
    <div className="flex flex-wrap items-stretch gap-[3px]">
      {PHASES.map((phase, index) => {
        const state = index < active ? 'done' : index === active ? 'live' : 'todo';
        const skin = state === 'live' ? 'border-blanco-40 bg-blanco-10 text-blanco' : state === 'done' ? 'border-blanco-30 bg-blanco-10 text-blanco-60' : 'border-blanco-30 bg-negro text-blanco-50';
        return (
          /*
           * El `title=` no se quita: es la explicación en el escritorio. Pero
           * el texto visible dice lo mismo, porque en táctil no hay hover y
           * esa información era inalcanzable en el móvil. `aria-label` para el
           * lector de pantalla.
           */
          <span
            key={phase.key}
            className={`min-w-0 flex-1 basis-16 border px-2 py-1 text-center font-mono text-[10px] uppercase leading-4 tracking-[0.06em] ${skin}`}
            title={`${phase.label} · ${phase.detail}`}
            aria-label={`${phase.label}: ${phase.detail}`}
          >
            {compact ? index + 1 : phase.label}
          </span>
        );
      })}
    </div>
  );
}

export type BriefState = { key: string; label: string; icon: IconName; done: boolean };

/**
 * ¿Qué le falta a esta pieza para avanzar? Se calcula con datos reales de la
 * fila (briefs, guion, referencia). Es la pregunta que hoy nadie puede
 * responder sin abrir la ficha.
 */
export function briefState(idea: {
  camera_brief?: string | null; talent_brief?: string | null; edit_brief?: string | null;
  script_content?: string | null; reference_urls?: unknown;
}): BriefState[] {
  const has = (value?: string | null) => Boolean(value && value.trim().length > 2);
  const refs = Array.isArray(idea.reference_urls) ? idea.reference_urls : [];
  return [
    { key: 'ref', label: 'REFERENCIA', icon: 'link', done: refs.length > 0 },
    { key: 'cam', label: 'CÁMARA', icon: 'camera', done: has(idea.camera_brief) },
    { key: 'tal', label: 'TALENTO', icon: 'user', done: has(idea.talent_brief) },
    { key: 'edi', label: 'EDICIÓN', icon: 'scissors', done: has(idea.edit_brief) },
    { key: 'gui', label: 'GUION', icon: 'pen', done: has(idea.script_content) },
  ];
}

/**
 * Riel de completitud: el color va en lo que está LISTO, y se apaga en lo que
 * falta. Es el acento con más carga informativa del tablero — cinco casillas
 * que dicen "¿qué le falta a esta pieza?" — así que vuelve a la marca: quien
 * mira de reojo ve dónde está el trabajo incompleto sin leer nada.
 */
export function BriefRail({ states }: { states: BriefState[] }) {
  const done = states.filter((state) => state.done).length;
  const falta = states.filter((state) => !state.done);
  const completo = done === states.length;
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-[3px]">
        {states.map((state) => (
          <span key={state.key} title={`${state.label}: ${state.done ? 'listo' : 'falta'}`} className={`flex h-6 w-6 items-center justify-center border ${state.done ? 'border-orquidea bg-orquidea text-negro' : 'border-blanco-20 bg-negro text-blanco-30'}`}>
            <Icon name={state.icon} size={12} />
          </span>
        ))}
      </div>
      {completo ? (
        <span className="font-mono text-[10px] text-orquidea">INFO {done}/{states.length} ✓</span>
      ) : (
        <span className="font-mono text-[10px] text-blanco-50">
          INFO {done}/{states.length} · falta {falta.map(s => s.label).join(', ')}
        </span>
      )}
    </div>
  );
}
