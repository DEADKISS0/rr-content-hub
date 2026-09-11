import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAuditIdeas, getAuditProject } from '@/lib/data';
import { PHASES, STATUS_META, statusMeta, phaseIndex, productionStep, type WorkflowStatus } from '@/lib/flow';
import { StatusBadge } from '@/components/status-badge';
import { ProductionPipeline } from '@/components/production-pipeline';

export const dynamic = 'force-dynamic';

export default async function AuditOverview({ params }: { params: Promise<{ projectSlug: string }> }) {
  const { projectSlug } = await params;
  const project = await getAuditProject(projectSlug);

  if (!project) notFound();

  const ideas = await getAuditIdeas(project.id as string);
  const counts = ideas.reduce<Record<string, number>>((acc, idea: any) => ({ ...acc, [idea.status]: (acc[idea.status] ?? 0) + 1 }), {});
  const total = ideas.length;
  const active = total - (counts.closed ?? 0);
  const phaseCount = (statuses: readonly string[]) => statuses.reduce((sum, status) => sum + (counts[status] ?? 0), 0);
  const sorted = [...ideas].sort((a: any, b: any) => phaseIndex(a.status as WorkflowStatus) - phaseIndex(b.status as WorkflowStatus));

  return <div className="mx-auto max-w-7xl px-5 py-10 md:px-10">
    <section className="mb-10 flex flex-wrap items-end justify-between gap-6 border-b border-blanco-10 pb-8">
      <div>
        <p className="eyebrow">[AUDIT_MODE] · {project.client_name as string}</p>
        <h1 className="display-title">{project.name as string}<br/><em>PANORAMA.</em></h1>
        <p className="mt-5 max-w-2xl text-sm leading-7 text-blanco-60">{(project.description as string) ?? 'Vista pública del flujo completo de contenido.'}</p>
      </div>
      <div className="flex gap-8">
        <div><p className="font-display text-5xl font-bold text-mostaza">{total}</p><p className="mt-2 font-mono text-[10px] text-blanco-60">IDEAS TOTALES</p></div>
        <div><p className="font-display text-5xl font-bold text-fucsia">{active}</p><p className="mt-2 font-mono text-[10px] text-blanco-60">EN CURSO</p></div>
      </div>
    </section>

    <section aria-label="Fases del flujo" className="mb-12">
      <p className="eyebrow mb-5">[FLUJO EN CINCO FASES]</p>
      <ol className="grid gap-px border-2 border-blanco bg-blanco sm:grid-cols-2 lg:grid-cols-5">
        {PHASES.map((phase, index) => <li key={phase.key} className="bg-negro p-5">
          <div className="flex items-center justify-between"><span className="mono-label text-mostaza">{String(index + 1).padStart(2, '0')} · {phase.label}</span><span className="font-display text-3xl font-bold text-blanco">{phaseCount(phase.statuses)}</span></div>
          <p className="mt-3 text-xs leading-5 text-blanco-60">{phase.detail}</p>
        </li>)}
      </ol>
    </section>

    <section className="mb-12 grid gap-px border-2 border-blanco-20 bg-blanco-10 sm:grid-cols-2 lg:grid-cols-4">
      {[['POR DECIDIR', ['pending_approval', 'needs_changes', 'pending_script_review', 'ready_to_publish']], ['EN EJECUCIÓN', ['script_in_progress', 'script_approved', 'in_production', 'raw_uploaded', 'editing']], ['APROBADAS', ['approved', 'script_approved']], ['PUBLICADAS', ['published', 'closed']]].map(([label, statuses]) => <div key={label as string} className="bg-negro p-5"><p className="font-display text-4xl font-bold text-blanco">{phaseCount(statuses as string[])}</p><p className="mt-2 font-mono text-[10px] text-blanco-60">{label as string}</p></div>)}
    </section>

    <section className="mb-12">
      <p className="eyebrow mb-4">[DISTRIBUCIÓN POR ESTADO]</p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(STATUS_META).map(([status, meta]) => {
          const value = counts[status] ?? 0;
          if (!value) return null;
          return <div key={status} className="flex items-center justify-between border border-blanco-20 px-4 py-3"><StatusBadge status={status} /><span className="font-display text-xl font-bold text-mostaza">{value}</span></div>;
        })}
        {total === 0 && <p className="font-mono text-xs text-blanco-40">SIN IDEAS REGISTRADAS.</p>}
      </div>
    </section>

    <section>
      <div className="mb-5 flex items-end justify-between border-b border-blanco-10 pb-3">
        <div><p className="eyebrow">[BANCO COMPLETO · READ ONLY]</p><h2 className="section-heading mt-2">TODAS LAS PIEZAS.</h2></div>
        <span className="font-mono text-[10px] text-blanco-40">{sorted.length} REGISTROS</span>
      </div>
      <div className="stagger grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sorted.map((idea: any) => <Link key={idea.id} href={`/audit/${projectSlug}/ideas/${idea.id}`} className="brutal-panel group">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3"><span className="mono-label text-mostaza">[{idea.code} · {idea.content_type === 'organic' ? 'ORGÁNICO' : 'PAUTA'}]</span><StatusBadge status={idea.status} showStep /></div>
          <h3 className="font-display text-2xl font-bold text-blanco group-hover:text-fucsia">{idea.title}</h3>
          <p className="mt-3 line-clamp-3 text-sm leading-6 text-blanco-60">{idea.description}</p>
          {productionStep(idea.status as WorkflowStatus) >= 0 && <div className="mt-5"><ProductionPipeline status={idea.status} compact /></div>}
          <div className="mt-6 border-t border-blanco-10 pt-4 font-mono text-[10px] text-blanco-40">{idea.category} <span className="float-right text-fucsia">VER FICHA →</span></div>
        </Link>)}
      </div>
    </section>
  </div>;
}
