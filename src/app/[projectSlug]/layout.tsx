import { notFound } from 'next/navigation';
import { getProject } from '@/lib/data';
import { rolEnProyecto } from '@/lib/project-guard';
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
      puedeEscribir={veredicto.puedeEscribir}
    >
      {children}
    </WorkspaceShell>
  );
}
