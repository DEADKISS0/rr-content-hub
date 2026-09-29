import { notFound } from 'next/navigation';
import { getProject, getClientesDeLaPersona } from '@/lib/data';
import { rolEnProyecto } from '@/lib/project-guard';
import { AUTH_ENABLED } from '@/lib/mode';
import { WorkspaceShell } from '@/components/workspace-shell';

export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ projectSlug: string }> }) {
  const { projectSlug } = await params;
  const { project } = await getProject(projectSlug);
  if (!project) notFound();
  // El rol se resuelve en el servidor, nunca se pasa fijo. Con `role="owner"`
  // hardcodeado, un cliente de solo lectura veía el botón de crear y lo
  // descubría pulsándolo: la interfaz anunciaba una permiso que el servidor
  // iba a rechazar.
  const veredicto = await rolEnProyecto(project.id);

  // La lista de clientes va aquí, en el servidor, y no se pide desde el
  // navegador: leer `rr_hub_access` con la anon no devuelve nada (el RLS la
  // cerró), así que un selector cliente se pintaría siempre con candados.
  //
  // Y no es solo para pintar: el servidor de `/api/cambiar-cliente` vuelve a
  // comprobar la fila antes de firmar la cookie nueva. Esta lista dice qué se
  // puede pulsar; la fila de la base decide qué se puede abrir.
  const clientes = await getClientesDeLaPersona();

  return (
    <WorkspaceShell
      project={project}
      role={veredicto.rol}
      email={veredicto.email ?? undefined}
      // En modo abierto no hay a quién preguntarle el rol: se opera como se
      // operaba antes de tener la tabla poblada, y el botón de crear queda
      // disponible para todos en vez de desaparecer para todos.
      puedeEscribir={AUTH_ENABLED ? veredicto.puedeEscribir : true}
      clientes={clientes}
    >
      {children}
    </WorkspaceShell>
  );
}
