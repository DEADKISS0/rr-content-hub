import Link from 'next/link';
import Image from 'next/image';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser, getIdea, getProject } from '@/lib/data';
import { StatusBadge } from '@/components/status-badge';
import { IdeaActions } from '@/components/idea-actions';
import { IdeaCollaboration } from '@/components/idea-collaboration';
import { RoleView } from '@/components/role-view';
import { LocalIdeaPage } from '@/components/local-idea-page';
import { ReferenceEmbed } from '@/components/reference-embed';

export default async function IdeaDetail({ params }: { params: Promise<{ projectSlug: string; ideaId: string }> }) {
  const { projectSlug, ideaId } = await params;
  const { user } = await getCurrentUser(); if (!user) redirect('/login');
  const { project } = await getProject(projectSlug); if (!project) notFound();
  if (ideaId.startsWith('local-')) return <LocalIdeaPage projectSlug={projectSlug} ideaId={ideaId}/>;
  const idea: any = await getIdea(project.id, ideaId); if (!idea) notFound();
  const raw = idea.reference_url ?? idea.ref ?? '';
  return <main className="min-h-screen bg-negro"><header className="border-b-2 border-blanco px-5 py-4 md:px-10"><div className="mx-auto flex max-w-7xl items-center justify-between gap-3"><Link href={`/${projectSlug}/ideas`} className="font-mono text-xs text-blanco-60 hover:text-mostaza">← BANCO DE IDEAS</Link><div className="flex items-center gap-4"><Image src="/brand/rr-symbol-fucsia-on-negro.png" alt="Símbolo RR Aliados" width={52} height={40} className="h-9 w-12 object-contain"/><StatusBadge status={idea.status}/></div></div></header><div className="mx-auto max-w-6xl px-4 py-8 sm:px-5 md:px-10 md:py-10"><div className="mb-8 border-b border-blanco-10 pb-8"><p className="eyebrow">{idea.code ?? 'IDEA'} · {idea.content_type === 'organic' ? 'ORGÁNICO' : 'PAUTA'} · {idea.category}</p><h1 className="display-title max-w-5xl">{idea.title}</h1><p className="mt-6 max-w-2xl text-base leading-7 text-blanco-60 sm:text-lg sm:leading-8">{idea.description}</p></div><div className="grid gap-6 lg:grid-cols-[1.25fr_.75fr]"><section className="space-y-5"><ReferenceEmbed url={raw} title={idea.title}/><Block title="OBJETIVO">{idea.objective}</Block><div className="grid gap-px border-2 border-blanco-20 bg-blanco-10 md:grid-cols-3"><Block title="CÁMARA">{idea.camera}</Block><Block title="TALENTO">{idea.talent}</Block><Block title="EDICIÓN">{idea.edit}</Block></div><IdeaCollaboration projectSlug={projectSlug} ideaId={ideaId}/></section><aside className="space-y-5"><div className="brutal-panel"><p className="eyebrow">[FLUJO GUIADO]</p><h2 className="mt-4 font-display text-3xl font-bold text-blanco">SIGUIENTE<br/><span className="text-mostaza">RELEVO.</span></h2><p className="mt-4 text-sm leading-6 text-blanco-60">Cada cambio registra quién actuó, qué se decidió y quién continúa.</p><div className="mt-7"><IdeaActions projectSlug={projectSlug} ideaId={ideaId} currentStatus={idea.status}/></div></div><RoleView/></aside></div></div></main>;
}
function Block({ title, children }: { title: string; children: React.ReactNode }) { return <div className="border border-blanco-10 bg-blanco-05 p-5"><p className="mono-label mb-3 text-mostaza">// {title}</p><div className="text-sm leading-6 text-blanco-60">{children}</div></div>; }
