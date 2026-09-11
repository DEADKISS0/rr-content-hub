'use client';

import { useEffect, useState } from 'react';
import { ROLE_HOME, ROLE_LABEL, PHASES, type RoleKey } from '@/lib/flow';
import { buttonsForRole, type ButtonHelp } from '@/lib/button-guide';
import { useActiveRole, setStoredRole } from '@/lib/role-client';

const SEEN_KEY = 'rr-hub-help-seen';
const ALL_ROLES: { key: RoleKey; blurb: string }[] = [
  { key: 'owner', blurb: 'Coordinación total, desbloqueos y decisiones de cliente.' },
  { key: 'creator', blurb: 'Propone ideas, completa briefs y escribe los guiones.' },
  { key: 'camera', blurb: 'Rueda lo aprobado y sube el crudo.' },
  { key: 'model', blurb: 'Interpreta el talento según el brief.' },
  { key: 'editor', blurb: 'Monta el crudo y entrega versiones.' },
  { key: 'publisher', blurb: 'Publica y registra la evidencia.' },
  { key: 'media_buyer', blurb: 'Mide y optimiza la pauta.' },
  { key: 'client_approver', blurb: 'Aprueba o pide ajustes a ideas y guiones.' },
  { key: 'client_viewer', blurb: 'Consulta el avance sin editar.' },
];

type Tab = 'FLUJO' | 'BOTONES' | 'ROL';

export function HelpCenter() {
  const role = useActiveRole();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('FLUJO');
  const [hovered, setHovered] = useState<RoleKey | null>(null);
  const home = ROLE_HOME[role];
  const buttons = buttonsForRole(role);

  // Auto-open once (help now lives alongside the tour).
  useEffect(() => {
    const seen = window.localStorage.getItem(SEEN_KEY);
    window.setTimeout(() => { if (seen !== role) { setTab('FLUJO'); setOpen(true); } }, 0);
  }, [role]);

  useEffect(() => {
    const reopen = (event: Event) => {
      const wanted = (event as CustomEvent<string>).detail;
      setTab(wanted === 'ROL' || wanted === 'BOTONES' ? wanted : 'FLUJO');
      setOpen(true);
    };
    window.addEventListener('rr-hub-open-help', reopen);
    return () => window.removeEventListener('rr-hub-open-help', reopen);
  }, []);

  const close = () => { window.localStorage.setItem(SEEN_KEY, role); setOpen(false); };

  const pickRole = (next: RoleKey) => {
    setStoredRole(next);
    setOpen(false);
  };

  if (!open) return null;

  const sections: Record<Tab, string> = { FLUJO: 'Cómo viaja una pieza', BOTONES: 'Qué hace cada botón', ROL: 'Elige cómo ver el trabajo' };

  return <div className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Centro de ayuda">
    <button aria-label="Cerrar ayuda" onClick={close} className="absolute inset-0 bg-negro/85 backdrop-blur-sm" />
    <div className="relative flex max-h-[92vh] w-full max-w-3xl flex-col border-2 border-mostaza bg-negro shadow-brutal-lg anim-pop">
      {/* Cabecera */}
      <header className="flex items-center justify-between gap-3 border-b-2 border-blanco-10 px-5 py-4 sm:px-7">
        <div>
          <p className="eyebrow">[CENTRO DE AYUDA · {ROLE_LABEL[role]}]</p>
          <h2 className="font-display text-2xl font-bold text-blanco sm:text-3xl">¿CÓMO FUNCIONA?</h2>
        </div>
        <button onClick={close} className="btn-brutal shrink-0">CERRAR ×</button>
      </header>

      {/* Pestañas */}
      <nav className="grid grid-cols-3 border-b-2 border-blanco-10" aria-label="Secciones de ayuda">
        {(['FLUJO', 'BOTONES', 'ROL'] as Tab[]).map((item) => <button key={item} onClick={() => setTab(item)} className={`px-3 py-4 font-mono text-[10px] tracking-wide transition-colors sm:text-xs ${tab === item ? 'border-b-2 border-mostaza bg-mostaza/10 text-mostaza' : 'text-blanco-40 hover:text-blanco'}`}>{item}</button>)}
      </nav>

      <div className="overflow-y-auto p-5 sm:p-7">
        <p className="mb-6 font-mono text-[11px] leading-5 text-blanco-40">{sections[tab]} · estás viendo esto como {ROLE_LABEL[role]}</p>

        {/* ── PESTAÑA FLUJO ─────────────────────────────────────────── */}
        {tab === 'FLUJO' && <div className="space-y-6">
          <div className="border-l-4 border-mostaza bg-blanco-05 p-5">
            <p className="eyebrow">TU MISIÓN</p>
            <p className="mt-3 font-display text-xl font-bold text-blanco">{home.headline}</p>
            <p className="mt-2 text-sm leading-7 text-blanco-60">{home.explanation}</p>
          </div>
          <ol className="space-y-3">
            {PHASES.map((phase, index) => <li key={phase.key} className="flex gap-4 border-2 border-blanco-10 bg-negro p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center border-2 border-mostaza font-display text-lg font-bold text-mostaza">{index + 1}</span>
              <div>
                <p className="font-display text-lg font-bold text-blanco">{phase.label}</p>
                <p className="mt-1 text-sm leading-6 text-blanco-60">{phase.detail}</p>
                <p className="mt-1 font-mono text-[10px] text-blanco-40">Estados: {phase.statuses.join(' · ')}</p>
              </div>
            </li>)}
          </ol>
          <p className="border-t border-blanco-10 pt-4 font-mono text-[11px] leading-6 text-blanco-40">Una pieza avanza de izquierda a derecha. El color de cada tarjeta te dice quién tiene la pelota: <span className="text-mostaza">mostaza = cliente</span>, <span className="text-fucsia">fucsia = producción</span>, <span className="text-orquidea">orquídea = revisión</span>.</p>
        </div>}

        {/* ── PESTAÑA BOTONES ───────────────────────────────────────── */}
        {tab === 'BOTONES' && <div className="space-y-4">
          {(['FLUJO', 'ACCIONES DE FICHA', 'NAVEGACIÓN'] as ButtonHelp['section'][]).map((section) => {
            const list = buttons.filter((button) => button.section === section);
            if (!list.length) return null;
            return <div key={section}>
              <p className="eyebrow mb-3">[{section}]</p>
              <div className="space-y-3">
                {list.map((button) => <article key={button.label} className="border-2 border-blanco-10 bg-blanco-05 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="font-display text-base font-bold text-blanco sm:text-lg">{button.label}</h3>
                    <span className="font-mono text-[9px] text-blanco-40">{button.where}</span>
                  </div>
                  <dl className="mt-3 space-y-2 text-sm leading-6">
                    <div className="flex gap-2"><dt className="shrink-0 font-mono text-[10px] font-bold text-mostaza">QUÉ HACE:</dt><dd className="text-blanco-60">{button.what}</dd></div>
                    <div className="flex gap-2"><dt className="shrink-0 font-mono text-[10px] font-bold text-fucsia">CUÁNDO:</dt><dd className="text-blanco-60">{button.when}</dd></div>
                    <div className="flex gap-2"><dt className="shrink-0 font-mono text-[10px] font-bold text-orquidea">DESPUÉS:</dt><dd className="text-blanco-60">{button.after}</dd></div>
                  </dl>
                </article>)}
              </div>
            </div>;
          })}
        </div>}

        {/* ── PESTAÑA ROL ───────────────────────────────────────────── */}
        {tab === 'ROL' && <div>
          <p className="mb-4 text-sm leading-7 text-blanco-60">Toda la plataforma se reconfigura según el rol que elijas. Cambia en cualquier momento para ver el trabajo como otro miembro.</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ALL_ROLES.map((item) => {
              const active = item.key === role;
              const isHover = hovered === item.key;
              return <button key={item.key} onClick={() => pickRole(item.key)} onMouseEnter={() => setHovered(item.key)} onMouseLeave={() => setHovered(null)} className={`group border-2 p-4 text-left transition-all duration-200 ${active ? 'border-mostaza bg-mostaza/10' : 'border-blanco-20 hover:-translate-y-1 hover:border-mostaza'} ${isHover && !active ? 'bg-blanco-05' : ''}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className={`font-display text-lg font-bold ${active ? 'text-mostaza' : 'text-blanco group-hover:text-mostaza'}`}>{ROLE_LABEL[item.key]}</span>
                  {active && <span className="h-2.5 w-2.5 shrink-0 animate-pulse bg-mostaza" aria-label="Rol activo" />}
                </div>
                <p className="mt-2 text-xs leading-5 text-blanco-60">{item.blurb}</p>
                <span className={`mt-3 block font-mono text-[10px] ${active ? 'text-mostaza' : 'text-fucsia'}`}>{active ? '● ESTÁS AQUÍ' : 'USAR ESTE ROL →'}</span>
              </button>;
            })}
          </div>
        </div>}
      </div>
    </div>
  </div>;
}
