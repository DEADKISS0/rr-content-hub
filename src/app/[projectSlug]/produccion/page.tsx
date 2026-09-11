import { getIdeas, getProject } from '@/lib/data';
import { notFound } from 'next/navigation';
import { QueueSection } from '@/components/queue-section';

const QUEUE = ['script_approved', 'in_production', 'raw_uploaded', 'editing', 'ready_to_publish'];

export default async function Production({ params }: { params: Promise<{ projectSlug: string }> }) {
  const { projectSlug } = await params;
  const { project } = await getProject(projectSlug); if (!project) notFound();
  const ideas = (await getIdeas(project.id)).filter((idea: any) => QUEUE.includes(idea.status));
  return <QueueSection
    title="PRODUCCIÓN"
    eyebrow={`${project.name} · PRODUCTION_BOARD`}
    description="Todo lo que ya tiene dirección aprobada y necesita convertirse en una pieza lista para publicar. Cada rol trabaja desde su propio brief."
    owner="CÁMARA · TALENTO · EDITOR"
    guide="Una idea solo entra aquí después de la aprobación del cliente. El pipeline muestra en qué paso va: grabación, crudo subido, edición y listo."
    ideas={ideas}
    projectSlug={projectSlug}
    empty="Aún no hay piezas aprobadas que requieran rodaje o edición."
    showPipeline
  />;
}
