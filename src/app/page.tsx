import Link from 'next/link';
import { getIdeas, getProjects } from '@/lib/data';
import { BOARD_COLUMNS, statusMeta, type WorkflowStatus } from '@/lib/flow';
import { Icon } from '@/components/ui/icons';

/** Resolves the first available project across both row shapes (join object or plain row). */
function firstProject(projects: any[]) {
  for (const row of projects) {
    const project = row?.projects ?? row;
    const slug = project?.slug ?? (Array.isArray(project) ? project[0]?.slug : null);
    if (slug) return { project, role: row?.role_in_project ?? 'owner' };
  }
  return null;
}

/**
 * Puerta de entrada del hub.
 *
 * Antes era un párrafo y un botón. Ahora dice qué es esto, cuánto trabajo hay
 * dentro ahora mismo (cifras reales de la base) y da las dos entradas que
 * existen: el tablero de trabajo y la vista de auditoría de solo lectura.
 */
export default async function Home() {
  const { projects } = await getProjects();
  const found = firstProject(projects);

  if (!found) {
    return <main className="grid min-h-screen place-items-center bg-negro px-5 py-20">
      <div className="w-full max-w-2xl border-2 border-mostaza p-10 anim-rise">
        <p className="eyebrow">[RR CONTENT HUB]</p>
        <h1 className="mt-4 font-display text-4xl font-bold text-blanco">SIN PROYECTOS DISPONIBLES.</h1>
        <p className="mt-5 text-sm leading-7 text-blanco-60">No hay proyectos que mostrar en este momento. Revisa la conexión con Supabase o pide al administrador que habilite un proyecto.</p>
        <Link href="/audit/wundeer" className="btn-brutal mt-8 inline-flex items-center gap-2">IR A AUDITORÍA <Icon name="arrow" size={14} /></Link>
      </div>
    </main>;
  }

  const project = found.project;
  const ideas = project.id ? await getIdeas(project.id) : [];
  const counts = BOARD_COLUMNS.map((column) => ({
    ...column,
    count: ideas.filter((idea) => (column.statuses as readonly string[]).includes(idea.status)).length,
  }));
  const waitingClient = ideas.filter((idea) => statusMeta(idea.status as WorkflowStatus).who.toUpperCase().includes('CLIENTE')).length;

  return <main className="min-h-screen bg-negro">
    <div className="mx-auto max-w-6xl px-5 py-16 md:px-10 md:py-24">
      <p className="eyebrow anim-rise">[RR CONTENT HUB · {project.client_name ?? 'RR ALIADOS'}]</p>
      <h1 className="display-title anim-rise mt-4" style={{ animationDelay: '80ms' }}>EL TRABAJO DE<br /><em className="text-mostaza">CONTENIDO, VISIBLE.</em></h1>
      <p className="mt-7 max-w-2xl text-base leading-8 text-blanco-60 anim-rise" style={{ animationDelay: '160ms' }}>
        Aquí vive cada pieza de contenido desde la idea hasta su publicación: quién la tiene, qué falta y qué sigue.
        Nada de hilos sueltos ni de preguntar &quot;¿en qué va eso?&quot;.
      </p>

      <section aria-label="Resumen de la operación" className="anim-rise mt-12 border-2 border-blanco" style={{ animationDelay: '240ms' }}>
        <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-blanco bg-fucsia/10 px-6 py-5">
          <div>
            <p className="mono-label text-mostaza">[PROYECTO ACTIVO · {(found.role ?? 'owner').toUpperCase()}]</p>
            <h2 className="mt-2 font-display text-4xl font-bold text-blanco md:text-5xl">{project.name}</h2>
            <p className="mt-2 font-mono text-[10px] text-blanco-60">
              {ideas.length} PIEZAS EN EL HUB{waitingClient ? ` · ${waitingClient} ESPERANDO AL CLIENTE` : ''}
            </p>
          </div>
          <Link href={`/${project.slug}`} className="btn-brutal inline-flex items-center gap-2">ABRIR EL MAPA <Icon name="arrow" size={14} /></Link>
        </div>
        <ol className="grid gap-px bg-blanco-20 sm:grid-cols-2 lg:grid-cols-4">
          {counts.map((column, index) => <li key={column.key} className="bg-negro p-5">
            <p className="mono-label text-blanco-50">{String(index + 1).padStart(2, '0')} · {column.label}</p>
            <p className="mt-3 font-display text-4xl font-bold text-blanco">{column.count}</p>
            <p className="mt-2 font-mono text-[10px] leading-5 text-blanco-60">{column.plain}</p>
            <span className="mt-4 block h-1 w-full bg-blanco-10">
              <span className="block h-1 bg-fucsia" style={{ width: ideas.length ? `max(6%, ${Math.round((column.count / ideas.length) * 100)}%)` : '0%' }} />
            </span>
          </li>)}
        </ol>
      </section>

      <div className="anim-rise mt-10 grid gap-px bg-blanco-20 sm:grid-cols-2" style={{ animationDelay: '320ms' }}>
        <Link href={`/${project.slug}`} className="group flex items-start gap-4 bg-negro p-6 transition-colors hover:bg-blanco-05">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center border-2 border-fucsia text-fucsia"><Icon name="map" size={18} /></span>
          <span>
            <strong className="block font-display text-xl font-bold text-blanco group-hover:text-fucsia">TABLERO DE TRABAJO</strong>
            <small className="mt-1 block font-mono text-[10px] leading-5 text-blanco-60">El flujo completo, la guía paso a paso y la siguiente acción de cada pieza.</small>
          </span>
        </Link>
        <Link href={`/audit/${project.slug}`} className="group flex items-start gap-4 bg-negro p-6 transition-colors hover:bg-blanco-05">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center border-2 border-mostaza text-mostaza"><Icon name="eye" size={18} /></span>
          <span>
            <strong className="block font-display text-xl font-bold text-blanco group-hover:text-mostaza">AUDITORÍA · SOLO LECTURA</strong>
            <small className="mt-1 block font-mono text-[10px] leading-5 text-blanco-60">Contadores por fase, estado y trazabilidad. Se ve todo, no se edita nada.</small>
          </span>
        </Link>
      </div>

      <p className="mt-10 font-mono text-[10px] leading-5 text-blanco-50">
        EL LINK DIRECTO TAMBIÉN FUNCIONA: CADA PROYECTO VIVE EN <span className="text-mostaza">/{project.slug}</span>
      </p>
    </div>
  </main>;
}
