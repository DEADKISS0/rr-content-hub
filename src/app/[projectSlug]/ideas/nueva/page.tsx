import { NewIdeaForm } from '@/components/new-idea-form';

export default async function NewIdea({ params }: { params: Promise<{ projectSlug: string }> }) {
  const { projectSlug } = await params;
  return <main className="min-h-screen bg-negro"><header className="border-b border-blanco-20 px-5 py-4 md:px-10"><div className="mx-auto flex max-w-6xl justify-between"><a href={`/${projectSlug}/ideas`} className="font-mono text-xs text-blanco-60 hover:text-blanco">← VOLVER</a><span className="mono-label text-blanco-50">[NUEVO REGISTRO]</span></div></header><div className="mx-auto max-w-4xl px-5 py-10 md:px-10"><p className="eyebrow">{projectSlug} · CAPTURA</p><h1 className="display-title">Nueva idea.</h1><NewIdeaForm projectSlug={projectSlug}/></div></main>;
}
