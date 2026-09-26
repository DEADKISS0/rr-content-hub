import { RoadmapView } from '@/components/roadmap-view';
import { todayIso } from '@/lib/roadmap';

/**
 * La fecha de hoy se resuelve aquí, en el servidor, y baja como dato.
 * Calcularla dentro del componente cliente daría HTML distinto en el servidor y
 * en el navegador — el aviso de hidratación clásico.
 */
export default async function RoadmapPage({ params }: { params: Promise<{ projectSlug: string }> }) {
  await params;
  return <RoadmapView today={todayIso()} />;
}
