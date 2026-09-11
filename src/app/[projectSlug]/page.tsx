import { notFound, redirect } from 'next/navigation';
import { getCurrentUser, getIdeas, getProject } from '@/lib/data';
import { ProjectDashboard } from '@/components/project-dashboard';

export default async function ProjectDashboardPage({ params }: { params: Promise<{ projectSlug: string }> }) {
  const { projectSlug } = await params;
  const { user } = await getCurrentUser(); if (!user) redirect('/login');
  const { project, access } = await getProject(projectSlug); if (!project) notFound(); if (!access) redirect('/select-project');
  const ideas = await getIdeas(project.id);
  return <ProjectDashboard project={project} projectSlug={projectSlug} ideas={ideas} role={access.role_in_project}/>;
}
