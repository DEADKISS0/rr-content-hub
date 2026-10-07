'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { postWorkspaceAction, transitionIdeaStatus, type TimelineEvent } from '@/lib/workspace-client';
import { STATUS_META, TONE_CLASS, allowedTransitions, statusMeta, waitingOn, ROLE_KEYS, PUEDE_BORRAR, PUEDE_BORRAR_ESTADOS, type RoleKey, type WorkflowStatus } from '@/lib/flow';
import { PUBLIC_MODE } from '@/lib/mode';
import { perfilElegido, suscribirPerfil } from '@/lib/perfil-votante';

/**
 * Guided hand-off. The person sees where the piece is, who acts now, and at
 * most the moves their role may make. Every button states the concrete action
 * (ENVIAR A CLIENTE, no "siguiente") and, on click, the note previews what
 * happens next so nobody presses blind.
 */
export function IdeaActions({ projectSlug, ideaId, currentStatus = 'pending_approval', role = 'client_viewer' }: { projectSlug: string; ideaId: string; currentStatus?: string; role?: string }) {
  const [status, setStatus] = useState<WorkflowStatus>(currentStatus as WorkflowStatus);
  const [history, setHistory] = useState<TimelineEvent[]>([]);
  const [note, setNote] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [justChanged, setJustChanged] = useState(false);

  // El historial viene de la misma API que los comentarios y los archivos.
  // Antes lo leía `loadTimeline` con la clave anónima del navegador, que ya no
  // lee `rr_hub_events`: la línea de tiempo salía vacía sin decir nada.
  const refresh = useCallback(() => {
    fetch(`/api/workspace/pieza?ideaId=${encodeURIComponent(ideaId)}`, {
      cache: 'no-store', credentials: 'same-origin',
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((cuerpo) => { if (cuerpo?.timeline) setHistory(cuerpo.timeline); })
      .catch(() => {
        // Un refresco fallido no vacía lo que ya está en pantalla.
      });
  }, [ideaId]);

  useEffect(() => {
    const t0 = window.setTimeout(refresh, 0);
    // La pestaña oculta no pregunta. MEDIDO 2026-10-07: este sondeo era el unico
    // de los tres sin portón de visibilidad, así que una pestaña en segundo
    // plano seguía pegando al servidor cada 20 s con nadie mirando. Un mes de
    // eso son 129.600 llamadas por pestaña. Se reactiva al volver.
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, 20_000);
    const alVolver = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      window.clearTimeout(t0);
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [refresh]);
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
  const [rolServidor, setRolServidor] = useState<string | null>(null);

  /**
   * El rol REAL del perfil elegido, pedido al servidor al montar.
   *
   * MEDIDO 2026-10-04. Santiago: «asegúrate de que el perfil de los dos de
   * Wundeer puedan entrar desde esos perfiles y poder aprobar». El rol que llega
   * por prop lo resuelve `rolEnProyecto()`, que corre en el servidor ANTES de que
   * exista el perfil elegido: ese perfil vive en `localStorage`, o sea en el
   * navegador. Sin sesión de Google, `rolEnProyecto()` cae a `client_viewer` y
   * la ficha llegaba con «SIN ACCIÓN DISPONIBLE» — el botón de aprobar no existía,
   * ni para el cliente ni para nadie.
   *
   * La pregunta va con el correo del perfil elegido y la respuesta es el rol que
   * la base tiene para ese correo: no es el navegador pidiendo permiso, es
   * consultando el mismo dato que aplica la transición. Mientras no llegue, se
   * usa el rol de la prop, que es lo que había antes.
   */
  useEffect(() => {
    let vivo = true;
    const preguntar = async () => {
      const perfil = perfilElegido();
      if (!perfil) { setRolServidor(null); return; }
      const cuerpo = await postWorkspaceAction('mi-rol', {
        projectSlug, actorProfile: perfil.email,
      }).catch(() => null);
      if (vivo && cuerpo && typeof cuerpo.role === 'string') setRolServidor(cuerpo.role);
    };
    void preguntar();
    // El perfil puede cambiar con la página abierta (el selector está en
    // pantalla), así que se repregunta cuando llega el evento del perfil.
    const quitar = suscribirPerfil(() => { void preguntar(); });
    return () => { vivo = false; quitar(); };
  }, [projectSlug]);

  const rolEfectivo = rolServidor ?? role;
  const activeRole = (ROLE_KEYS.includes(rolEfectivo as RoleKey) ? rolEfectivo : 'client_viewer') as RoleKey;
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
  const confirmPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!armado) return;
    confirmPanelRef.current?.focus();
  }, [armado]);

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
            {armadoEste && armadoMeta && <div ref={confirmPanelRef} tabIndex={-1} role="group" aria-label="Confirmar cambio de estado" className="anim-slide-down mt-2 border border-blanco-40 bg-blanco-10 p-4 outline-none focus-visible:ring-2 focus-visible:ring-mostaza">
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

    <BorrarIdea ideaId={ideaId} rol={activeRole} estado={status} onNotice={setNotice} />
  </div>;
}

/**
 * Borrar la pieza.
 *
 * Santiago lo pidió el 2026-09-29. Aparece solo a `owner` y solo mientras la
 * idea sea borrador o revisión interna: una vez que se votó, se archivó.
 *
 * Tres cosas que este botón NO es:
 *
 * 1. **No es un `DELETE`.** Marca `archived_at` y `archived_by`. La idea sigue
 *    en la base con sus votos y sus comentarios. La razón está en la migración.
 * 2. **No es un clic.** Igual que los movimientos de fase, tiene dos pasos: el
 *    primero arma y explica, el segundo confirma. Borrar es la acción de la que
 *    más se arrepiente la gente.
 * 3. **No es para el que solo mira.** `PUEDE_BORRAR.includes(rol)`; el servidor
 *    vuelve a comprobarlo. Ocultar el botón es cortesía, no seguridad.
 *
 * Si la idea ya no está en un estado borrable, el servidor responde 409 y el
 * botón dice que se archive. Aquí solo se oculta para no ofrecer algo que va a
 * fallar.
 */
function BorrarIdea({ ideaId, rol, estado, onNotice }: {
  ideaId: string;
  rol: RoleKey;
  estado: WorkflowStatus;
  onNotice: (texto: string) => void;
}) {
  const [armado, setArmado] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const puedeBorrar = PUEDE_BORRAR.includes(rol) && PUEDE_BORRAR_ESTADOS.includes(estado);
  if (!puedeBorrar) return null;

  async function borrar() {
    if (busy) return;
    setBusy(true);
    const res = await fetch('/api/workspace/borrar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ ideaId }),
    });
    const cuerpo = await res.json().catch(() => ({}));
    setBusy(false);
    setArmado(false);
    if (!res.ok) {
      onNotice(`⚠ ${cuerpo.error ?? 'No se pudo borrar la idea.'}`);
      return;
    }
    onNotice(`✓ ${cuerpo.mensaje ?? 'Idea borrada.'}`);
    // Al volver al tablero, la idea ya no está. Un `router.refresh()` deja claro
    // que el cambio ocurrió en el servidor y no solo en esta pantalla.
    router.refresh();
  }

  return <div className="border-t border-blanco-20 pt-4">
    {!armado
      ? <button
        type="button"
        onClick={() => setArmado(true)}
        className="font-mono text-[10px] text-blanco-40 uppercase transition-colors hover:text-mostaza"
      >[ BORRAR ESTA IDEA ]</button>
      : <div className="anim-slide-down border border-mostaza-60 bg-mostaza-05 p-4">
        <p className="mono-label text-mostaza">[ESTO QUITA LA IDEA DEL TABLERO]</p>
        <p className="mt-2 text-xs leading-5 text-blanco-70">
          La idea desaparece del tablero. <strong className="text-blanco">No se borra de verdad</strong>:
          queda guardada con su historial, sus votos y sus comentarios, por si hay que recuperarla.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" disabled={busy} onClick={borrar} className="border border-mostaza px-4 py-2 font-display text-xs font-bold text-mostaza transition-colors hover:bg-mostaza hover:text-negro disabled:opacity-50">
            {busy ? 'BORRANDO…' : 'SÍ, QUITAR DEL TABLERO'}
          </button>
          <button type="button" onClick={() => setArmado(false)} className="font-mono text-xs text-blanco-60 underline transition-colors hover:text-blanco">
            CANCELAR
          </button>
        </div>
      </div>}
  </div>;
}
