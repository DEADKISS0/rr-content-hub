import type { Metadata } from 'next';
import { getIdeas, getProject } from '@/lib/data'; import { notFound } from 'next/navigation'; import Link from 'next/link'; import { IdeasBoard } from '@/components/ideas-board';

export async function generateMetadata({ params }: { params: Promise<{ projectSlug: string }> }): Promise<Metadata> {
  const { projectSlug } = await params;
  const { project } = await getProject(projectSlug);
  if (!project) return { title: 'Proyecto no encontrado | RR Content Hub' };
  return {
    title: `Banco de ideas · ${project.name} | RR Content Hub`,
    description: `Todas las ideas en marcha de ${project.name}`,
  };
}

export default async function IdeasList({params}:{params:Promise<{projectSlug:string}>}){const {projectSlug}=await params;const {project}=await getProject(projectSlug);if(!project)notFound();const ideas:any[]=await getIdeas(project.id);return <main className="min-h-screen bg-negro"><header className="border-b border-blanco-20 px-5 py-4 md:px-10"><div className="mx-auto flex max-w-7xl items-center justify-between"><Link href={`/${projectSlug}`} className="inline-flex min-h-[44px] items-center font-mono text-xs text-blanco-60 hover:text-blanco">← DASHBOARD</Link><h1 className="font-display text-2xl font-bold text-blanco">Banco de ideas</h1><Link href={`/${projectSlug}/ideas/nueva`} className="btn-brutal">+ NUEVA</Link></div></header><div className="mx-auto max-w-7xl px-5 py-8 md:px-10"><div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">{project.name} · CONTENT_PIPELINE</p><h2 className="display-title">Ideas en marcha.</h2></div><p className="font-mono text-xs text-blanco-60">{ideas.length} registros · orgánico + pauta</p></div><IdeasBoard ideas={ideas} projectSlug={projectSlug}/></div></main>}
