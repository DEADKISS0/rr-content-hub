'use client';

import { ProjectMap, type BoardIdea } from './project-map';

/**
 * Banco de ideas. Antes tenía su propio set de filtros y su propio tablero
 * (FlowBoard): dos vistas distintas para las mismas piezas. Ahora reusa el mapa
 * —una sola gramática visual y un solo lugar donde arreglar algo.
 */
export function IdeasBoard({ ideas, projectSlug }: { ideas: BoardIdea[]; projectSlug: string }) {
  return <ProjectMap ideas={ideas} projectSlug={projectSlug} />;
}
