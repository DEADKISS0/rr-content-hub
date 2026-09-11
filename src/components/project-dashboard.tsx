'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { readLocalIdeas, subscribeWorkspace } from '@/lib/workspace-store';
import { StatusBadge } from '@/components/status-badge';

type Idea = { id: string; code?: string; title: string; description?: string; category?: string; content_type: string; status: string; creator?: string };
type Project = { name: string; client_name: string; description?: string; brand_primary_color?: string };

const downstream = ['approved', 'in_production', 'editing', 'ready_to_publish', 'published'];
const production = ['in_production', 'editing', 'ready_to_publish'];

export function ProjectDashboard({ project, projectSlug, ideas, role }: { project: Project; projectSlug: string; ideas: Idea[]; role: string }) {
  const [localIdeas, setLocalIdeas] = useState<Idea[]>([]);
  useEffect(() => { const sync = () => setLocalIdeas(readLocalIdeas(projectSlug)); sync(); return subscribeWorkspace(projectSlug, sync); }, [projectSlug]);
  const allIdeas = useMemo(() => [...localIdeas, ...ideas], [ideas, localIdeas]);
  const count = (statuses: string[]) => allIdeas.filter((idea) => statuses.includes(idea.status)).length;
  const metrics = [
    { label: 'IDEAS', value: allIdeas.length, href: `/${projectSlug}/ideas`, detail: 'Banco completo', tone: 'text-blanco' },
    { label: 'POR APROBAR', value: count(['pending_approval', 'needs_changes']), href: `/${projectSlug}/aprobaciones`, detail: 'Decisión del cliente', tone: 'text-orquidea' },
    { label: 'APROBADAS', value: count(downstream), href: `/${projectSlug}/produccion`, detail: 'Cliente dio luz verde', tone: 'text-mostaza' },
    { label: 'EN PRODUCCIÓN', value: count(production), href: `/${projectSlug}/produccion`, detail: 'Rodaje, edición o final', tone: 'text-mostaza' },
    { label: 'PUBLICADAS', value: count(['published']), href: `/${projectSlug}/publicaciones`, detail: 'Salida registrada', tone: 'text-fucsia' },
  ];
  return <main className="min-h-screen bg-negro"><div className="mx-auto max-w-7xl px-5 py-8 md:px-10"><section className="mb-8 flex flex-wrap items-end justify-between gap-6 border-b border-blanco-10 pb-8"><div><p className="eyebrow">[PROJECT_STATUS: ACTIVE] · {role.toUpperCase()}</p><h1 className="display-title">{project.name}<br/><em>OPERACIÓN.</em></h1><p className="mt-4 max-w-2xl text-sm leading-7 text-blanco-60">{project.description ?? 'Cada idea conserva su referencia, decisión de cliente, responsable y estado de producción.'}</p></div><div className="flex flex-wrap gap-3"><Link href={`/${projectSlug}/ideas`} className="btn-brutal">VER BANCO →</Link><Link href={`/${projectSlug}/ideas/nueva`} className="btn-brutal-mostaza">+ NUEVA IDEA</Link></div></section>
    <section aria-label="Estado del flujo" className="mb-12"><div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">[FLUJO DE CONTENIDO]</p><h2 className="section-heading mt-2">¿EN QUÉ MOMENTO ESTÁ CADA PIEZA?</h2></div><p className="font-mono text-[10px] text-blanco-40">TOCA UN INDICADOR PARA ABRIR SU COLA</p></div><div className="grid gap-px border-2 border-blanco bg-blanco sm:grid-cols-2 lg:grid-cols-5">{metrics.map((metric) => <Link key={metric.label} href={metric.href} className="group bg-negro p-5 transition-colors hover:bg-fucsia/10"><div className={`font-display text-5xl font-bold ${metric.tone}`}>{metric.value}</div><div className="mt-2 font-mono text-[10px] tracking-widest text-blanco">{metric.label} <span className="text-fucsia group-hover:text-mostaza">↗</span></div><p className="mt-2 text-xs leading-5 text-blanco-60">{metric.detail}</p></Link>)}</div></section>
    <section className="mb-12 grid gap-5 lg:grid-cols-[1.1fr_.9fr]"><div className="border-2 border-blanco p-5 sm:p-6"><p className="eyebrow">[REGLAS DEL FLUJO]</p><ol className="mt-5 grid gap-3 text-sm leading-6 text-blanco-60"><li><strong className="text-blanco">01 · IDEA.</strong> Se crea y se completa el brief.</li><li><strong className="text-blanco">02 · CLIENTE.</strong> Aprueba o solicita ajustes; nunca queda en un chat perdido.</li><li><strong className="text-blanco">03 · PRODUCCIÓN.</strong> Cámara, talento y edición reciben su parte del brief.</li><li><strong className="text-blanco">04 · PUBLICACIÓN.</strong> Solo se programa después de la revisión final.</li></ol></div><div className="border-2 border-mostaza bg-mostaza/5 p-5 sm:p-6"><p className="eyebrow">[PRÓXIMA ACCIÓN]</p><h2 className="mt-3 font-display text-3xl font-bold text-blanco">{count(['pending_approval', 'needs_changes']) ? 'DESBLOQUEA LAS DECISIONES DEL CLIENTE.' : 'COMPLETA LOS BRIEFS APROBADOS.'}</h2><p className="mt-4 text-sm leading-6 text-blanco-60">{count(['pending_approval', 'needs_changes']) ? `${count(['pending_approval', 'needs_changes'])} idea(s) requieren una respuesta antes de que el equipo pueda seguir.` : 'No hay decisiones de cliente pendientes en este momento.'}</p><Link className="mt-6 inline-block font-mono text-xs text-mostaza underline" href={`/${projectSlug}/aprobaciones`}>IR A APROBACIONES →</Link></div></section>
    <section><div className="mb-5 flex items-end justify-between border-b border-blanco-10 pb-3"><div><p className="eyebrow">[MOVIMIENTO RECIENTE]</p><h2 className="section-heading mt-2">IDEAS ACTIVAS</h2></div><Link className="mono-label text-mostaza" href={`/${projectSlug}/ideas`}>VER BANCO →</Link></div><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{allIdeas.slice(0, 6).map((idea) => <Link key={idea.id} href={`/${projectSlug}/ideas/${idea.id}`} className="brutal-panel group"><div className="mb-6 flex justify-between gap-3"><span className="mono-label text-mostaza">[{idea.code ?? 'NUEVA'} · {idea.content_type === 'organic' ? 'ORGÁNICO' : 'PAUTA'}]</span><StatusBadge status={idea.status}/></div><h3 className="font-display text-2xl font-bold text-blanco group-hover:text-fucsia">{idea.title}</h3><p className="mt-3 line-clamp-2 text-sm leading-6 text-blanco-60">{idea.description}</p><p className="mt-8 font-mono text-[10px] text-blanco-40">// {idea.category ?? 'SIN CATEGORÍA'}</p></Link>)}</div></section>
  </div></main>;
}
