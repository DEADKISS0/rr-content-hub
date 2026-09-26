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
    description="Cada publicación con su hipótesis y su resultado, para decidir qué formato se repite y qué se descarta."
    owner="MEDIA BUYER · OWNER DEL PROYECTO"
    guide="Después de publicar se registra la hipótesis, la URL de salida y el resultado. Esa medición cierra el ciclo."
    notice={{
      title: '[MEDICIÓN TODAVÍA SIN BASE]',
      body: 'Las columnas que guardan hipótesis, URL publicada y métricas (metrics, published_url, due_at) están en la migración v3, que NO está aplicada en la base. Por eso hoy esta pantalla muestra las piezas publicadas pero no sus números. No inventamos columnas: cuando el SQL se pegue, esta pantalla empieza a medir sola.',
    }}
    ideas={ideas}
    projectSlug={projectSlug}
    empty="No hay publicaciones registradas todavía. Cuando la primera pieza se publique, aparece aquí para medirla."
  />;
}
