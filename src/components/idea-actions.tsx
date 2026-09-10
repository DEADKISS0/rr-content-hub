'use client';
import { useState } from 'react';

export function IdeaActions() {
  const [state, setState] = useState<'idle'|'approved'|'changes'>('idle');
  const [comment, setComment] = useState('');
  return <div className="space-y-4">
    {state === 'idle' ? <>
      <button onClick={() => setState('approved')} className="btn-brutal w-full">APROBAR IDEA ✓</button>
      <button onClick={() => setState('changes')} className="w-full border-2 border-orquidea px-5 py-3 font-display font-bold text-orquidea">SOLICITAR AJUSTES</button>
    </> : <div className="border-2 border-mostaza bg-mostaza/10 p-4"><p className="font-mono text-xs text-mostaza">{state === 'approved' ? '[APPROVAL_PENDING_SYNC]' : '[CHANGES_REQUESTED]'}</p><p className="mt-2 text-sm text-blanco">{state === 'approved' ? 'La aprobación quedó preparada. En modo real se guardará en el historial.' : 'Describe qué debe ajustar el equipo.'}</p>{state === 'changes' && <textarea value={comment} onChange={e=>setComment(e.target.value)} className="input-brutal mt-4 min-h-24" placeholder="Comentario para RR Aliados..."/>}<button onClick={()=>setState('idle')} className="mt-4 font-mono text-xs text-mostaza underline">CANCELAR</button></div>}
    <button className="w-full border border-blanco-20 px-5 py-3 font-mono text-xs text-blanco-60">ABRIR COMENTARIOS</button>
  </div>;
}
