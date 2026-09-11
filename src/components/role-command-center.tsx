'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { PHASES, ROLE_HOME, ROLE_LABEL, type RoleKey } from '@/lib/flow';

type Idea = { status: string };

const PENDING = ['pending_approval', 'needs_changes', 'pending_script_review', 'ready_to_publish'];
const EXECUTING = ['approved', 'script_in_progress', 'script_approved', 'in_production', 'raw_uploaded', 'editing'];

/**
 * Real-role command center. No role simulator: the role arrives from the
 * signed-in profile, so the panel shows the person their own queue only.
 */
export function RoleCommandCenter({ projectSlug, ideas, defaultRole }: { projectSlug: string; ideas: Idea[]; defaultRole: string }) {
  const role = (defaultRole in ROLE_HOME ? defaultRole : 'owner') as RoleKey;
  const home = ROLE_HOME[role];
  const isOwner = role === 'owner';
  const isClient = role === 'client_approver' || role === 'client_viewer';

  const pending = useMemo(() => ideas.filter((idea) => PENDING.includes(idea.status)).length, [ideas]);
  const executing = useMemo(() => ideas.filter((idea) => EXECUTING.includes(idea.status)).length, [ideas]);
  const published = useMemo(() => ideas.filter((idea) => ['published', 'closed'].includes(idea.status)).length, [ideas]);
  const phaseCounts = useMemo(() => PHASES.map((phase) => ({ ...phase, value: ideas.filter((idea) => (phase.statuses as readonly string[]).includes(idea.status)).length })), [ideas]);

  return <section className="mb-12 border-2 border-blanco p-6 sm:p-8" aria-labelledby="role-command-title">
    <div className="max-w-2xl">
      <p className="eyebrow">[TU VISTA DE TRABAJO · {ROLE_LABEL[role]}]</p>
      <h2 id="role-command-title" className="mt-3 font-display text-3xl font-bold text-blanco sm:text-4xl">UNA SOLA OPERACIÓN.<br/><span className="text-mostaza">UN RELEVO A LA VEZ.</span></h2>
      <p className="mt-4 text-sm leading-7 text-blanco-60">{home.explanation}</p>
    </div>

    {isOwner ? <div className="mt-8 grid gap-3 border-t border-blanco-20 pt-6 md:grid-cols-3">
      <AdminCard count={pending} label="DECISIONES ABIERTAS" detail="Cliente, guion o revisión final" href={`/${projectSlug}/aprobaciones`}/>
      <AdminCard count={executing} label="PIEZAS EN EJECUCIÓN" detail="Guion, rodaje, crudo o edición" href={`/${projectSlug}/produccion`}/>
      <AdminCard count={published} label="SALIDAS REGISTRADAS" detail="Listas para medir y cerrar" href={`/${projectSlug}/publicaciones`}/>
    </div> : isClient ? <div className="mt-8 grid gap-3 border-t border-blanco-20 pt-6 md:grid-cols-3">
      <AdminCard count={pending} label="ESPERAN TU DECISIÓN" detail="Aprueba o pide ajustes" href={`/${projectSlug}/aprobaciones`}/>
      <AdminCard count={executing} label="EN PRODUCCIÓN" detail="Ya aprobaste, se está ejecutando" href={`/${projectSlug}/produccion`}/>
      <AdminCard count={published} label="PUBLICADAS" detail="Salidas registradas" href={`/${projectSlug}/publicaciones`}/>
    </div> : <div className="mt-8 border-t border-blanco-20 pt-6">
      <div className="grid gap-5 lg:grid-cols-[auto_1fr_auto] lg:items-center">
        <div className="font-display text-6xl font-bold text-mostaza">{pending}</div>
        <div>
          <p className="mono-label text-mostaza">[TU COLA · {ROLE_LABEL[role]}]</p>
          <h3 className="mt-2 font-display text-2xl font-bold text-blanco">{pending ? `TIENES ${pending} PIEZA${pending === 1 ? '' : 'S'} EN JUEGO.` : 'NO HAY RELEVOS PENDIENTES.'}</h3>
          <p className="mt-2 max-w-xl text-sm leading-6 text-blanco-60">Tu trabajo se concentra en tu fase. Abre una pieza y verás solo los botones que te corresponden.</p>
        </div>
        <Link href={`/${projectSlug}${home.queue}`} className="btn-brutal-mostaza text-center">IR A MI COLA →</Link>
      </div>
      <div className="mt-6 grid gap-px border-2 border-blanco-20 bg-blanco-20 sm:grid-cols-5">
        {phaseCounts.map((phase) => <div key={phase.key} className="bg-negro p-3"><p className="font-mono text-[10px] text-blanco-60">{phase.label}</p><p className="mt-1 font-display text-2xl font-bold text-blanco">{phase.value}</p></div>)}
      </div>
    </div>}
  </section>;
}

function AdminCard({ count, label, detail, href }: { count: number; label: string; detail: string; href: string }) {
  return <Link href={href} className="group border border-blanco-20 bg-blanco-05 p-5 hover:border-fucsia">
    <p className="font-display text-5xl font-bold text-mostaza">{count}</p>
    <p className="mt-3 font-mono text-[10px] text-blanco">{label} <span className="text-fucsia group-hover:text-mostaza">↗</span></p>
    <p className="mt-2 text-xs leading-5 text-blanco-60">{detail}</p>
  </Link>;
}
