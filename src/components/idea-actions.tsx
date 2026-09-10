'use client';

import { useState } from 'react';
import { updateLocalIdea } from '@/lib/workspace-store';

type State = 'idle' | 'approved' | 'changes' | 'sent';
export function IdeaActions({ projectSlug, ideaId, currentStatus = 'pending_approval' }: { projectSlug?: string; ideaId?: string; currentStatus?: string }) {
  const [state, setState] = useState<State>(currentStatus === 'approved' ? 'approved' : 'idle'); const [comment, setComment] = useState('');
  const persist = (status: string) => { if (projectSlug && ideaId?.startsWith('local-')) updateLocalIdea(projectSlug, ideaId, { status }); };
  const approve = () => { persist('approved'); setState('approved'); };
  const requestChanges = () => { if (!comment.trim()) return; persist('needs_changes'); setState('changes'); };
  const send = () => { persist('pending_approval'); setState('sent'); };
  if (state === 'approved') return <div className="border-2 border-mostaza bg-mostaza/10 p-4"><p className="font-mono text-xs text-mostaza">[APROBADA]</p><p className="mt-2 text-sm leading-6 text-blanco-60">La idea queda lista para que producción complete el brief y programe el rodaje.</p></div>;
  if (state === 'sent') return <div className="border-2 border-orquidea bg-orquidea/10 p-4"><p className="font-mono text-xs text-orquidea">[ENVIADA_A_CLIENTE]</p><p className="mt-2 text-sm leading-6 text-blanco-60">La decisión del cliente quedará registrada en el historial cuando conectemos Supabase.</p></div>;
  return <div className="space-y-4">{state === 'idle' ? <><button onClick={send} className="btn-brutal-mostaza w-full">ENVIAR A REVISIÓN →</button><button onClick={approve} className="btn-brutal w-full">APROBAR IDEA ✓</button><button onClick={() => setState('changes')} className="w-full border-2 border-orquidea px-5 py-3 font-display font-bold text-orquidea">SOLICITAR AJUSTES</button></> : <div className="border-2 border-orquidea bg-orquidea/10 p-4"><p className="font-mono text-xs text-orquidea">[SOLICITAR_AJUSTES]</p><textarea value={comment} onChange={(event) => setComment(event.target.value)} className="input-brutal mt-4 min-h-24" placeholder="Explica qué se debe ajustar antes de aprobar..."/><button onClick={requestChanges} className="btn-brutal mt-4 w-full" disabled={!comment.trim()}>ENVIAR AJUSTES →</button><button onClick={() => setState('idle')} className="mt-4 font-mono text-xs text-mostaza underline">CANCELAR</button></div>}<a href="#collaboration-title" className="block w-full border border-blanco-20 px-5 py-3 text-center font-mono text-xs text-blanco-60">ABRIR COMENTARIOS</a></div>;
}
