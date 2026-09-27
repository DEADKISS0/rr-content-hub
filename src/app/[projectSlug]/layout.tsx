import { notFound } from 'next/navigation';
import { getProject } from '@/lib/data';
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
  return (
    <WorkspaceShell
      project={project}
      role={veredicto.rol}
      email={veredicto.email ?? undefined}
      // En modo abierto no hay a quién preguntarle el rol: se opera como se
      // operaba antes de tener la tabla poblada, y el botón de crear queda
      // disponible para todos en vez de desaparecer para todos.
      puedeEscribir={AUTH_ENABLED ? veredicto.puedeEscribir : true}
    >
      {children}
    </WorkspaceShell>
  );
}
