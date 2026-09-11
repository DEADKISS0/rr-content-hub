import { getIdeas, getProject } from '@/lib/data';
import { notFound } from 'next/navigation';
import { QueueSection } from '@/components/queue-section';

const QUEUE = ['published', 'closed'];

export default async function Metrics({ params }: { params: Promise<{ projectSlug: string }> }) {
  const { projectSlug } = await params;
  const { project } = await getProject(projectSlug); if (!project) notFound();
  const ideas = (await getIdeas(project.id)).filter((idea: any) => QUEUE.includes(idea.status));
  return <QueueSection
    title="MÉTRICAS"
    eyebrow={`${project.name} · PERFORMANCE_LOOP`}
    description="Conecta cada publicación con su hipótesis, objetivo y resultado. La medición cierra el ciclo para decidir qué repetir y qué descartar."
    owner="MEDIA BUYER · OWNER DEL PROYECTO"
    guide="Después de publicar se registra la hipótesis, URL y resultado para decidir qué formato se repite."
    ideas={ideas}
    projectSlug={projectSlug}
    empty="No hay métricas todavía porque no hay publicaciones registradas."
  />;
}
