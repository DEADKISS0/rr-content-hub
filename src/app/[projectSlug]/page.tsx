import { notFound } from 'next/navigation';
import { getIdeas, getProject, getVotosDeVarias } from '@/lib/data';
import { ProjectDashboard } from '@/components/project-dashboard';

export default async function ProjectDashboardPage({ params }: { params: Promise<{ projectSlug: string }> }) {
  const { projectSlug } = await params;
  const { project, access } = await getProject(projectSlug);
  if (!project) notFound();

  const ideas = await getIdeas(project.id);

  /*
   * MEDIDO 2026-10-01: 19 ideas de Wundeer carrying `voting` con CERO votos, de
   * las 18 personas con acceso 14 sin haber votado nunca, y el botón de votar
   * vivía solo dentro de la ficha. Cero menciones de "votar" en el tablero, en
   * el banco y en aprobaciones. El sistema funcionaba y nadie lo tocaba.
   *
   * Para que el botón de la tarjeta pueda decir "faltan 2 de 3" hace falta el
   * conteo al pintar. Y para no hacer 19 consultas, se piden todas en una: solo
   * las que están en `voting`, que son las únicas con botón.
   */
  const enVotacion = ideas.filter((idea) => idea.status === 'voting').map((idea) => idea.id);
  const conteos = await getVotosDeVarias(enVotacion);

  const conVotos = ideas.map((idea) => ({
    ...idea,
    aFavor: conteos[idea.id]?.aFavor ?? 0,
    enContra: conteos[idea.id]?.enContra ?? 0,
  }));

  return <ProjectDashboard project={project} projectSlug={projectSlug} ideas={conVotos} role={access?.role_in_project ?? 'owner'} />;
}