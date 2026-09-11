'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadTimeline, transitionIdeaStatus, type TimelineEvent } from '@/lib/workspace-client';
import { STATUS_META, TONE_CLASS, allowedTransitions, statusMeta, waitingOn, type WorkflowStatus } from '@/lib/flow';
import { createClient } from '@/lib/supabase/client';

/**
 * Guided hand-off. The person sees where the piece is, who acts now, and at
 * most the moves their role may make. Every button states the concrete action
 * (ENVIAR A CLIENTE, no "siguiente") and, on click, the note previews what
 * happens next so nobody presses blind.
 */
export function IdeaActions({ ideaId, currentStatus = 'pending_approval' }: { projectSlug: string; ideaId: string; currentStatus?: string; role?: string }) {
  const [status, setStatus] = useState<WorkflowStatus>(currentStatus as WorkflowStatus);
  const [history, setHistory] = useState<TimelineEvent[]>([]);
  const [note, setNote] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [justChanged, setJustChanged] = useState(false);

  const refresh = useCallback(() => { loadTimeline(ideaId).then(setHistory); }, [ideaId]);
  useEffect(() => { const timer = window.setTimeout(refresh, 0); return () => window.clearTimeout(timer); }, [refresh]);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    const channel = supabase.channel(`wundeer-idea-${ideaId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rr_hub_ideas', filter: `id=eq.${ideaId}` }, (payload) => {
        const nextStatus = payload.new.status as WorkflowStatus | undefined;
        if (nextStatus) setStatus(nextStatus);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rr_hub_events', filter: `idea_id=eq.${ideaId}` }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [ideaId, refresh]);

  const activeRole = 'owner' as const;
  const moves = useMemo(() => allowedTransitions(activeRole, status), [status]);
  const waiting = waitingOn(status);
  const meta = statusMeta(status);
  const tone = TONE_CLASS[meta.tone];
  const done = status === 'closed';

  async function run(target: WorkflowStatus, label: string, note: string) {
    if (busy) return; // double-click guard: one in-flight transition at a time
    setBusy(true);
    const { error } = await transitionIdeaStatus({ ideaId, fromStatus: status, toStatus: target, note: note.trim() || label, role: activeRole });
    setBusy(false);
    if (error) { setNotice(`⚠ No se pudo registrar: ${error}`); return; }
    setStatus(target);
    setNote('');
    setJustChanged(true);
    window.setTimeout(() => setJustChanged(false), 2000);
    setNotice(`✓ ${label}. Ahora le toca a ${waitingOn(target)}.`);
    refresh();
  }

  const nextStep = moves[0] ? statusMeta(moves[0].to) : null;

  return <div className="space-y-4" aria-live="polite">
    <div className={`border-l-4 ${tone.border} ${tone.bg} p-5 ${justChanged ? 'anim-highlight' : ''}`}>
      <p className="mono-label text-mostaza">[DÓNDE ESTÁ ESTA PIEZA]</p>
      <div className="mt-3 flex items-center gap-3">
        <span className={`text-2xl ${tone.text}`} aria-hidden>{meta.icon}</span>
        <h3 className={`font-display text-2xl font-bold ${tone.text}`}>{meta.label}</h3>
      </div>
      <p className="mt-3 text-sm leading-6 text-blanco-60">{meta.blurb}</p>
      {!done && <p className="mt-3 border-t border-blanco-20 pt-3 text-sm leading-6 text-blanco-60">Ahora le toca a <strong className="text-mostaza">{waiting}</strong>.</p>}
    </div>

    {notice && <div role="status" className="border-2 border-mostaza bg-mostaza/10 p-3 font-mono text-xs leading-5 text-blanco anim-pop">{notice}</div>}

    {moves.length > 0 ? <>
        <label className="block"><span className="mono-label mb-2 block text-mostaza">// NOTA PARA EL SIGUIENTE RELEVO (OPCIONAL)</span><textarea value={note} onChange={(event) => setNote(event.target.value)} className="input-brutal min-h-20" placeholder="Contexto, confirmaciones o cambios relevantes…" /></label>
        <div className="grid gap-3">
          {moves.map((move, index) => {
            const moveMeta = statusMeta(move.to);
            return <button key={move.to} disabled={busy} onClick={() => run(move.to, move.label, move.note)} className={`w-full px-5 py-4 text-left font-display font-bold ${index === 0 ? 'btn-brutal' : 'border-2 border-orquidea bg-orquidea/10 text-blanco'} ${busy ? 'opacity-60' : ''}`}>
              <span className="block">{busy ? 'REGISTRANDO…' : move.label}</span>
              <span className="mt-1 block font-mono text-[10px] font-normal opacity-80">→ deja la pieza en {moveMeta.label} · le tocará a {moveMeta.who}</span>
            </button>;
          })}
        </div>
        {nextStep && <div className="border-2 border-blanco-20 p-4">
          <p className="mono-label text-mostaza">[DESPUÉS DE ESTO]</p>
          <p className="mt-2 text-xs leading-5 text-blanco-60">La pieza queda en <strong className="text-blanco">{nextStep.label}</strong> y el siguiente relevo es <strong className="text-blanco">{nextStep.who}</strong>. {nextStep.blurb}</p>
        </div>}
      </> : <div className="border-2 border-dashed border-blanco-20 p-4">
        <p className="mono-label text-mostaza">[SIN ACCIÓN DISPONIBLE]</p>
        <p className="mt-2 text-xs leading-5 text-blanco-60">Esta pieza no tiene un movimiento pendiente en este estado. Puedes seguir el hilo y comentar; cuando el estado cambie, aparecerá aquí la acción.</p>
      </div>}

    {history.length > 0 && <details className="border-t border-blanco-20 pt-4" open>
      <summary className="cursor-pointer font-mono text-[10px] text-blanco-60">VER TRAZABILIDAD ({history.length})</summary>
      <ol className="mt-3 space-y-3">{history.map((event) => <li key={event.id} className="border-l-2 border-fucsia pl-3 anim-slide">
        <p className="font-mono text-[10px] text-mostaza">{event.createdAt} · <span className="text-blanco">{event.actor}</span></p>
        <p className="mt-1 font-mono text-[10px] text-blanco-60">[{STATUS_META[event.status as WorkflowStatus]?.label ?? event.status}]</p>
        <p className="mt-1 text-xs leading-5 text-blanco-60">{event.note}</p>
      </li>)}</ol>
    </details>}
  </div>;
}
