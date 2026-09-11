'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadTimeline, transitionIdeaStatus, type TimelineEvent } from '@/lib/workspace-client';
import { STATUS_LABEL, allowedTransitions, waitingOn, type RoleKey, type WorkflowStatus } from '@/lib/flow';
import { PUBLIC_MODE } from '@/lib/mode';

/**
 * Guided hand-off. Instead of the 13-state map, the person sees where the piece
 * is and at most the two buttons their role is allowed to press.
 *
 * In public mode the same information is shown with no write controls: the
 * viewer sees the exact state and next moves, but nothing can be changed.
 */
export function IdeaActions({ ideaId, currentStatus = 'pending_approval', role = 'owner' }: { projectSlug: string; ideaId: string; currentStatus?: string; role?: string }) {
  const [status, setStatus] = useState<WorkflowStatus>(currentStatus as WorkflowStatus);
  const [history, setHistory] = useState<TimelineEvent[]>([]);
  const [note, setNote] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => { loadTimeline(ideaId).then(setHistory); }, [ideaId]);
  useEffect(() => { const timer = window.setTimeout(refresh, 0); return () => window.clearTimeout(timer); }, [refresh]);

  const moves = useMemo(() => allowedTransitions(role as RoleKey, status), [role, status]);
  const waiting = waitingOn(status);
  const done = status === 'closed';

  async function run(target: WorkflowStatus, label: string, note: string) {
    setBusy(true);
    const { error } = await transitionIdeaStatus({ ideaId, fromStatus: status, toStatus: target, note: note.trim() || label });
    setBusy(false);
    if (error) { setNotice(`⚠ No se pudo registrar: ${error}`); return; }
    setStatus(target);
    setNote('');
    setNotice(`✓ ${label}. El siguiente relevo ya puede actuar.`);
    refresh();
  }

  return <div className="space-y-4" aria-live="polite">
    <div className="border-l-2 border-mostaza bg-blanco-05 p-4">
      <p className="mono-label text-mostaza">[DÓNDE ESTÁ ESTA PIEZA]</p>
      <h3 className="mt-2 font-display text-xl font-bold text-blanco">{STATUS_LABEL[status] ?? status}</h3>
      {!done && <p className="mt-2 text-sm leading-6 text-blanco-60">Ahora le toca a <strong className="text-mostaza">{waiting}</strong>. {moves.length ? (PUBLIC_MODE ? 'Los movimientos posibles están listados abajo.' : 'Tu rol puede avanzarla:') : 'No es tu turno todavía: puedes seguir el hilo y comentar.'}</p>}
      {done && <p className="mt-2 text-sm leading-6 text-blanco-60">Esta pieza conserva todo su historial: referencia, decisiones, guion, crudo, versiones y publicación.</p>}
    </div>

    {notice && <div role="status" className="border-2 border-mostaza bg-mostaza/10 p-3 font-mono text-xs leading-5 text-blanco">{notice}</div>}

    {PUBLIC_MODE ? (moves.length > 0 && <div className="border-2 border-blanco-20 p-4">
      <p className="mono-label text-mostaza">[MOVIMIENTOS POSIBLES · MODO PÚBLICO]</p>
      <ul className="mt-3 space-y-2">{moves.map((move) => <li key={move.to} className="font-mono text-[10px] text-blanco-60">→ {move.label} <span className="text-blanco-40">({STATUS_LABEL[move.to]})</span></li>)}</ul>
      <p className="mt-3 border-t border-blanco-20 pt-3 font-mono text-[10px] leading-5 text-blanco-40">Solo lectura. Para ejecutar estos cambios hay que entrar con una cuenta autorizada por RR ALIADOS.</p>
    </div>) : <>
      {moves.length > 0 && <>
        <label className="block"><span className="mono-label mb-2 block text-mostaza">// NOTA PARA EL SIGUIENTE RELEVO (OPCIONAL)</span><textarea value={note} onChange={(event) => setNote(event.target.value)} className="input-brutal min-h-20" placeholder="Contexto, confirmaciones o cambios relevantes…" /></label>
        <div className="grid gap-3">
          {moves.map((move, index) => <button key={move.to} disabled={busy} onClick={() => run(move.to, move.label, move.note)} className={`w-full px-5 py-4 font-display font-bold ${index === 0 ? 'btn-brutal' : 'border-2 border-orquidea bg-orquidea/10 text-blanco'}`}>{busy ? 'REGISTRANDO…' : move.label}</button>)}
        </div>
      </>}
    </>}

    {history.length > 0 && <details className="border-t border-blanco-20 pt-4">
      <summary className="cursor-pointer font-mono text-[10px] text-blanco-60">VER TRAZABILIDAD ({history.length})</summary>
      <ol className="mt-3 space-y-3">{history.map((event) => <li key={event.id} className="border-l border-fucsia pl-3"><p className="font-mono text-[10px] text-mostaza">{event.createdAt} · {event.actor}</p><p className="mt-1 font-mono text-[10px] text-blanco">[{STATUS_LABEL[event.status as WorkflowStatus] ?? event.status}]</p><p className="mt-1 text-xs leading-5 text-blanco-60">{event.note}</p></li>)}</ol>
    </details>}
  </div>;
}
