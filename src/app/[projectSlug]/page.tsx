import { notFound } from 'next/navigation';
import { getIdeas, getProject } from '@/lib/data';
import { ProjectDashboard } from '@/components/project-dashboard';

export default async function ProjectDashboardPage({ params }: { params: Promise<{ projectSlug: string }> }) {
  const { projectSlug } = await params;
  const { project, access } = await getProject(projectSlug); if (!project) notFound();
  const ideas = await getIdeas(project.id);
  return <ProjectDashboard project={project} projectSlug={projectSlug} ideas={ideas} role={access?.role_in_project ?? 'owner'}/>;
}
