import { notFound } from 'next/navigation';
import { getIdea, getProject } from '@/lib/data';
import { StatusBadge, STATUS_ICON } from '@/components/status-badge';
import { IdeaActions } from '@/components/idea-actions';
import { EnhancedIdeaCollaboration } from '@/components/collaboration-enhanced';
import { ReferenceWithBrief } from '@/components/reference-with-brief';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { ProductionPipeline } from '@/components/production-pipeline';
import { ScriptEditor } from '@/components/script-editor';
import { Chip } from '@/components/ui/chips';
import { formatOf } from '@/components/ui/cover';
import { BriefRail, PhaseRail, briefState } from '@/components/ui/meter';
import { PublicationPreview } from '@/components/ui/preview';
import { Icon, type IconName } from '@/components/ui/icons';
import { statusMeta, productionStep, daysSince, type WorkflowStatus } from '@/lib/flow';

/**
 * Ficha de una pieza.
 *
 * Lo que cambió: arriba se ve la pieza como se verá publicada (preview real de
 * la referencia) junto al estado y su riel de fases, y al lado derecho aparece
 * "lo que falta" — los cinco datos que la vuelven enviable al cliente. Antes el
 * estado era un bloque de color y había que adivinar en qué punto del camino
 * estaba la pieza.
 */
export default async function IdeaDetail({ params }: { params: Promise<{ projectSlug: string; ideaId: string }> }) {
  const { projectSlug, ideaId } = await params;
  const { project } = await getProject(projectSlug); if (!project) notFound();
  const idea: any = await getIdea(project.id, ideaId); if (!idea) notFound();
  const raw = idea.reference_url ?? idea.reference_urls?.[0] ?? idea.ref ?? '';
  const meta = statusMeta(idea.status);
  const tone = meta.tone === 'mostaza' ? 'border-mostaza' : meta.tone === 'fucsia' ? 'border-fucsia' : meta.tone === 'orquidea' ? 'border-orquidea' : 'border-blanco-20';
  const inProduction = productionStep(idea.status) >= 0;
  const format = formatOf(idea.category, idea.content_type);
  const states = briefState({
    camera_brief: idea.camera,
    talent_brief: idea.talent,
    edit_brief: idea.edit,
    script_content: idea.script_content,
    reference_urls: raw ? [raw] : [],
  });
  const missing = states.filter((state) => !state.done);
  const days = daysSince(idea.updated_at ?? idea.created_at);

  return <main className="min-h-screen bg-negro">
    <header className="border-b-2 border-blanco px-5 py-4 md:px-10">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
        <Breadcrumbs items={[
          { label: project.name, href: `/${projectSlug}` },
          { label: 'BANCO', href: `/${projectSlug}/ideas` },
          { label: idea.code ?? 'IDEA' },
        ]} />
        <StatusBadge status={idea.status} showStep animate />
      </div>
    </header>

    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-5 md:px-10 md:py-10">
      <div className="mb-8 grid gap-8 border-b border-blanco-10 pb-8 anim-rise lg:grid-cols-[1.35fr_1fr]">
        <div>
          <p className="eyebrow">{idea.code ?? 'IDEA'} · {idea.content_type === 'organic' ? 'ORGÁNICO' : 'PAUTA'} · {idea.category}</p>
          <h1 className="display-title max-w-5xl">{idea.title}</h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-blanco-60 sm:text-lg sm:leading-8">{idea.description}</p>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Chip icon={format.icon as IconName} tone="blanco">{format.label}</Chip>
            <Chip icon="pieces" tone="neutro">{idea.category ?? 'SIN CATEGORÍA'}</Chip>
            {days !== null && <Chip icon="clock" tone={days > 10 ? 'mostaza' : 'neutro'}>{days === 0 ? 'HOY' : `${days} DÍAS SIN MOVERSE`}</Chip>}
            {missing.length
              ? <Chip icon="alert" tone="fucsia">{missing.length} DATOS POR COMPLETAR</Chip>
              : <Chip icon="check" tone="fucsia">FICHA COMPLETA</Chip>}
          </div>

          <div className={`mt-7 border-l-4 ${tone} bg-blanco-05 px-5 py-4`}>
            <div className="flex items-center gap-3">
              <span className={`flex h-9 w-9 items-center justify-center border-2 ${tone} ${meta.tone === 'mostaza' ? 'text-mostaza' : meta.tone === 'fucsia' ? 'text-fucsia' : meta.tone === 'orquidea' ? 'text-orquidea' : 'text-blanco'}`}>
                <Icon name={STATUS_ICON[idea.status as WorkflowStatus] ?? 'flag'} size={16} />
              </span>
              <div>
                <p className="font-display text-xl font-bold text-blanco">{meta.label}</p>
                <p className="mt-1 text-xs leading-5 text-blanco-60">{meta.blurb}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <PhaseRail status={idea.status} />
              {idea.status !== 'closed' && <span className="font-mono text-[10px] text-mostaza">AHORA ACTÚA: {meta.who}</span>}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <p className="mono-label mb-3 text-mostaza">// COMO SE VERÁ PUBLICADO</p>
            <PublicationPreview url={raw} code={idea.code} title={idea.title} format={format.icon as IconName} size="lg" />
            <p className="mt-3 font-mono text-[10px] text-blanco-60">
              {raw ? 'VISTA PREVIA DE LA REFERENCIA REAL' : 'SIN REFERENCIA TODAVÍA'}
            </p>
          </div>

          {/* La acción va aquí, en el primer pantallazo y al lado de la pieza.
              Antes vivía al final de la columna derecha, dos pantallas más abajo:
              la única acción de la ficha era lo último que se veía. */}
          <div className="brutal-panel anim-rise">
            <p className="eyebrow">[TU SIGUIENTE ACCIÓN]</p>
            <h2 className="mt-3 font-display text-2xl font-bold text-blanco">QUÉ HACER<br /><span className="text-mostaza">AHORA.</span></h2>
            <div className="mt-5"><IdeaActions projectSlug={projectSlug} ideaId={ideaId} currentStatus={idea.status} /></div>
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
          {idea.script_content && <ScriptEditor ideaId={ideaId} initialScript={idea.script_content} />}
          <EnhancedIdeaCollaboration projectSlug={projectSlug} ideaId={ideaId} />
        </section>

        <aside className="space-y-5">
          <div className="border-2 border-blanco-20 p-5 anim-rise">
            <p className="mono-label text-mostaza">// LO QUE FALTA DE ESTA FICHA</p>
            <p className="mt-3 font-mono text-[10px] leading-5 text-blanco-60">
              {missing.length
                ? `Faltan ${missing.length} de 5 datos. Sin ellos la pieza no está lista para ir al cliente.`
                : 'Los cinco datos están completos: la pieza puede circular sin preguntas.'}
            </p>
            <div className="mt-4"><BriefRail states={states} /></div>
            {missing.length > 0 && <ul className="mt-4 space-y-2">
              {missing.map((state) => <li key={state.key} className="flex items-center gap-2 font-mono text-[10px] text-blanco-60">
                <Icon name={state.icon as IconName} size={11} className="text-blanco-30" />
                FALTA {state.label}
              </li>)}
            </ul>}
          </div>
        </aside>
      </div>
    </div>
  </main>;
}

