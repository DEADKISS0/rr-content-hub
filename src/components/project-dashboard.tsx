import Link from 'next/link';
import { FlowBoard } from '@/components/flow-board';
import { ROLE_HOME, ROLE_LABEL, type RoleKey, statusMeta } from '@/lib/flow';

type Idea = { id: string; code?: string; title: string; description?: string; content_type: string; status: string };
type Project = { name: string; client_name: string; description?: string };

export function ProjectDashboard({ project, projectSlug, ideas, role }: { project: Project; projectSlug: string; ideas: Idea[]; role: string }) {
  const roleKey = (role in ROLE_HOME ? role : 'owner') as RoleKey;
  const home = ROLE_HOME[roleKey];
  const waiting = ideas.filter((idea) => ['pending_approval', 'needs_changes', 'pending_script_review', 'ready_to_publish'].includes(idea.status));
  return <main className="min-h-screen bg-negro"><div className="mx-auto max-w-[1440px] px-5 py-8 md:px-10 md:py-12">
    <header className="mb-10 grid gap-8 border-b-2 border-blanco pb-10 lg:grid-cols-[1fr_auto] lg:items-end anim-rise"><div><p className="eyebrow">[WUNDEER · OPERACIÓN VIVA · {ROLE_LABEL[roleKey]}]</p><h1 className="display-title">EL TRABAJO<br/><em>VISIBLE.</em></h1><p className="mt-6 max-w-2xl text-base leading-8 text-blanco-60">{project.description ?? 'Una pieza avanza de izquierda a derecha. El color y el texto te dicen quién tiene la pelota.'}</p></div><div className="flex flex-wrap gap-3"><Link href={`/${projectSlug}/ideas`} className="btn-brutal">VER TODO →</Link><Link href={`/${projectSlug}/ideas/nueva`} className="btn-brutal-mostaza">+ NUEVA IDEA</Link></div></header>
    <FlowBoard ideas={ideas} projectSlug={projectSlug}/>
    <section className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]"><div className="border-2 border-mostaza bg-mostaza/5 p-6 sm:p-8"><p className="eyebrow">[TU SIGUIENTE ACCIÓN]</p><h2 className="mt-3 font-display text-3xl font-bold text-blanco">{home.headline}</h2><p className="mt-4 max-w-xl text-sm leading-7 text-blanco-60">{home.explanation}</p><Link href={`/${projectSlug}${home.queue}`} className="mt-6 inline-block btn-brutal-mostaza">IR A MI COLA →</Link></div><div className="border-2 border-fucsia bg-fucsia/10 p-6 sm:p-8"><p className="eyebrow">[BLOQUEOS VISIBLES]</p><p className="mt-3 font-display text-6xl font-bold text-blanco">{waiting.length}</p><h2 className="mt-2 font-display text-2xl font-bold text-blanco">{waiting.length ? 'PIEZAS ESPERANDO RESPUESTA.' : 'TODO AVANZA.'}</h2><p className="mt-3 text-sm leading-6 text-blanco-60">{waiting.length ? waiting.slice(0, 2).map((idea) => `${idea.code ?? 'Idea'} espera a ${statusMeta(idea.status).who}`).join(' · ') : 'No hay bloqueos pendientes en este momento.'}</p><Link href={`/${projectSlug}/aprobaciones`} className="mt-5 inline-block font-mono text-xs text-mostaza underline">VER BLOQUEOS →</Link></div></section>
  </div></main>;
}
