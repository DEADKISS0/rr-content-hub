'use client';

import { useMemo, useState } from 'react';
import { FlowBoard } from './flow-board';

type Idea = { id: string; title: string; description?: string; content_type: string; category?: string; status: string };
const filters = [['all', 'TODAS'], ['organic', 'ORGÁNICO'], ['paid', 'PAUTA'], ['pending', 'ESPERAN RESPUESTA']] as const;
function matches(idea: Idea, filter: string) { if (filter === 'all') return true; if (filter === 'organic' || filter === 'paid') return idea.content_type === filter; if (filter === 'pending') return ['pending_approval', 'pending_script_review', 'ready_to_publish'].includes(idea.status); return true; }

export function IdeasBoard({ ideas, projectSlug }: { ideas: Idea[]; projectSlug: string }) {
  const [filter, setFilter] = useState('all'); const [query, setQuery] = useState('');
  const visible = useMemo(() => ideas.filter((idea) => matches(idea, filter) && `${idea.title} ${idea.description ?? ''} ${idea.category ?? ''}`.toLowerCase().includes(query.toLowerCase())), [ideas, filter, query]);
  return <div><div className="mb-6 grid gap-2 sm:grid-cols-4">{filters.map(([key, label]) => <button key={key} onClick={() => setFilter(key)} className={`border-2 px-4 py-3 text-left font-mono text-[10px] tracking-widest transition-colors ${filter === key ? 'border-mostaza bg-mostaza text-negro' : 'border-blanco-20 text-blanco-60 hover:border-mostaza'}`}>{label}<span className="ml-2">{ideas.filter((idea) => matches(idea, key)).length}</span></button>)}</div><div className="mb-8 flex flex-col gap-3 sm:flex-row"><label className="sr-only" htmlFor="idea-search">Buscar ideas</label><input id="idea-search" value={query} onChange={(event) => setQuery(event.target.value)} className="input-brutal flex-1" placeholder="Busca una pieza..."/><span className="flex items-center font-mono text-xs text-blanco-40">{visible.length} RESULTADOS</span></div><FlowBoard ideas={visible} projectSlug={projectSlug}/></div>;
}
