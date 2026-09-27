'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadTimeline, transitionIdeaStatus, type TimelineEvent } from '@/lib/workspace-client';
import { STATUS_META, TONE_CLASS, allowedTransitions, statusMeta, waitingOn, ROLE_KEYS, type RoleKey, type WorkflowStatus } from '@/lib/flow';
import { PUBLIC_MODE } from '@/lib/mode';
import { createClient } from '@/lib/supabase/client';

/**
 * Guided hand-off. The person sees where the piece is, who acts now, and at
 * most the moves their role may make. Every button states the concrete action
 * (ENVIAR A CLIENTE, no "siguiente") and, on click, the note previews what
 * happens next so nobody presses blind.
 */
export function IdeaActions({ ideaId, currentStatus = 'pending_approval', role = 'client_viewer' }: { projectSlug: string; ideaId: string; currentStatus?: string; role?: string }) {
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

  /**
   * `readOnly` no puede depender de `PUBLIC_MODE`.
   *
   * Estaba escrito como `PUBLIC_MODE || activeRole === 'client_viewer'`, así que
   * al abrir el hub (mientras el login de Google peleaba con Medellín Guide) se
   * desactivó TODA transición del producto: las 25 piezas-mostraban "SIN ACCIÓN
   * DISPONIBLE" y no había forma de mover nada. El modo abierto gobierna la
   * PUERTA —si te piden cuenta o no—; los ROLES son del servidor, que sigue
   * siendo el único que valida si una transición es legal. Por eso aquí solo
   * cuenta el rol: quien el servidor diga que es `client_viewer` no mueve nada,
   * y quien diga que tiene un rol sí lo hace, con o sin sesión.
   */
  const activeRole = (ROLE_KEYS.includes(role as RoleKey) ? role : 'client_viewer') as RoleKey;
  const moves = useMemo(() => allowedTransitions(activeRole, status), [activeRole, status]);
  const readOnly = activeRole === 'client_viewer';
  const waiting = waitingOn(status);
  const meta = statusMeta(status);
  const tone = TONE_CLASS[meta.tone];
  const done = status === 'closed';

  /**
   * Confirmación en dos pasos.
   *
   * Un clic movía la pieza de verdad: la aprobaba, la mandaba a cliente, la
   * cerraba. Con 25 piezas y aprobaciones de un solo toque, un dedazo en móvil
   * cambiaba el estado de una pieza que llevaba 16 días esperando y no había
   * forma de volver atrás. Ahora el primer clic solo arma, y el botón dice
   * exactamente qué va a pasar y a quién le toca después. El segundo clic
   * confirma; Escape o un clic fuera cancelan.
   */
  const [armado, setArmado] = useState<WorkflowStatus | null>(null);

  async function run(target: WorkflowStatus, label: string, note: string) {
    if (busy) return; // double-click guard: one in-flight transition at a time
    setBusy(true);
    const { error } = await transitionIdeaStatus({ ideaId, fromStatus: status, toStatus: target, note: note.trim() || label, role: activeRole });
    setBusy(false);
    if (error) { setNotice(`⚠ No se pudo registrar: ${error}`); setArmado(null); return; }
    setStatus(target);
    setNote('');
    setArmado(null);
    setJustChanged(true);
    window.setTimeout(() => setJustChanged(false), 2000);
    setNotice(`✓ ${label}. Ahora le toca a ${waitingOn(target)}.`);
    refresh();
  }

  function confirmar(tecla: React.KeyboardEvent) {
    if (tecla.key === 'Escape' && armado) { setArmado(null); setNotice(''); }
  }

  const nextStep = moves[0] ? statusMeta(moves[0].to) : null;
  const armadoMeta = armado ? statusMeta(armado) : null;

  return <div className="space-y-4" aria-live="polite">
    <div className={`border-l-4 ${tone.border} ${tone.bg} p-5 ${justChanged ? 'anim-highlight' : ''}`}>
      <p className="mono-label text-blanco-50">[DÓNDE ESTÁ ESTA PIEZA]</p>
      <div className="mt-3 flex items-center gap-3">
        <span className={`text-2xl ${tone.text}`} aria-hidden>{meta.icon}</span>
        <h3 className={`font-display text-2xl font-bold ${tone.text}`}>{meta.label}</h3>
      </div>
      <p className="mt-3 text-sm leading-6 text-blanco-60">{meta.blurb}</p>
      {!done && <p className="mt-3 border-t border-blanco-20 pt-3 text-sm leading-6 text-blanco-60">Ahora le toca a <strong className="text-blanco">{waiting}</strong>.</p>}
    </div>

    {notice && <div role="status" className="border border-blanco-20 bg-blanco-05 p-3 font-mono text-xs leading-5 text-blanco anim-pop">{notice}</div>}

    {moves.length > 0 && !readOnly ? <>
      <label className="block"><span className="mono-label mb-2 block text-blanco-50">// NOTA PARA EL SIGUIENTE RELEVO (OPCIONAL)</span><textarea value={note} onChange={(event) => setNote(event.target.value)} className="input-brutal min-h-20" placeholder="Contexto, confirmaciones o cambios relevantes…" /></label>
      <div className={`grid gap-3 ${busy ? 'pointer-events-none opacity-60' : ''}`} onKeyDown={confirmar} role="group" aria-label="Movimientos disponibles">
        {moves.map((move, index) => {
          const moveMeta = statusMeta(move.to);
          const armadoEste = armado === move.to;
          return <div key={move.to}>
            <button
              disabled={busy}
              onClick={() => (armadoEste ? run(move.to, move.label, move.note) : (setArmado(move.to), setNotice('')))}
              aria-expanded={armadoEste}
              className={`w-full px-5 py-4 text-left font-display font-bold ${index === 0 ? 'btn-brutal' : 'border border-blanco-20 bg-blanco-05 text-blanco-80'} transition-transform duration-150 active:translate-y-px`}
            >
              <span className="block">{busy && armadoEste ? 'REGISTRANDO…' : move.label}</span>
              <span className="mt-1 block font-mono text-[10px] font-normal opacity-80">→ deja la pieza en {moveMeta.label} · le tocará a {moveMeta.who}</span>
            </button>
            {armadoEste && armadoMeta && <div className="anim-slide-down mt-2 border border-blanco-40 bg-blanco-10 p-4">
              <p className="mono-label text-blanco-60">[CONFIRMA ANTES]</p>
              <p className="mt-2 text-sm leading-6 text-blanco-70">
                Vas a mover <strong className="text-blanco">{meta.label}</strong> a <strong className="text-blanco">{armadoMeta.label}</strong>.
                Esta acción escribe en el historial y no se puede deshacer: si te equivocaste, avisa en el hilo de abajo.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => run(move.to, move.label, move.note)} className="btn-brutal">SÍ, MOVER AHORA</button>
                <button type="button" onClick={() => { setArmado(null); setNotice(''); }} className="font-mono text-xs text-blanco-60 underline transition-colors hover:text-blanco">CANCELAR (ESC)</button>
              </div>
            </div>}
          </div>;
        })}
      </div>
      {nextStep && <div className="border border-blanco-20 p-4">
        <p className="mono-label text-blanco-50">[DESPUÉS DE ESTO]</p>
        <p className="mt-2 text-xs leading-5 text-blanco-60">La pieza queda en <strong className="text-blanco">{nextStep.label}</strong> y el siguiente relevo es <strong className="text-blanco">{nextStep.who}</strong>. {nextStep.blurb}</p>
      </div>}
    </> : <div className="border border-dashed border-blanco-20 p-4">
      <p className="mono-label text-blanco-50">[SIN ACCIÓN DISPONIBLE]</p>
      <p className="mt-2 text-xs leading-5 text-blanco-60">Esta pieza no tiene un movimiento pendiente en este estado. Puedes seguir el hilo y comentar; cuando el estado cambie, aparecerá aquí la acción.</p>
    </div>}

    {history.length > 0 && <details className="border-t border-blanco-20 pt-4" open>
      <summary className="cursor-pointer font-mono text-[10px] text-blanco-60">VER TRAZABILIDAD ({history.length})</summary>
      <ol className="mt-3 space-y-3">{history.map((event) => {
        /**
         * Un evento con `from_status === to_status` NO es una transición: es un
         * cambio de metadata (asignar un responsable, por ejemplo). Mostrarlo
         * como un movimiento de fase mentiría: se vería "[BORRADOR] → [BORRADOR]"
         * y alguien leería que la pieza retrocedió y volvió. Por eso se marca
         * aparte, y con orquídea: es información, no un cambio de turno.
         */
        const soloMetadata = event.fromStatus !== undefined
          && event.fromStatus !== null
          && event.fromStatus === event.status;
        return <li key={event.id} className="border-l-2 border-blanco-20 pl-3 anim-slide">
        <p className="font-mono text-[10px] text-blanco-50">{event.createdAt} · <span className="text-blanco">{event.actor}</span></p>
        <p className="mt-1 font-mono text-[10px] text-blanco-60">
          {soloMetadata
            ? <span className="text-orquidea">SIN CAMBIO DE FASE</span>
            : <>[{STATUS_META[event.status as WorkflowStatus]?.label ?? event.status}]</>}
        </p>
        <p className="mt-1 text-xs leading-5 text-blanco-60">{event.note}</p>
      </li>; })}</ol>
    </details>}
  </div>;
}
