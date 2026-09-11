import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getIdea, getProject } from '@/lib/data';
import { StatusBadge } from '@/components/status-badge';
import { IdeaActions } from '@/components/idea-actions';
import { IdeaCollaboration } from '@/components/idea-collaboration';
import { ReferenceWithBrief } from '@/components/reference-with-brief';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { ProductionPipeline } from '@/components/production-pipeline';
import { statusMeta, productionStep } from '@/lib/flow';

export default async function IdeaDetail({ params }: { params: Promise<{ projectSlug: string; ideaId: string }> }) {
  const { projectSlug, ideaId } = await params;
  const { project } = await getProject(projectSlug); if (!project) notFound();
  const idea: any = await getIdea(project.id, ideaId); if (!idea) notFound();
  const raw = idea.reference_url ?? idea.reference_urls?.[0] ?? idea.ref ?? '';
  const meta = statusMeta(idea.status);
  const inProduction = productionStep(idea.status) >= 0;

  return <main className="min-h-screen bg-negro">
    <header className="border-b-2 border-blanco px-5 py-4 md:px-10">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
        <Breadcrumbs items={[
          { label: project.name, href: `/${projectSlug}` },
          { label: 'BANCO', href: `/${projectSlug}/ideas` },
          { label: idea.code ?? 'IDEA' },
        ]} />
        <div className="flex items-center gap-4">
          <Image src="/brand/rr-symbol-fucsia-on-negro.png" alt="Símbolo RR Aliados" width={52} height={40} className="h-9 w-12 object-contain" />
          <StatusBadge status={idea.status} animate />
        </div>
      </div>
    </header>

    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-5 md:px-10 md:py-10">
      <div className="mb-8 border-b border-blanco-10 pb-8 anim-rise">
        <p className="eyebrow">{idea.code ?? 'IDEA'} · {idea.content_type === 'organic' ? 'ORGÁNICO' : 'PAUTA'} · {idea.category}</p>
        <h1 className="display-title max-w-5xl">{idea.title}</h1>
        <p className="mt-6 max-w-2xl text-base leading-7 text-blanco-60 sm:text-lg sm:leading-8">{idea.description}</p>

        <div className={`mt-7 flex flex-wrap items-center gap-4 border-l-4 ${meta.tone === 'mostaza' ? 'border-mostaza' : meta.tone === 'fucsia' ? 'border-fucsia' : meta.tone === 'orquidea' ? 'border-orquidea' : 'border-blanco-20'} bg-blanco-05 px-5 py-4`}>
          <span className="text-2xl" aria-hidden>{meta.icon}</span>
          <div>
            <p className="font-display text-xl font-bold text-blanco">{meta.label}</p>
            <p className="mt-1 text-sm leading-6 text-blanco-60">{meta.blurb} <span className="text-mostaza">Actúa: {meta.who}.</span></p>
          </div>
        </div>
      </div>

      {inProduction && <section className="mb-8 anim-rise">
        <p className="eyebrow mb-3">[PIPELINE DE PRODUCCIÓN]</p>
        <ProductionPipeline status={idea.status} />
      </section>}

      <div className="grid gap-6 lg:grid-cols-[1.25fr_.75fr]">
        <section className="space-y-5">
          <ReferenceWithBrief url={raw} title={idea.title} brief={{ intention: idea.objective, camera: idea.camera, talent: idea.talent, edit: idea.edit }} />
          {idea.script_content && <section className="border-2 border-mostaza bg-mostaza/5 p-5 sm:p-7 anim-rise">
            <p className="mono-label text-mostaza">[GUIÓN]</p>
            <h2 className="mt-3 font-display text-2xl font-bold text-blanco sm:text-3xl">EL PLAN DE LA PIEZA.</h2>
            <div className="mt-6 whitespace-pre-wrap border-l-4 border-mostaza bg-negro/40 p-5 text-sm leading-7 text-blanco-60">{idea.script_content}</div>
          </section>}
          <div className="grid gap-px border-2 border-blanco-20 bg-blanco-10 md:grid-cols-3">
            <Block title="CÁMARA">{idea.camera}</Block>
            <Block title="TALENTO">{idea.talent}</Block>
            <Block title="EDICIÓN">{idea.edit}</Block>
          </div>
          <IdeaCollaboration projectSlug={projectSlug} ideaId={ideaId} />
        </section>

        <aside className="space-y-5">
          <div className="brutal-panel anim-rise">
            <p className="eyebrow">[TU SIGUIENTE ACCIÓN]</p>
            <h2 className="mt-4 font-display text-3xl font-bold text-blanco">QUÉ HACER<br /><span className="text-mostaza">AHORA.</span></h2>
            <div className="mt-6"><IdeaActions projectSlug={projectSlug} ideaId={ideaId} currentStatus={idea.status} /></div>
          </div>
        </aside>
      </div>
    </div>
  </main>;
}

function Block({ title, children }: { title: string; children: React.ReactNode }) { return <div className="border border-blanco-10 bg-blanco-05 p-5"><p className="mono-label mb-3 text-mostaza">// {title}</p><div className="text-sm leading-6 text-blanco-60">{children}</div></div>; }
