import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getIdeas, getProjects, getClientesDeLaPersona } from '@/lib/data';
import { statusMeta, type WorkflowStatus } from '@/lib/flow';
import { BOARD_COLUMNS } from '@/lib/queues';
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

  // Sin sesión no se puede saber nada del hub: los proyectos existen, pero
  // `rr_hub_projects` está detrás del RLS y la anon no lee.
  //
  // ⚠️ Lo que fallaba el 2026-09-29 y no debe volver: esta página pedía los
  // proyectos ANTES de mirar si había cookie, así que sin sesión salía un cartel
  // de "Sin proyectos disponibles" que además culpaba a Supabase. Era mentira en
  // dos partes: los proyectos sí existen, y la causa no era la conexión. Ahora
  // lo primero es la sesión; sin ella, al login.
  if (!found) {
    const sesion = await getClientesDeLaPersona();
    if (sesion.abiertos.length === 0) redirect('/login');
    redirect(`/${sesion.actual ?? sesion.abiertos[0].slug}`);
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
      <h1 className="display-title anim-rise mt-4" style={{ animationDelay: '80ms' }}>El trabajo de contenido, visible.</h1>
      <p className="mt-7 max-w-2xl text-base leading-8 text-blanco-60 anim-rise" style={{ animationDelay: '160ms' }}>
        Aquí vive cada pieza de contenido desde la idea hasta su publicación: quién la tiene, qué falta y qué sigue.
        Nada de hilos sueltos ni de preguntar &quot;¿en qué va eso?&quot;.
      </p>

      <section aria-label="Resumen de la operación" className="anim-rise mt-12 border border-blanco-20" style={{ animationDelay: '240ms' }}>
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-blanco-10 bg-blanco-05 px-6 py-5">
          <div>
            <p className="mono-label text-blanco-50">[PROYECTO ACTIVO · {(found.role ?? 'owner').toUpperCase()}]</p>
            <h2 className="mt-2 font-display text-4xl font-bold text-blanco md:text-5xl">{project.name}</h2>
            <p className="mt-2 font-mono text-[10px] text-blanco-60">
              {ideas.length} PIEZAS EN EL HUB{waitingClient ? ` · ${waitingClient} ESPERANDO AL CLIENTE` : ''}
            </p>
          </div>
          <Link href={`/${project.slug}`} className="btn-brutal inline-flex items-center gap-2">ABRIR EL MAPA <Icon name="arrow" size={14} /></Link>
        </div>
        <ol className="grid gap-px bg-blanco-10 sm:grid-cols-2 lg:grid-cols-4">
          {counts.map((column, index) => <li key={column.key} className="bg-negro p-5">
            <p className="mono-label text-blanco-50">{String(index + 1).padStart(2, '0')} · {column.label}</p>
            <p className="mt-3 font-display text-4xl font-bold text-blanco">{column.count}</p>
            <p className="mt-2 font-mono text-[10px] leading-5 text-blanco-60">{column.plain}</p>
            <span className="mt-4 block h-1 w-full bg-blanco-10">
              <span className="block h-1 bg-blanco-40" style={{ width: ideas.length ? `max(6%, ${Math.round((column.count / ideas.length) * 100)}%)` : '0%' }} />
            </span>
          </li>)}
        </ol>
      </section>

      <div className="anim-rise mt-10 grid gap-px bg-blanco-10 sm:grid-cols-2" style={{ animationDelay: '320ms' }}>
        <Link href={`/${project.slug}`} className="group flex items-start gap-4 bg-negro p-6 transition-colors hover:bg-blanco-05">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-blanco-20 text-blanco-40"><Icon name="map" size={18} /></span>
          <span>
            <strong className="block font-display text-xl font-bold text-blanco group-hover:text-blanco-90">Tablero de trabajo</strong>
            <small className="mt-1 block font-mono text-[10px] leading-5 text-blanco-60">El flujo completo, la guía paso a paso y la siguiente acción de cada pieza.</small>
          </span>
        </Link>
        <Link href={`/audit/${project.slug}`} className="group flex items-start gap-4 bg-negro p-6 transition-colors hover:bg-blanco-05">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-blanco-20 text-blanco-40"><Icon name="eye" size={18} /></span>
          <span>
            <strong className="block font-display text-xl font-bold text-blanco group-hover:text-blanco-90">Auditoría · solo lectura</strong>
            <small className="mt-1 block font-mono text-[10px] leading-5 text-blanco-60">Contadores por fase, estado y trazabilidad. Se ve todo, no se edita nada.</small>
          </span>
        </Link>
      </div>

      <p className="mt-10 font-mono text-[10px] leading-5 text-blanco-50">
        El link directo también funciona: cada proyecto vive en <span className="text-blanco-50">/{project.slug}</span>
      </p>
    </div>
  </main>;
}
