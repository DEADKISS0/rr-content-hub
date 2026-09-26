import { RoadmapView } from '@/components/roadmap-view';

export default function RoadmapPage({ params }: { params: Promise<{ projectSlug: string }> }) {
  return <RoadmapView />;
}