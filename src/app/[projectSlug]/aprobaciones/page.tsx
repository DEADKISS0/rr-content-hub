import { getIdeas, getProject } from '@/lib/data';
import { notFound } from 'next/navigation';
import { QueueSection } from '@/components/queue-section';

const QUEUE = ['pending_approval', 'needs_changes', 'pending_script_review', 'ready_to_publish'];

export default async function Approvals({ params }: { params: Promise<{ projectSlug: string }> }) {
  const { projectSlug } = await params;
  const { project } = await getProject(projectSlug); if (!project) notFound();
  const ideas = (await getIdeas(project.id)).filter((idea: any) => QUEUE.includes(idea.status));
  return <QueueSection
    title="APROBACIONES"
    eyebrow={`${project.name} · CLIENT_REVIEW`}
    description="Revisa conceptos y versiones antes de desbloquear producción o publicación. Cada decisión debe quedar acompañada por una evidencia."
    owner="OWNER DEL PROYECTO · CLIENTE"
    guide="Aquí se presenta la idea y el cliente decide: aprobar, pedir ajustes o archivar. La decisión queda ligada a la pieza."
    ideas={ideas}
    projectSlug={projectSlug}
    empty="No hay decisiones pendientes del cliente. Las nuevas ideas se envían a revisión desde su ficha."
  />;
}
