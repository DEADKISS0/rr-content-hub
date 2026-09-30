'use client';

import { Icon, type IconName } from './ui/icons';

/**
 * Quién aporta la idea, en la misma gramática que las pestañas de tipo.
 *
 * Santiago, 2026-09-30: "quiero que hagas una categoría para los proyectos donde
 * meteras las ideas que subas tu, para diferenciar las que se pongan manual y las
 * que tu montes". La insignia ya marcaba la tarjeta; esto deja filtrar por ella.
 *
 * Filtra, no esconde: el conteo va siempre en el botón y ninguna pestaña deja la
 * lista vacía sin querer, porque el conteo sale de las ideas ya filtradas por lo
 * demás, no del total de la base.
 */

export type OrigenTab = 'all' | 'manual' | 'asistente';

const TABS: { key: OrigenTab; label: string; icon: IconName; ayuda: string }[] = [
  { key: 'all', label: 'DE TODOS', icon: 'grid', ayuda: 'Todo, sin importar quién lo propuso' },
  { key: 'manual', label: 'DEL EQUIPO', icon: 'user', ayuda: 'Las que escribió una persona del equipo' },
  { key: 'asistente', label: 'DE HERMES', icon: 'spark', ayuda: 'Las que montó Hermes. Revísalas: no entran igual que una idea del equipo' },
];

export function OrigenTabs({
  value,
  onChange,
  counts,
}: {
  value: OrigenTab;
  onChange: (origen: OrigenTab) => void;
  counts: Record<OrigenTab, number>;
}) {
  return (
    <nav aria-label="Quién propuso la idea" className="flex flex-wrap gap-1">
      {TABS.map((tab) => {
        const active = value === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            aria-current={active ? 'page' : undefined}
            title={tab.ayuda}
            className={`
              group inline-flex items-center gap-2 px-3 py-2 font-mono text-[10px] tracking-wider uppercase
              border transition-all duration-150
              ${active
                ? tab.key === 'asistente'
                  ? 'bg-orquidea text-negro border-orquidea font-bold'
                  : 'bg-blanco text-negro border-blanco font-bold'
                : 'bg-transparent text-blanco-50 border-blanco-15 hover:border-blanco-40 hover:text-blanco'}
            `}
          >
            <Icon
              name={tab.icon}
              size={12}
              className={active ? 'text-negro' : 'text-blanco-30 group-hover:text-blanco'}
            />
            {tab.label}
            <span className={`ml-0.5 text-[10px] ${active ? 'text-negro/60' : 'text-blanco-25'}`}>
              {counts[tab.key]}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
