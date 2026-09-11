import Link from 'next/link';
import { StatusBadge } from '@/components/status-badge';
import { RoleCommandCenter } from '@/components/role-command-center';
import { PHASES, ROLE_LABEL, statusMeta, type RoleKey, ROLE_HOME } from '@/lib/flow';

type Idea = { id: string; code?: string; title: string; description?: string; category?: string; content_type: string; status: string; creator?: string };
type Project = { name: string; client_name: string; description?: string; brand_primary_color?: string };

const PHASE_QUEUE: Record<string, string> = { idea: '/aprobaciones', script: '/aprobaciones', shoot: '/produccion', edit: '/produccion', live: '/publicaciones' };
const PENDING = ['pending_approval', 'needs_changes', 'pending_script_review', 'ready_to_publish'];

export function ProjectDashboard({ project, projectSlug, ideas, role }: { project: Project; projectSlug: string; ideas: Idea[]; role: string }) {
  const roleKey = (role in ROLE_HOME ? role : 'owner') as RoleKey;
  const home = ROLE_HOME[roleKey];
  const allIdeas = [...ideas].sort((a, b) => (a.code ?? '').localeCompare(b.code ?? '', undefined, { numeric: true }));
  const pending = allIdeas.filter((idea) => PENDING.includes(idea.status)).length;
  const phaseCount = (statuses: readonly string[]) => allIdeas.filter((idea) => (statuses as readonly string[]).includes(idea.status)).length;

  // Surface the pieces that actually need a hand, not just the newest six.
  const needsAction = allIdeas.filter((idea) => PENDING.includes(idea.status)).slice(0, 6);

  return <main className="min-h-screen bg-negro">
    <div className="mx-auto max-w-7xl px-5 py-10 md:px-10">
      <section className="mb-10 flex flex-wrap items-end justify-between gap-8 border-b border-blanco-10 pb-10 anim-rise">
        <div>
          <p className="eyebrow">[STATUS: ACTIVO · FASE IDEACIÓN] · {ROLE_LABEL[roleKey]}</p>
          <h1 className="display-title">{project.name}<br/><em>OPERACIÓN.</em></h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-blanco-60">{project.description ?? 'Cada idea conserva su referencia, decisión de cliente, responsable y estado de producción.'}</p>
        </div>
        <div className="flex flex-wrap gap-4">
          <Link href={`/${projectSlug}/ideas`} className="btn-brutal">VER BANCO →</Link>
          <Link href={`/${projectSlug}/ideas/nueva`} className="btn-brutal-mostaza">+ NUEVA IDEA</Link>
        </div>
      </section>

      <RoleCommandCenter projectSlug={projectSlug} ideas={allIdeas} defaultRole={roleKey} />

      <section aria-label="Flujo en fases" className="mb-10">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div><p className="eyebrow">[FLUJO EN CINCO FASES]</p><h2 className="section-heading mt-2">DÓNDE ESTÁ CADA PIEZA.</h2></div>
          <p className="font-mono text-[10px] text-blanco-40">TOCA UNA FASE PARA ABRIR SU COLA</p>
        </div>
        <div className="stagger grid gap-px border-2 border-blanco bg-blanco sm:grid-cols-2 lg:grid-cols-5">
          {PHASES.map((phase, index) => {
            const value = phaseCount(phase.statuses);
            return <Link key={phase.key} href={`/${projectSlug}${PHASE_QUEUE[phase.key]}`} className="group bg-negro p-5 transition-colors hover:bg-fucsia/10">
              <div className="flex items-center justify-between"><span className="mono-label text-mostaza">{String(index + 1).padStart(2, '0')} · {phase.label}</span><span className="font-display text-4xl font-bold text-blanco">{value}</span></div>
              <p className="mt-3 text-xs leading-5 text-blanco-60">{phase.detail}</p>
              <p className="mt-3 font-mono text-[10px] text-fucsia group-hover:text-mostaza">ABRIR →</p>
            </Link>;
          })}
        </div>
      </section>

      <section className="mb-12 grid gap-5 lg:grid-cols-[1.1fr_.9fr] anim-rise">
        <div className="border-2 border-blanco p-6">
          <p className="eyebrow">[TU SIGUIENTE PASO]</p>
          <h2 className="mt-3 font-display text-3xl font-bold text-blanco">{home.headline}</h2>
          <p className="mt-4 text-sm leading-6 text-blanco-60">{home.explanation}</p>
          <Link className="mt-6 inline-block font-mono text-xs text-mostaza underline" href={`/${projectSlug}${home.queue}`}>IR A MI COLA →</Link>
        </div>
        <div className={`border-2 p-6 ${pending ? 'border-mostaza bg-mostaza/5' : 'border-blanco-20'}`}>
          <p className="eyebrow">[QUÉ ESTÁ DETENIDO]</p>
          <h2 className="mt-3 font-display text-3xl font-bold text-blanco">{pending ? 'HAY DECISIONES ABIERTAS.' : 'NADA BLOQUEADO.'}</h2>
          <p className="mt-4 text-sm leading-6 text-blanco-60">{pending ? `${pending} pieza(s) esperan una respuesta (cliente, guion o revisión final).` : 'El flujo avanza sin bloqueos en este momento.'}</p>
          <Link className="mt-6 inline-block font-mono text-xs text-mostaza underline" href={`/${projectSlug}/aprobaciones`}>VER DECISIONES →</Link>
        </div>
      </section>

      {needsAction.length > 0 && <section className="mb-12">
        <div className="mb-5 flex items-end justify-between border-b border-mostaza pb-3">
          <div><p className="eyebrow">[REQUIERE ATENCIÓN]</p><h2 className="section-heading mt-2">ESPERANDO RESPUESTA.</h2></div>
          <Link className="mono-label text-mostaza" href={`/${projectSlug}/aprobaciones`}>VER TODAS →</Link>
        </div>
        <div className="stagger grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {needsAction.map((idea) => {
            const meta = statusMeta(idea.status);
            return <Link key={idea.id} href={`/${projectSlug}/ideas/${idea.id}`} className="brutal-panel group">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><span className="mono-label text-mostaza">{idea.code ?? 'NUEVA'}</span><StatusBadge status={idea.status} /></div>
              <h3 className="font-display text-xl font-bold text-blanco group-hover:text-fucsia">{idea.title}</h3>
              <p className="mt-3 text-xs leading-5 text-blanco-60">{meta.blurb}</p>
              <p className="mt-5 border-t border-blanco-10 pt-3 font-mono text-[10px] text-mostaza">ACTÚA: {meta.who}</p>
            </Link>;
          })}
        </div>
      </section>}

      <section>
        <div className="mb-5 flex items-end justify-between border-b border-blanco-10 pb-3">
          <div><p className="eyebrow">[MOVIMIENTO RECIENTE]</p><h2 className="section-heading mt-2">IDEAS ACTIVAS</h2></div>
          <Link className="mono-label text-mostaza" href={`/${projectSlug}/ideas`}>VER BANCO →</Link>
        </div>
        <div className="stagger grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {allIdeas.slice(0, 6).map((idea) => <Link key={idea.id} href={`/${projectSlug}/ideas/${idea.id}`} className="brutal-panel group">
            <div className="mb-6 flex flex-wrap justify-between gap-3"><span className="mono-label text-mostaza">[{idea.code ?? 'NUEVA'} · {idea.content_type === 'organic' ? 'ORGÁNICO' : 'PAUTA'}]</span><StatusBadge status={idea.status} /></div>
            <h3 className="font-display text-2xl font-bold text-blanco group-hover:text-fucsia">{idea.title}</h3>
            <p className="mt-3 line-clamp-2 text-sm leading-6 text-blanco-60">{idea.description}</p>
            <p className="mt-8 font-mono text-[10px] text-blanco-40">// {idea.category ?? 'SIN CATEGORÍA'}</p>
          </Link>)}
        </div>
      </section>
    </div>
  </main>;
}
