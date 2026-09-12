import { notFound } from 'next/navigation';
import { getProject } from '@/lib/data';
import { RoadmapView } from '@/components/roadmap-view';

export default async function RoadmapPage({ params }: { params: Promise<{ projectSlug: string }> }) {
  const { projectSlug } = await params;
  const { project } = await getProject(projectSlug);
  if (!project) notFound();
  return <RoadmapView />;
}
