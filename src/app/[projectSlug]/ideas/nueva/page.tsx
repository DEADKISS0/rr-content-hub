import { NewIdeaForm } from '@/components/new-idea-form';

export default async function NewIdea({ params }: { params: Promise<{ projectSlug: string }> }) {
  const { projectSlug } = await params;
  return <main className="min-h-screen bg-negro"><header className="border-b-2 border-blanco px-5 py-4 md:px-10"><div className="mx-auto flex max-w-6xl justify-between"><a href={`/${projectSlug}/ideas`} className="font-mono text-xs text-blanco-60">← VOLVER</a><span className="mono-label text-mostaza">[NEW_CONTENT_RECORD]</span></div></header><div className="mx-auto max-w-4xl px-5 py-10 md:px-10"><p className="eyebrow">{projectSlug} · CAPTURA</p><h1 className="display-title">NUEVA<br/><em>IDEA.</em></h1><NewIdeaForm projectSlug={projectSlug}/></div></main>;
}
