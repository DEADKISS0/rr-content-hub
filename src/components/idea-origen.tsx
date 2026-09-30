import { Icon, type IconName } from './ui/icons';

/**
 * De dónde viene la idea.
 *
 * Santiago, 2026-09-29: "quiero que hagas una categoría para los proyectos donde
 * meteras las ideas que subas tu, para diferenciar las que se pongan manual y las
 * que tu montes".
 *
 * El color: fucsia es el color del equipo, mostaza el del cliente y orquídea el
 * de la información. Una idea montada por Hermes es información sobre cómo se
 * produjo la pieza, no el trabajo de nadie del equipo, así que va en orquídea y
 * no compite visualmente con las ideas que trae una persona.
 */

export type Origen = 'manual' | 'asistente';

const META: Record<Origen, { label: string; corto: string; icon: IconName; clase: string; ayuda: string }> = {
  manual: {
    label: 'IDEA DEL EQUIPO',
    corto: 'EQUIPO',
    icon: 'pieces',
    clase: 'border-blanco-30 text-blanco-80',
    ayuda: 'La propuso y la escribió una persona del equipo.',
  },
  asistente: {
    label: 'MONTADA POR HERMES',
    corto: 'HERMES',
    icon: 'spark',
    clase: 'border-orquidea-50 text-orquidea',
    ayuda: 'La propuso el asistente a partir de referencias reales. Revísala antes de aprobarla.',
  },
};

export function origenMeta(origen: string | null | undefined) {
  return META[origen === 'asistente' ? 'asistente' : 'manual'];
}

/** Insignia completa, con el texto largo. Para la ficha de la idea. */
export function IdeaOrigenChip({ origen }: { origen: string | null | undefined }) {
  const meta = origenMeta(origen);
  return <span
    title={meta.ayuda}
    className={`inline-flex items-center gap-1.5 border px-2 py-1 font-mono text-[10px] uppercase tracking-wide ${meta.clase}`}
  >
    <Icon name={meta.icon} size={12} />
    {meta.label}
  </span>;
}

/** Marca mínima, para tarjetas donde no cabe el texto. Siempre con el título
 *  completo en `title`, para que el hover diga qué es. */
export function IdeaOrigenTag({ origen }: { origen: string | null | undefined }) {
  const meta = origenMeta(origen);
  return <span
    title={meta.ayuda}
    className={`inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-wide ${meta.clase}`}
  >
    <Icon name={meta.icon} size={10} />
    {meta.corto}
  </span>;
}
