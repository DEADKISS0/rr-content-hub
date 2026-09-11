import Link from 'next/link';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { getAuditAssets, getAuditComments, getAuditIdea, getAuditProject, getAuditTimeline } from '@/lib/data';
import { PHASES, STATUS_LABEL, allowedTransitions, phaseIndex, waitingOn, type WorkflowStatus } from '@/lib/flow';
import { ReferenceWithBrief } from '@/components/reference-with-brief';
import { StatusBadge } from '@/components/status-badge';
import { Breadcrumbs } from '@/components/breadcrumbs';

export const dynamic = 'force-dynamic';

const stageLabel: Record<string, string> = {
  reference_brief: 'REFERENCIA / BRIEF', script: 'GUIÓN', raw: 'CRUDO',
  edit_v1: 'EDICIÓN V1', edit_v2: 'EDICIÓN V2', edit_final: 'EDICIÓN FINAL', publication_evidence: 'EVIDENCIA',
};

export default async function AuditIdeaDetail({ params }: { params: Promise<{ projectSlug: string; ideaId: string }> }) {
  const { projectSlug, ideaId } = await params;
  const project = await getAuditProject(projectSlug);
  if (!project) notFound();
  const idea: any = await getAuditIdea(project.id as string, ideaId);
  if (!idea) notFound();

  const [timeline, comments, assets] = await Promise.all([
    getAuditTimeline(ideaId),
    getAuditComments(ideaId),
    getAuditAssets(ideaId),
  ]);

  const status = idea.status as WorkflowStatus;
  const currentPhase = phaseIndex(status);
  const raw = idea.reference_url ?? idea.reference_urls?.[0] ?? '';
  const nextMoves = allowedTransitions('owner', status);

  return <div className="mx-auto max-w-6xl px-4 py-8 sm:px-5 md:px-10 md:py-10">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-blanco-10 pb-5">
      <Breadcrumbs items={[{ label: 'AUDITORÍA', href: '/audit' }, { label: project.name as string, href: `/audit/${projectSlug}` }, { label: idea.code ?? 'IDEA' }]} />
      <div className="flex items-center gap-4">
        <Image src="/brand/rr-symbol-fucsia-on-negro.png" alt="Símbolo RR Aliados" width={52} height={40} className="h-9 w-12 object-contain"/>
        <StatusBadge status={status} animate />
      </div>
    </div>

    <section aria-label="Fase del flujo" className="mb-8">
      <ol className="grid gap-px border-2 border-blanco-20 bg-blanco-20 sm:grid-cols-5">
        {PHASES.map((phase, index) => <li key={phase.key} className={`p-3 ${index < currentPhase ? 'bg-mostaza/20' : index === currentPhase ? 'bg-fucsia/20' : 'bg-negro'}`}>
          <p className={`font-mono text-[10px] ${index === currentPhase ? 'text-fucsia' : 'text-blanco-60'}`}>{String(index + 1).padStart(2, '0')} {phase.label}</p>
        </li>)}
      </ol>
    </section>

    <header className="mb-8 border-b border-blanco-10 pb-8">
      <p className="eyebrow">{idea.code} · {idea.content_type === 'organic' ? 'ORGÁNICO' : 'PAUTA'} · {idea.category}</p>
      <h1 className="display-title max-w-5xl">{idea.title}</h1>
      <p className="mt-6 max-w-2xl text-base leading-7 text-blanco-60">{idea.description}</p>
    </header>

    <div className="grid gap-6 lg:grid-cols-[1.25fr_.75fr]">
      <section className="space-y-5">
        <ReferenceWithBrief url={raw} title={idea.title} brief={{ intention: idea.objective, camera: idea.camera, talent: idea.talent, edit: idea.edit }}/>
        <Block title="OBJETIVO">{idea.objective}</Block>
        <div className="grid gap-px border-2 border-blanco-20 bg-blanco-10 md:grid-cols-3">
          <Block title="CÁMARA">{idea.camera}</Block>
          <Block title="TALENTO">{idea.talent}</Block>
          <Block title="EDICIÓN">{idea.edit}</Block>
        </div>

        <section className="border-2 border-blanco bg-blanco-05 p-5">
          <p className="mono-label text-mostaza">HILO DE DECISIONES ({comments.length})</p>
          <div className="mt-4 space-y-3">
            {comments.map((comment: any) => <article key={comment.id} className={`border-l-2 p-3 ${comment.resolved ? 'border-blanco-20 opacity-60' : 'border-fucsia'}`}><div className="flex flex-wrap justify-between gap-2 font-mono text-[10px]"><span className="text-mostaza">{comment.author} · {comment.role}</span><span className="text-blanco-40">{comment.resolved ? 'RESUELTO' : 'ABIERTO'}</span></div><p className="mt-2 text-sm leading-6 text-blanco-60">{comment.body}</p></article>)}
            {comments.length === 0 && <p className="py-4 font-mono text-[10px] text-blanco-40">SIN COMENTARIOS REGISTRADOS.</p>}
          </div>
        </section>

        <section className="border-2 border-mostaza bg-mostaza/5 p-5">
          <p className="mono-label text-mostaza">HISTORIAL DE ENTREGAS ({assets.length})</p>
          <div className="mt-4 space-y-2">
            {assets.map((asset: any) => <div key={asset.id} className="flex items-center justify-between gap-3 border-b border-blanco-20 py-3 font-mono text-[10px]"><span className="truncate text-blanco-60">{asset.name}</span><span className="shrink-0 text-mostaza">{stageLabel[asset.stage] ?? asset.stage} · {asset.version}</span></div>)}
            {assets.length === 0 && <p className="py-4 font-mono text-[10px] text-blanco-40">SIN ARCHIVOS CARGADOS.</p>}
          </div>
        </section>
      </section>

      <aside className="space-y-5">
        <div className="brutal-panel">
          <p className="eyebrow">[QUIÉN ACTÚA AHORA]</p>
          <h2 className="mt-3 font-display text-2xl font-bold text-blanco">ESPERANDO A<br/><span className="text-mostaza">{waitingOn(status).toUpperCase()}</span></h2>
          {nextMoves.length > 0 && <div className="mt-5 border-t border-blanco-20 pt-4"><p className="mono-label text-blanco-40">SIGUIENTES PASOS POSIBLES</p><ul className="mt-3 space-y-2">{nextMoves.map((move) => <li key={move.to} className="font-mono text-[10px] text-blanco-60">→ {move.label}</li>)}</ul></div>}
        </div>

        <div className="brutal-panel">
          <p className="eyebrow">[TRAZABILIDAD]</p>
          <p className="mt-2 font-mono text-[10px] text-blanco-40">{timeline.length} EVENTOS REGISTRADOS</p>
          <ol className="mt-4 space-y-3">
            {timeline.map((event: any) => <li key={event.id} className="border-l border-fucsia pl-3"><p className="font-mono text-[10px] text-mostaza">{new Intl.DateTimeFormat('es-CO', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(event.createdAt))} · {event.actor}</p><p className="mt-1 font-mono text-[10px] text-blanco">[{STATUS_LABEL[event.status as WorkflowStatus] ?? event.status}]</p>{event.note && <p className="mt-1 text-xs leading-5 text-blanco-60">{event.note}</p>}</li>)}
            {timeline.length === 0 && <li className="font-mono text-[10px] text-blanco-40">SIN EVENTOS REGISTRADOS TODAVÍA.</li>}
          </ol>
        </div>
      </aside>
    </div>
  </div>;
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="border border-blanco-10 bg-blanco-05 p-5"><p className="mono-label mb-3 text-mostaza">// {title}</p><div className="text-sm leading-6 text-blanco-60">{children}</div></div>;
}
