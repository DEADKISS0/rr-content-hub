import { getIdeas, getProject } from '@/lib/data';
import { notFound } from 'next/navigation';
import { QueueSection } from '@/components/queue-section';
import { QUEUES, inQueue } from '@/lib/queues';

export default async function Publications({ params }: { params: Promise<{ projectSlug: string }> }) {
  const { projectSlug } = await params;
  const { project } = await getProject(projectSlug); if (!project) notFound();
  const ideas = (await getIdeas(project.id)).filter((idea) => inQueue(idea.status, 'publicaciones'));
  return <QueueSection
    title={QUEUES.publicaciones.title}
    eyebrow={`${project.name} · RELEASE_QUEUE`}
    description="Qué sale, cuándo sale, en qué plataforma y con qué copy. Orgánico y pauta en un mismo calendario operativo."
    owner="PUBLISHER · MEDIA BUYER · OWNER"
    guide="Aquí se programan únicamente piezas con revisión final. Registra plataforma, copy, fecha y enlace de salida."
    notice={{
      title: '[FALTA LA BASE PARA PROGRAMAR]',
      body: 'La cola de salida es real: aquí entran las piezas en revisión final y las ya publicadas. Lo que todavía no se puede registrar es la fecha de salida y el enlace de publicación (columnas due_at y published_url): están escritas en la migración v3 y esa migración NO está aplicada en la base. Hasta que se pegue, esta pantalla lista las piezas pero no promete fechas.',
    }}
    ideas={ideas}
    projectSlug={projectSlug}
    empty={QUEUES.publicaciones.empty}
  />;
}
