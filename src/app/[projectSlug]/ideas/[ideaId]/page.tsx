import { notFound } from 'next/navigation';
import { getIdea, getProject, getProfileName, getVotos, getPresencia, getComentarios, getAssets, getTimeline } from '@/lib/data';
import { rolEnProyecto } from '@/lib/project-guard';
import { StatusBadge, STATUS_ICON } from '@/components/status-badge';
import { IdeaActions } from '@/components/idea-actions';
import { EnhancedIdeaCollaboration } from '@/components/collaboration-enhanced';
import { AssignOwner } from '@/components/assign-owner';
import { IdeaEditor } from '@/components/idea-editor';
import { IdeaVoting } from '@/components/idea-voting';
import { PanelPresencia } from '@/components/presencia-equipo';
import { ReferenceWithBrief } from '@/components/reference-with-brief';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { ProductionPipeline } from '@/components/production-pipeline';
import { ScriptEditor } from '@/components/script-editor';
import { Chip } from '@/components/ui/chips';
import { formatOf } from '@/components/ui/cover';
import { BriefRail, PhaseRail, briefState } from '@/components/ui/meter';
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
  // El rol lo resuelve el servidor contra `rr_hub_access`; el navegador solo lo
  // muestra. Sin esto, `IdeaActions` caía a su valor por defecto y ninguna ficha
  // ofrecía una transición real, ni con la puerta encendida.
  const { rol } = await rolEnProyecto(project.id);
  const idea: any = await getIdea(project.id, ideaId); if (!idea) notFound();

  // El conteo de votos se lee en el servidor, junto con la idea. Solo van los
  // NÚMEROS: el token del votante nunca sale del navegador que lo generó, así que
  // la página no puede exponer quién votó aunque quiera mostrarlo.
  const votos = await getVotos(ideaId);
  const presencia = await getPresencia();
  // Comentarios, archivos e historial llegan desde aqui, no desde el navegador:
  // el cliente anon ya no lee esas tablas y llegaban vacios sin dar error.
  const [comentarios, assets, timeline] = await Promise.all([
    getComentarios(ideaId), getAssets(ideaId), getTimeline(ideaId),
  ]);

  // El responsable se resuelve en el servidor y se pasa como NOMBRE, no como
  // id: el navegador no necesita saber el uuid de nadie, y `created_by` es la
  // única columna que lo guarda. Si no hay responsable, `null` — y el bloque lo
  // dice, en vez de inventar un nombre.
  const responsable = idea.created_by
    ? (await getProfileName(idea.created_by as string))
    : null;
  const raw = idea.reference_url ?? idea.ref ?? idea.reference_urls?.[0] ?? '';
  // La lista completa, no solo la primera: el editor tiene que ofrecer lo que hay
  // y poder quitarla. `reference_urls` es jsonb y siempre es una lista.
  const referencias: string[] = Array.isArray(idea.reference_urls)
    ? (idea.reference_urls as string[])
    : raw
      ? [raw]
      : [];
  const meta = statusMeta(idea.status);
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
    <header className="border-b border-blanco-20 px-5 py-4 md:px-10">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
        <Breadcrumbs items={[
          { label: project.name, href: `/${projectSlug}` },
          { label: 'BANCO', href: `/${projectSlug}/ideas` },
          { label: idea.code ?? 'IDEA' },
        ]} />
        <StatusBadge status={idea.status} showStep animate />
      </div>
    </header>

    <div className="mx-auto max-w-7xl px-4 pb-20 pt-8 sm:px-5 sm:pb-8 md:px-10 md:py-10">
      {/* `pb-20` en móvil: la barra de la guía es `fixed` de 48 px, y como tal
          acompaña todo el scroll — no solo el final. Reservar el hueco al final
          de la página no servía: seguía pisando el brief a media ficha.
          El margen va en el contenedor del contenido, que es lo que se
          desplaza. Con `pb-16` quedaban 24 px de texto bajo la barra; `pb-20`
          (80 px) deja el final holgado. En escritorio el botón es una esquina y
          `sm:pb-8` basta. */}
      {/*
        La acción va PRIMERO, antes del título y antes de la referencia. Medido el
        2026-09-28: pegada al bloque de estado caía en y=795 con el pliegue en
        720 — 75 px por debajo, invisible. Y al ponerla en la columna derecha
        tampoco cabía.

        El orden que funciona es: acción, título, estado, referencia. Es lo que
        corresponde a la pregunta que trae a alguien aquí: "¿qué hago?".
      */}
      <div data-guia="accion" className="brutal-panel anim-rise mb-7">
        <p className="eyebrow">[TU SIGUIENTE ACCIÓN]</p>
        <h2 className="mt-3 font-display text-2xl font-bold text-blanco">Qué hacer ahora.</h2>
        <div className="mt-5"><IdeaActions projectSlug={projectSlug} ideaId={ideaId} currentStatus={idea.status} role={rol} /></div>
        {/* La votación va pegada a la acción porque en `voting` ES la acción:
            quien entra a mirar la idea viene a decidir, no a leer. */}
        <div className="mt-5">
          <IdeaVoting ideaId={ideaId} status={idea.status} inicial={{ aFavor: votos.aFavor, enContra: votos.enContra }} />
        </div>
        {/* Quién está en línea, pegado a la votación: es la pregunta que se hace
            justo antes de votar ("¿a quién le pregunto?"). */}
        <div className="mt-4">
          <PanelPresencia equipo={presencia} />
        </div>
      </div>

      <div className="mb-8 border-b border-blanco-10 pb-8 anim-rise">
        <div>
          <p className="eyebrow">{idea.code ?? 'IDEA'} · {idea.content_type === 'organic' ? 'ORGÁNICO' : 'PAUTA'} · {idea.category}</p>
          <h1 className="display-title max-w-5xl">{idea.title}</h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-blanco-60 sm:text-lg sm:leading-8">{idea.description}</p>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Chip icon={format.icon as IconName} tone="blanco">{format.label}</Chip>
            <Chip icon="pieces" tone="neutro">{idea.category ?? 'SIN CATEGORÍA'}</Chip>
            {days !== null && <Chip icon="clock" tone="neutro">{days === 0 ? 'HOY' : `${days} DÍAS SIN MOVERSE`}</Chip>}
            {missing.length
              ? <Chip icon="alert" tone="neutro">{missing.length} DATOS POR COMPLETAR</Chip>
              : <Chip icon="check" tone="neutro">FICHA COMPLETA</Chip>}
          </div>

          <div data-guia="estado" className="mt-7 border-l-4 border-blanco-40 bg-blanco-05 px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center border border-blanco-30 text-blanco">
                <Icon name={STATUS_ICON[idea.status as WorkflowStatus] ?? 'flag'} size={16} />
              </span>
              <div>
                <p className="font-display text-xl font-bold text-blanco">{meta.label}</p>
                <p className="mt-1 text-xs leading-5 text-blanco-60">{meta.blurb}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <PhaseRail status={idea.status} />
              {idea.status !== 'closed' && <span className="font-mono text-[10px] text-blanco-50">AHORA ACTÚA: {meta.who}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* La referencia va a ancho completo, justo debajo del título y el estado.
          Estaba al final de la ficha, después de la trazabilidad: al abrir una
          pieza había que bajar dos pantallas para ver qué se estaba tomando como
          referencia.

          Sacarla de la rejilla de dos columnas también la arregló de paso: con
          media pantalla de ancho el brief se leía en una tira de 40 caracteres y
          el bloque medía 2493 px de alto. A ancho completo son dos columnas
          legibles. */}
      <section className="mb-8 anim-rise">
        <div data-guia="brief">
          <ReferenceWithBrief url={raw} title={idea.title} brief={{ intention: idea.objective, camera: idea.camera, talent: idea.talent, edit: idea.edit }} />
        </div>
      </section>

      {/* El editor va pegado a la referencia, no escondido en un menú. Si lo que
          falta es el link, el botón tiene que estar donde se ve que falta. */}
      <div className="mb-8">
        <IdeaEditor
          ideaId={ideaId}
          role={rol}
          initial={{
            title: idea.title,
            description: idea.description,
            objective: idea.objective,
            camera: idea.camera,
            talent: idea.talent,
            edit: idea.edit,
            references: referencias,
          }}
        />
      </div>

      {inProduction && <section className="mb-8 anim-rise">
        <p className="eyebrow mb-3">[PIPELINE DE PRODUCCIÓN]</p>
        <ProductionPipeline status={idea.status} />
      </section>}

      <div className="grid gap-6 lg:grid-cols-[1.25fr_.75fr]">
        <section className="space-y-5">
          {idea.script_content && <ScriptEditor ideaId={ideaId} initialScript={idea.script_content} />}
          <div data-guia="comentarios">
            <EnhancedIdeaCollaboration
              projectSlug={projectSlug}
              ideaId={ideaId}
              comentariosIniciales={comentarios}
              assetsIniciales={assets}
              timelineInicial={timeline}
            />
          </div>
        </section>

        <aside className="space-y-5">
          {/* Quién responde por esta pieza. En modo abierto todo cambio queda
              como "sin sesión": honesto, pero deja la pieza sin dueño. */}
          <AssignOwner
            ideaId={ideaId}
            projectSlug={projectSlug}
            currentName={responsable?.full_name ?? null}
            canAssign={rol === 'owner'}
          />
          <div className="border border-blanco-20 p-5 anim-rise">
            <p className="mono-label text-blanco-50">// LO QUE FALTA DE ESTA FICHA</p>
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

      {/* La barra de la guía ya tiene su sitio reservado con `pb-16` del
          contenedor de arriba, que es el que se desplaza. Este div sobra. */}
    </div>
  </main>;
}

