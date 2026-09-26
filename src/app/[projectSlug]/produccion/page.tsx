import { getIdeas, getProject } from '@/lib/data';
import { notFound } from 'next/navigation';
import { QueueSection } from '@/components/queue-section';
import { QUEUES, inQueue } from '@/lib/queues';

export default async function Production({ params }: { params: Promise<{ projectSlug: string }> }) {
  const { projectSlug } = await params;
  const { project } = await getProject(projectSlug); if (!project) notFound();
  const ideas = (await getIdeas(project.id)).filter((idea) => inQueue(idea.status, 'produccion'));
  return <QueueSection
    title={QUEUES.produccion.title}
    eyebrow={`${project.name} · PRODUCTION_BOARD`}
    description="Todo lo que ya tiene dirección aprobada y necesita convertirse en una pieza lista para publicar. Cada rol trabaja desde su propio brief."
    owner="CÁMERA · TALENTO · EDITOR"
    guide="Una idea solo entra aquí después de la aprobación del cliente. El pipeline muestra en qué paso va: grabación, crudo subido, edición y listo."
    ideas={ideas}
    projectSlug={projectSlug}
    empty={QUEUES.produccion.empty}
    showPipeline
  />;
}
