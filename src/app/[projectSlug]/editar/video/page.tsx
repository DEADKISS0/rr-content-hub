import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getProject } from '@/lib/data';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ projectSlug: string }> }): Promise<Metadata> {
  const { projectSlug } = await params;
  const { project } = await getProject(projectSlug);
  const nombre = project?.name ?? 'RR';
  return {
    title: `Editar video · dentro del hub | ${nombre}`,
    description: `Editor de video en el navegador: pistas multipista, cortes, velocidad, transiciones, texto y exportación en WebM y MP4 (H.264).`,
  };
}

/**
 * La sección «Editar video» del hub.
 *
 * Igual que la de foto: el editor va DENTRO del Content Hub. Se exporta en
 * WebM (VP9 + Opus, se abre en todos lados) y en MP4 (H.264, el que piden las
 * plataformas), y el archivo se arma en el navegador de la persona.
 */
export default async function EditarVideoPage({ params }: { params: Promise<{ projectSlug: string }> }) {
  const { projectSlug } = await params;
  const { project } = await getProject(projectSlug);
  if (!project) notFound();
  redirect('/editors/rr-motion/index.html');
}
