import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProject } from '@/lib/data';
import { rolEnProyecto } from '@/lib/project-guard';
import { Icon } from '@/components/ui/icons';

const ETIQUETA: Record<string, string> = {
  owner: 'Dirección del proyecto',
  creative: 'Creativa — propone y ejecuta',
  editor: 'Edición — guion y montaje',
  camera: 'Cámara — encuadre y luz',
  client_approver: 'Cliente — aprueba o rechaza',
  client_editor: 'Cliente — edita su contenido',
  client_viewer: 'Cliente — solo lectura',
  media_buyer: 'Medios — pauta y campañas',
  sin_rol: 'Sin rol en este proyecto',
};

/** Lo que cada rol puede hacer, en palabras. La matriz del servidor es la
 *  autoridad; esto es para que la persona entienda por qué ve lo que ve. */
const PUEDE: Record<string, string[]> = {
  owner: ['Crear y editar cualquier pieza', 'Mover estados', 'Aprobar y rechazar', 'Invitar y cambiar roles'],
  creative: ['Crear y editar cualquier pieza', 'Mover estados'],
  editor: ['Crear y editar cualquier pieza', 'Mover estados'],
  camera: ['Crear y editar cualquier pieza', 'Mover estados'],
  media_buyer: ['Crear y editar cualquier pieza', 'Mover estados'],
  client_approver: ['Aprobar y rechazar', 'Editar contenido'],
  client_editor: ['Editar contenido'],
  client_viewer: ['Leer'],
  sin_rol: [],
};

export default async function PerfilPage({ params }: { params: Promise<{ projectSlug: string }> }) {
  const { projectSlug } = await params;
  const { project } = await getProject(projectSlug);
  if (!project) notFound();
  const v = await rolEnProyecto(project.id);

  return (
    <main className="mx-auto max-w-3xl px-5 py-10 md:px-10">
      <header className="border-b border-blanco-20 pb-5">
        <Link href={`/${projectSlug}`} className="font-mono text-[10px] text-blanco-50 hover:text-blanco">
          ← VOLVER AL TABLERO
        </Link>
        <h1 className="mt-4 font-display text-3xl font-bold text-blanco">Tu perfil</h1>
      </header>

      {!v.email ? (
        <div className="mt-8 border-l-4 border-l-mostaza bg-blanco-05 px-4 py-4">
          <p className="text-sm leading-6 text-blanco-80">
            Estás mirando el hub sin iniciar sesión. Puedes leer todo, pero crear y mover piezas necesita una cuenta.
          </p>
          <Link href={`/login?next=${encodeURIComponent(`/${projectSlug}/perfil`)}`} className="btn-brutal mt-4 inline-flex">
            <Icon name="user" size={14} /> INICIAR SESIÓN
          </Link>
        </div>
      ) : (
        <>
          <dl className="mt-8 grid gap-px border border-blanco-20 bg-blanco-20 sm:grid-cols-2">
            <div className="bg-negro px-4 py-3">
              <dt className="mono-label text-blanco-50">// CORREO</dt>
              <dd className="mt-1 break-all font-mono text-sm text-blanco">{v.email}</dd>
            </div>
            <div className="bg-negro px-4 py-3">
              <dt className="mono-label text-blanco-50">// ROL EN {project.name.toUpperCase()}</dt>
              <dd className="mt-1 font-mono text-sm text-orquidea">{ETIQUETA[v.rol] ?? v.rol}</dd>
            </div>
          </dl>

          <section className="mt-8">
            <h2 className="font-mono text-[10px] text-blanco-50">// QUÉ PUEDES HACER AQUÍ</h2>
            {PUEDE[v.rol]?.length ? (
              <ul className="mt-3 space-y-2">
                {PUEDE[v.rol].map((permiso) => (
                  <li key={permiso} className="flex items-center gap-2 font-mono text-xs text-blanco-70">
                    <span className="inline-block h-2 w-2 bg-orquidea" aria-hidden />
                    {permiso}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 border-l-2 border-mostaza bg-blanco-05 px-4 py-3 text-sm leading-6 text-blanco-70">
                Todavía no tienes un rol asignado en este proyecto. Pídeselo a Dirección y te lo activan.
              </p>
            )}
          </section>
        </>
      )}
    </main>
  );
}
