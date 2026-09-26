import { getIdeas, getProject } from '@/lib/data';
import { notFound } from 'next/navigation';
import { QueueSection } from '@/components/queue-section';

const QUEUE = ['published', 'closed'];

export default async function Publications({ params }: { params: Promise<{ projectSlug: string }> }) {
  const { projectSlug } = await params;
  const { project } = await getProject(projectSlug); if (!project) notFound();
  const ideas = (await getIdeas(project.id)).filter((idea: any) => QUEUE.includes(idea.status));
  return <QueueSection
    title="PUBLICACIONES"
    eyebrow={`${project.name} · RELEASE_QUEUE`}
    description="Qué sale, cuándo sale, en qué plataforma y con qué copy. Orgánico y pauta en un mismo calendario operativo."
    owner="PUBLISHER · MEDIA BUYER · OWNER"
    guide="Aquí se programan únicamente piezas con revisión final. Registra plataforma, copy, fecha y enlace de salida."
    notice={{
      title: '[MISMA PANTALLA QUE MÉTRICAS]',
      body: 'Hoy PUBLICACIONES y MÉTRICAS filtran los mismos estados (publicado y cerrado) y muestran lo mismo: la diferencia está en la base, que todavía no tiene fecha de salida ni métricas. Falta decidir si se fusionan en una sola pantalla o si cada una se queda cuando el back esté aplicado.',
    }}
    ideas={ideas}
    projectSlug={projectSlug}
    empty="No hay piezas listas para publicar todavía."
  />;
}
