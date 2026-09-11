'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { readLocalIdeas, subscribeWorkspace, type LocalIdea } from '@/lib/workspace-store';
import { IdeaActions } from '@/components/idea-actions';
import { IdeaCollaboration } from '@/components/idea-collaboration';
import { RoleView } from '@/components/role-view';
import { ReferenceEmbed } from '@/components/reference-embed';

export function LocalIdeaPage({ projectSlug, ideaId }: { projectSlug: string; ideaId: string }) {
  const [idea, setIdea] = useState<LocalIdea | null>(null);
  useEffect(() => { const sync = () => setIdea(readLocalIdeas(projectSlug).find((item) => item.id === ideaId) ?? null); sync(); return subscribeWorkspace(projectSlug, sync); }, [ideaId, projectSlug]);
  if (!idea) return <main className="min-h-screen bg-negro p-8"><p className="font-mono text-xs text-blanco-60">CARGANDO IDEA LOCAL…</p></main>;
  return <main className="min-h-screen bg-negro"><header className="border-b-2 border-blanco px-5 py-4"><Link href={`/${projectSlug}/ideas`} className="font-mono text-xs text-blanco-60">← BANCO DE IDEAS</Link></header><div className="mx-auto max-w-6xl px-5 py-8 md:px-10"><div className="mb-8 border-b border-blanco-10 pb-8"><p className="eyebrow">{idea.code} · {idea.content_type === 'organic' ? 'ORGÁNICO' : 'PAUTA'} · {idea.category}</p><h1 className="display-title max-w-5xl">{idea.title}</h1><p className="mt-6 max-w-2xl text-base leading-7 text-blanco-60">{idea.description}</p></div><div className="grid gap-6 lg:grid-cols-[1.25fr_.75fr]"><section className="space-y-5"><ReferenceEmbed url={idea.reference_url} title={idea.title}/><div className="border-2 border-blanco bg-blanco-05 p-5"><p className="mono-label text-mostaza">// OBJETIVO</p><p className="mt-3 text-sm leading-6 text-blanco-60">{idea.objective}</p></div><div className="grid gap-px border-2 border-blanco-20 bg-blanco-10 md:grid-cols-3"><Brief title="CÁMARA" copy={idea.camera}/><Brief title="TALENTO" copy={idea.talent}/><Brief title="EDICIÓN" copy={idea.edit}/></div><IdeaCollaboration projectSlug={projectSlug} ideaId={ideaId}/></section><aside className="space-y-5"><div className="brutal-panel"><p className="eyebrow">[NEXT_ACTION]</p><h2 className="mt-3 font-display text-3xl font-bold text-blanco">SIGUIENTE<br/><span className="text-mostaza">RELEVO.</span></h2><div className="mt-5"><IdeaActions projectSlug={projectSlug} ideaId={ideaId} currentStatus={idea.status}/></div></div><RoleView/></aside></div></div></main>;
}
function Brief({ title, copy }: { title: string; copy: string }) { return <div className="bg-negro p-5"><p className="mono-label text-mostaza">// {title}</p><p className="mt-3 text-sm leading-6 text-blanco-60">{copy}</p></div>; }
