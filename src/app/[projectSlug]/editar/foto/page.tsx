import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getProject } from '@/lib/data';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ projectSlug: string }> }): Promise<Metadata> {
  const { projectSlug } = await params;
  const { project } = await getProject(projectSlug);
  const nombre = project?.name ?? 'RR';
  return {
    title: `Editar foto · dentro del hub | ${nombre}`,
    description: `Editor de foto en el navegador: capas, recorte, ajustes, filtros, texto y quitar fondo (básico). Sin salir del hub.`,
  };
}

/**
 * La sección «Editar foto» del hub.
 *
 * El editor vive DENTRO del Content Hub (decisión de Rosas, nota en
 * `docs/NOTA_spec_v2_editores.md`): nadie tiene que salir del hub para retocar
 * una foto. Todo el trabajo ocurre en el navegador de la persona y el archivo
 * original no se toca.
 */
export default async function EditarFotoPage({ params }: { params: Promise<{ projectSlug: string }> }) {
  const { projectSlug } = await params;
  const { project } = await getProject(projectSlug);
  if (!project) notFound();
  redirect('/editors/rr-imagen/index.html');
}
