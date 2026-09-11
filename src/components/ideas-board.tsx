'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { StatusBadge as Status } from './status-badge';
import { readLocalIdeas, subscribeWorkspace } from '@/lib/workspace-store';

type Idea = { id:string; code?:string; title:string; description?:string; content_type:string; category?:string; status:string; priority?:string; creator?:string; users?:{name?:string} };
const filters = [['all','TODAS'],['organic','ORGÁNICO'],['paid','PAUTA'],['pending','POR APROBAR'],['production','PRODUCCIÓN']] as const;
function matchesFilter(idea: Idea, filter: string) { if (filter === 'all') return true; if (filter === 'organic' || filter === 'paid') return idea.content_type === filter; if (filter === 'pending') return idea.status === 'pending_approval'; return ['approved','in_production','editing'].includes(idea.status); }

export function IdeasBoard({ ideas, projectSlug }: { ideas: Idea[]; projectSlug: string }) {
  const [localIdeas, setLocalIdeas] = useState<Idea[]>([]); const [filter, setFilter] = useState('all'); const [query, setQuery] = useState(''); const [selected, setSelected] = useState<string[]>([]);
  useEffect(() => { const sync = () => setLocalIdeas(readLocalIdeas(projectSlug)); sync(); return subscribeWorkspace(projectSlug, sync); }, [projectSlug]);
  const allIdeas = useMemo(() => [...localIdeas, ...ideas], [ideas, localIdeas]);
  const visible = useMemo(() => allIdeas.filter((idea) => matchesFilter(idea, filter) && `${idea.title} ${idea.description ?? ''} ${idea.category ?? ''}`.toLowerCase().includes(query.toLowerCase())), [allIdeas, filter, query]);
  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  return <div>
    {localIdeas.length > 0 && <div className="mb-4 border-l-2 border-mostaza bg-mostaza/10 px-4 py-3 font-mono text-[10px] leading-5 text-blanco-60">[WORKSPACE_MODE] Hay {localIdeas.length} idea(s) guardadas solo en este navegador, sin sincronizar. Vuelve a crearlas para que queden en el proyecto compartido.</div>}
    <div className="mb-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{filters.map(([key, label]) => <button key={key} onClick={() => setFilter(key)} className={`border-2 px-4 py-3 text-left font-mono text-[10px] tracking-widest ${filter === key ? 'border-fucsia bg-fucsia/10 text-blanco' : 'border-blanco-20 text-blanco-60 hover:border-mostaza'}`}>{label}<span className="ml-2 text-mostaza">{allIdeas.filter((idea) => matchesFilter(idea, key)).length}</span></button>)}</div>
    <div className="mb-8 flex flex-col gap-3 sm:flex-row"><label className="sr-only" htmlFor="idea-search">Buscar ideas</label><input id="idea-search" value={query} onChange={(event) => setQuery(event.target.value)} className="input-brutal flex-1" placeholder="Buscar por título, categoría o concepto..."/><span className="flex items-center font-mono text-xs text-blanco-40">{visible.length} RESULTADOS</span></div>
    {selected.length > 0 && <div className="mb-5 flex items-center justify-between border-2 border-mostaza bg-mostaza/10 p-4"><span className="font-mono text-xs text-mostaza">{selected.length} SELECCIONADAS PARA REVISIÓN</span><button onClick={() => setSelected([])} className="font-mono text-xs text-blanco underline">LIMPIAR</button></div>}
    <div className="space-y-3">{visible.map((idea) => <div key={idea.id} className={`idea-row group ${selected.includes(idea.id) ? 'border-fucsia bg-fucsia/10' : ''}`}><button aria-label={`Seleccionar ${idea.title}`} onClick={() => toggle(idea.id)} className={`h-5 w-5 shrink-0 border-2 ${selected.includes(idea.id) ? 'border-mostaza bg-mostaza' : 'border-blanco-40'}`}/><Link href={`/${projectSlug}/ideas/${idea.id}`} className="flex min-w-0 flex-1 items-center gap-4"><div className="w-12 shrink-0 font-display text-2xl text-fucsia">{idea.code ?? '—'}</div><div className="min-w-0 flex-1"><div className="mb-2 flex flex-wrap gap-3"><span className="mono-label text-mostaza">[{idea.content_type === 'organic' ? 'ORGÁNICO' : 'PAUTA'}]</span><Status status={idea.status}/></div><h3 className="font-display text-xl font-bold text-blanco group-hover:text-mostaza">{idea.title}</h3><p className="mt-1 truncate text-sm text-blanco-60">{idea.description}</p></div><div className="hidden text-right font-mono text-[10px] text-blanco-40 md:block">// {idea.category}<br/>// {idea.creator ?? idea.users?.name ?? 'RR ALIADOS'}</div><span className="font-mono text-xs text-fucsia">→</span></Link></div>)}{visible.length === 0 && <div className="brutal-panel py-16 text-center"><p className="eyebrow">[NO_RESULTS]</p><p className="mt-3 text-sm text-blanco-60">No encontramos ideas con esos filtros.</p><button onClick={() => { setFilter('all'); setQuery(''); }} className="mt-5 font-mono text-xs text-mostaza underline">LIMPIAR FILTROS</button></div>}</div>
  </div>;
}
