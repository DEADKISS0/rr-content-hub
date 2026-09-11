'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadTimeline, transitionIdeaStatus, type TimelineEvent } from '@/lib/workspace-client';

type WorkflowStatus =
  | 'draft' | 'pending_approval' | 'needs_changes' | 'approved'
  | 'script_in_progress' | 'pending_script_review' | 'script_approved'
  | 'in_production' | 'raw_uploaded' | 'editing' | 'ready_to_publish'
  | 'published' | 'closed';

type Step = { role: string; label: string; description: string; action: string; tone?: 'primary' | 'secondary' };
const steps: Record<WorkflowStatus, Step> = {
  draft: { role: 'OWNER / CREATIVA', label: 'PREPARAR PROPUESTA', description: 'Completa referencia y brief antes de mostrarla. El enlace genera la previsualización automáticamente.', action: 'ENVIAR IDEA AL CLIENTE →', tone: 'secondary' },
  pending_approval: { role: 'CLIENTE', label: 'DECISIÓN DE IDEA', description: 'El cliente aprueba, pide ajustes o archiva. Solo una idea aprobada puede pasar a guion.', action: 'APROBAR IDEA ✓' },
  needs_changes: { role: 'CREATIVA / OWNER', label: 'AJUSTAR PROPUESTA', description: 'Responde los comentarios, actualiza la referencia o el brief y vuelve a enviarla.', action: 'REENVIAR AL CLIENTE →', tone: 'secondary' },
  approved: { role: 'GUIÓN', label: 'GUIÓN DESBLOQUEADO', description: 'La idea fue aprobada. Ahora se redacta un guion operativo, humano y específico; nunca se publica una pieza directa desde la idea.', action: 'INICIAR GUIÓN →' },
  script_in_progress: { role: 'GUIÓN / OWNER', label: 'GUIÓN EN CONSTRUCCIÓN', description: 'Completa hook, secuencia, diálogos, tomas y cierre. Adjunta el archivo o escribe el enlace de Drive antes de enviarlo.', action: 'ENVIAR GUIÓN A CLIENTE →', tone: 'secondary' },
  pending_script_review: { role: 'CLIENTE', label: 'APROBACIÓN DE GUIÓN', description: 'El cliente valida lo que se grabará. Esta decisión evita rodajes con instrucciones ambiguas.', action: 'APROBAR GUIÓN ✓' },
  script_approved: { role: 'PRODUCCIÓN', label: 'LISTO PARA RODAJE', description: 'Cámara, talento y producción reciben sus instrucciones. Confirma fecha, locación y responsables antes de iniciar.', action: 'INICIAR PRODUCCIÓN →' },
  in_production: { role: 'CÁMARA / TALENTO', label: 'RODAJE EN CURSO', description: 'Sigue el brief, sube el material crudo y confirma que la captura está completa para relevar a edición.', action: 'MARCAR CRUDO CARGADO →' },
  raw_uploaded: { role: 'EDITOR', label: 'CRUDO LISTO PARA EDICIÓN', description: 'El material está centralizado. El editor verifica continuidad, crea V1 y mantiene las decisiones en el hilo.', action: 'INICIAR EDICIÓN →' },
  editing: { role: 'EDITOR', label: 'EDICIÓN EN CURSO', description: 'Sube V1/V2, conserva versiones y marca la pieza lista para revisión únicamente cuando cumpla el brief.', action: 'MARCAR EDICIÓN LISTA →' },
  ready_to_publish: { role: 'OWNER / CLIENTE', label: 'REVISIÓN FINAL', description: 'Revisa la versión final, copy y formato. Al aprobar, Publisher puede registrar la salida.', action: 'APROBAR PARA PUBLICAR ✓' },
  published: { role: 'PUBLISHER / PAUTA', label: 'PUBLICACIÓN REGISTRADA', description: 'Registra URL, fecha y plataforma. Luego cierra la pieza y conserva el aprendizaje para próximas ideas.', action: 'CERRAR FLUJO →', tone: 'secondary' },
  closed: { role: 'RR ALIADOS', label: 'FLUJO CERRADO', description: 'La pieza conserva todo su historial: referencia, decisiones, guion, crudo, versiones y publicación.', action: 'FLUJO COMPLETADO' },
};

function nextStatus(status: WorkflowStatus): WorkflowStatus {
  const map: Partial<Record<WorkflowStatus, WorkflowStatus>> = { draft: 'pending_approval', needs_changes: 'pending_approval', approved: 'script_in_progress', script_in_progress: 'pending_script_review', script_approved: 'in_production', in_production: 'raw_uploaded', raw_uploaded: 'editing', editing: 'ready_to_publish', ready_to_publish: 'published', published: 'closed' };
  return map[status] ?? status;
}

export function IdeaActions({ ideaId, currentStatus = 'pending_approval' }: { projectSlug: string; ideaId: string; currentStatus?: string }) {
  const [status, setStatus] = useState<WorkflowStatus>(currentStatus as WorkflowStatus);
  const [history, setHistory] = useState<TimelineEvent[]>([]);
  const [note, setNote] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => { loadTimeline(ideaId).then(setHistory); }, [ideaId]);
  useEffect(() => { const timer = window.setTimeout(refresh, 0); return () => window.clearTimeout(timer); }, [refresh]);

  const step = useMemo(() => steps[status] ?? steps.draft, [status]);

  async function act(target: WorkflowStatus, actor: string, fallback: string) {
    setBusy(true);
    const { error } = await transitionIdeaStatus({ ideaId, fromStatus: status, toStatus: target, note: note.trim() || fallback });
    setBusy(false);
    if (error) { setNotice(`No se pudo registrar el cambio: ${error}`); return; }
    setStatus(target);
    setNotice(`LISTO: ${steps[target].label}. El siguiente relevo ya puede actuar.`);
    setNote('');
    refresh();
  }

  const isClientDecision = status === 'pending_approval' || status === 'pending_script_review';

  return <div className="space-y-4" aria-live="polite">
    <div className="border-l-2 border-mostaza bg-blanco-05 p-4"><p className="mono-label text-mostaza">[AHORA · {step.role}]</p><h3 className="mt-2 font-display text-xl font-bold text-blanco">{step.label}</h3><p className="mt-2 text-sm leading-6 text-blanco-60">{step.description}</p></div>
    {notice && <div role="status" className="border-2 border-mostaza bg-mostaza/10 p-3 font-mono text-xs leading-5 text-blanco">{notice.startsWith('No se pudo') ? '⚠' : '✓'} {notice}</div>}
    {status !== 'closed' && <>
      <label className="block"><span className="mono-label mb-2 block text-mostaza">// NOTA PARA EL SIGUIENTE RELEVO</span><textarea value={note} onChange={(event) => setNote(event.target.value)} className="input-brutal min-h-24" placeholder="Añade contexto, confirmaciones o cambios relevantes…" /></label>
      {isClientDecision
        ? <div className="grid gap-3"><button disabled={busy} onClick={() => act(nextStatus(status), step.role, step.description)} className="btn-brutal w-full">{step.action}</button><button disabled={busy} onClick={() => act('needs_changes', 'CLIENTE', 'El cliente solicitó ajustes antes de continuar.')} className="w-full border-2 border-orquidea bg-orquidea/10 px-5 py-3 font-display font-bold text-blanco">SOLICITAR AJUSTES</button><button disabled={busy} onClick={() => act('closed', 'CLIENTE', 'El cliente archivó esta propuesta.')} className="w-full border border-blanco-20 px-5 py-3 font-mono text-xs text-blanco-60">ARCHIVAR PROPUESTA</button></div>
        : <button disabled={busy} onClick={() => act(nextStatus(status), step.role, step.description)} className={step.tone === 'secondary' ? 'btn-brutal-mostaza w-full' : 'btn-brutal w-full'}>{busy ? 'REGISTRANDO…' : step.action}</button>}
    </>}
    {history.length > 0 && <details className="border-t border-blanco-20 pt-4"><summary className="cursor-pointer font-mono text-[10px] text-blanco-60">VER TRAZABILIDAD ({history.length})</summary><ol className="mt-3 space-y-3">{history.map((event) => <li key={event.id} className="border-l border-fucsia pl-3"><p className="font-mono text-[10px] text-mostaza">{event.createdAt} · {event.actor}</p><p className="mt-1 font-mono text-[10px] text-blanco">[{steps[event.status as WorkflowStatus]?.label ?? event.status}]</p><p className="mt-1 text-xs leading-5 text-blanco-60">{event.note}</p></li>)}</ol></details>}
  </div>;
}
