'use client';

import { useState } from 'react';
import { ROLE_LABEL, type RoleKey } from '@/lib/flow';
import { useActiveRole } from '@/lib/role-client';
import { saveIdeaScript } from '@/lib/workspace-client';

type Props = {
  ideaId: string;
  objective: string;
  camera: string;
  talent: string;
  edit: string;
  script: string;
};

const roleGuide: Record<RoleKey, { eyebrow: string; title: string; copy: string; field: 'objective' | 'camera' | 'talent' | 'edit' | 'script' }> = {
  owner: { eyebrow: 'CONTROL DEL FLUJO', title: 'CONFIRMA EL SIGUIENTE RELEVO.', copy: 'Revisa el contexto y deja una decisión clara para que la pieza no se detenga.', field: 'objective' },
  creator: { eyebrow: 'MESA DE IDEACIÓN', title: 'CONVIERTE LA REFERENCIA EN UNA PIEZA EJECUTABLE.', copy: 'Ajusta el guion propuesto y deja el contexto que necesita el cliente y producción.', field: 'script' },
  camera: { eyebrow: 'BRIEF DE PRODUCCIÓN', title: 'ASÍ SE GRABA ESTA PIEZA.', copy: 'No improvises la intención: este es el plan que debes llevar al set.', field: 'camera' },
  model: { eyebrow: 'BRIEF DE MODELAJE', title: 'ASÍ SE INTERPRETA ESTA PIEZA.', copy: 'Revisa actitud, continuidad y referencia antes de entrar a cámara.', field: 'talent' },
  editor: { eyebrow: 'BRIEF DE EDICIÓN', title: 'ASÍ SE CONSTRUYE EL CORTE.', copy: 'Conserva la intención, ritmo y cierre definidos por el equipo creativo.', field: 'edit' },
  publisher: { eyebrow: 'SALIDA DE LA PIEZA', title: 'PREPARA LA PUBLICACIÓN.', copy: 'Revisa que el guion y la referencia se hayan resuelto antes de programar.', field: 'script' },
  media_buyer: { eyebrow: 'LECTURA DE PAUTA', title: 'CONECTA LA PIEZA CON EL OBJETIVO.', copy: 'Usa el objetivo para definir audiencia, hipótesis y resultado esperado.', field: 'objective' },
  client_approver: { eyebrow: 'DECISIÓN DE CLIENTE', title: 'ESTO ES LO QUE VAS A APROBAR.', copy: 'Mira referencia, objetivo y guion. Si algo no representa la marca, déjalo escrito en comentarios.', field: 'script' },
  client_viewer: { eyebrow: 'VISTA DE CLIENTE', title: 'ASÍ AVANZA ESTA PIEZA.', copy: 'Puedes revisar toda la decisión y sus responsables, sin modificarla.', field: 'objective' },
};

export function RoleWorkbench({ ideaId, objective, camera, talent, edit, script }: Props) {
  const role = useActiveRole();
  const guide = roleGuide[role];
  const [draft, setDraft] = useState(script);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const canEditScript = role === 'creator' || role === 'owner';
  const content = { objective, camera, talent, edit, script: draft }[guide.field] || 'El equipo todavía debe completar este brief.';

  async function persistScript() {
    if (!draft.trim() || busy) return;
    setBusy(true);
    const { error } = await saveIdeaScript({ ideaId, script: draft.trim(), role });
    setBusy(false);
    setNotice(error ? `No se guardó el guion: ${error}` : '✓ Guion guardado. Cámara, modelo y edición ya ven esta versión.');
  }

  return <section className="border-2 border-mostaza bg-mostaza/5 p-5 sm:p-7 anim-rise" aria-label={`Información para ${ROLE_LABEL[role]}`}>
    <p className="mono-label text-mostaza">[TU VISTA · {ROLE_LABEL[role]} · {guide.eyebrow}]</p>
    <h2 className="mt-3 font-display text-2xl font-bold text-blanco sm:text-3xl">{guide.title}</h2>
    <p className="mt-3 max-w-2xl text-sm leading-7 text-blanco-60">{guide.copy}</p>
    {canEditScript && guide.field === 'script' ? <div className="mt-6">
      <label className="block"><span className="mono-label mb-2 block text-mostaza">// GUIÓN DE TRABAJO</span><textarea value={draft} onChange={(event) => setDraft(event.target.value)} className="input-brutal min-h-72" /></label>
      <button onClick={persistScript} disabled={busy || !draft.trim()} className="btn-brutal mt-4">{busy ? 'GUARDANDO…' : 'GUARDAR GUIÓN →'}</button>
    </div> : <div className="mt-6 whitespace-pre-wrap border-l-4 border-mostaza bg-negro/40 p-5 text-sm leading-7 text-blanco-60">{content}</div>}
    {notice && <p role="status" className="mt-4 border border-mostaza bg-mostaza/10 p-3 font-mono text-[10px] leading-5 text-blanco">{notice}</p>}
  </section>;
}
