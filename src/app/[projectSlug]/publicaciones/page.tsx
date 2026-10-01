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
    guide="Aquí se programan únicamente piezas con revisión final. Registra plataforma, copy, fecha y enlace de salida desde la ficha."
    notice={{
      title: '[CÓMO SE PROGRAMA UNA SALIDA]',
      body: 'Cada ficha tiene dos campos que se editan desde "EDITAR DATOS": la fecha de salida y el enlace donde quedó publicada. MEDIDO 2026-10-01: las columnas due_at y published_url existen en la base y funcionan — lo que antes esta pantalla decía que faltaba, ya está. Ninguna idea de este proyecto tiene fecha puesta todavía: eso no es una limitación del Hub, es trabajo del equipo.',
    }}
    ideas={ideas}
    projectSlug={projectSlug}
    empty={QUEUES.publicaciones.empty}
  />;
}
