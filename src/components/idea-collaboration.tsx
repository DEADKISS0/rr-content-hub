'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addComment,
  loadAssets,
  loadComments,
  resolveComment,
  signedAssetUrl,
  uploadAsset,
  type AssetStage,
  type IdeaAsset,
  type IdeaComment,
} from '@/lib/workspace-client';
import { ROLE_LABEL } from '@/lib/flow';
import { useActiveRole } from '@/lib/role-client';

const stageOptions: Array<{ value: AssetStage; label: string }> = [
  { value: 'reference_brief', label: 'REFERENCIA / BRIEF' },
  { value: 'script', label: 'GUIÓN' },
  { value: 'raw', label: 'CONTENIDO CRUDO' },
  { value: 'edit_v1', label: 'EDICIÓN V1' },
  { value: 'edit_v2', label: 'EDICIÓN V2' },
  { value: 'edit_final', label: 'EDICIÓN FINAL' },
  { value: 'publication_evidence', label: 'PUBLICACIÓN / EVIDENCIA' },
];

const stageLabel = (stage: string) => stageOptions.find((option) => option.value === stage)?.label ?? stage;

export function IdeaCollaboration({ projectSlug, ideaId }: { projectSlug: string; ideaId: string }) {
  const [comments, setComments] = useState<IdeaComment[]>([]);
  const [assets, setAssets] = useState<IdeaAsset[]>([]);
  const [text, setText] = useState('');
  const role = useActiveRole();
  const [showResolved, setShowResolved] = useState(false);
  const [stage, setStage] = useState<AssetStage>('reference_brief');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const [nextComments, nextAssets] = await Promise.all([loadComments(ideaId), loadAssets(ideaId)]);
    setComments(nextComments);
    setAssets(nextAssets);
  }, [ideaId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const visible = useMemo(() => comments.filter((comment) => showResolved || !comment.resolved), [comments, showResolved]);

  async function submitComment(event: React.FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    const { error } = await addComment({ ideaId, body: text.trim(), roleLabel: ROLE_LABEL[role] });
    setBusy(false);
    if (error) { setNotice(`No se publicó el comentario: ${error}`); return; }
    setText('');
    setNotice('✓ Comentario publicado en el hilo compartido.');
    refresh();
  }

  async function toggleResolved(comment: IdeaComment) {
    const { error } = await resolveComment({ commentId: comment.id, resolved: !comment.resolved });
    if (error) { setNotice(`No se pudo actualizar el comentario: ${error}`); return; }
    refresh();
  }

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    const versionLabel = `v${assets.filter((asset) => asset.stage === stage).length + 1}`;
    const { error } = await uploadAsset({ ideaId, projectSlug, stage, file, versionLabel });
    setBusy(false);
    if (error) { setNotice(`No se cargó el archivo: ${error}`); return; }
    setNotice(`✓ ${file.name} quedó registrado como ${stageLabel(stage)}.`);
    refresh();
  }

  async function openAsset(asset: IdeaAsset) {
    const url = await signedAssetUrl(asset.url ?? '');
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
    else setNotice('No se pudo generar el enlace del archivo.');
  }

  return <section className="mt-8 border-t-2 border-blanco pt-8" aria-labelledby="collaboration-title">
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">[SHARED_CONTEXT]</p><h2 id="collaboration-title" className="section-heading mt-2 text-3xl">COLABORACIÓN SIN PÉRDIDA.</h2></div><span className="font-mono text-[10px] text-mostaza">{comments.filter((comment) => !comment.resolved).length} ABIERTOS · TODOS VEN EL MISMO HILO</span></div>
    <p className="mb-5 border-2 border-mostaza bg-mostaza/10 p-4 font-mono text-[10px] leading-5 text-blanco anim-fade">[ESPACIO COLABORATIVO] Todo cambio queda guardado con el rol elegido. No necesitas entrar con Google.</p>
    <div className="space-y-6">
      <div className="border-2 border-blanco bg-blanco-05 p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between"><span className="mono-label text-mostaza">HILO DE DECISIONES</span>{comments.length > 0 && <button onClick={() => setShowResolved((value) => !value)} className="font-mono text-[10px] text-blanco-60 underline">{showResolved ? 'OCULTAR RESUELTOS' : 'VER RESUELTOS'}</button>}</div>
        <div className="space-y-4">
          {visible.map((comment) => <article key={comment.id} className={`border-l-4 p-3 anim-slide ${comment.resolved ? 'border-blanco-20 opacity-60' : 'border-fucsia'}`}><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-mono text-[10px] text-blanco">{comment.author}</span><span className="border border-mostaza px-2 py-0.5 font-mono text-[10px] text-mostaza">{comment.role}</span></div><p className="mt-2 text-sm leading-6 text-blanco-60">{comment.text}</p><p className="mt-2 font-mono text-[10px] text-blanco-40">{comment.createdAt}</p><button onClick={() => toggleResolved(comment)} className="mt-3 font-mono text-[10px] text-orquidea underline">{comment.resolved ? 'REABRIR' : 'MARCAR RESUELTO'}</button></article>)}
          {visible.length === 0 && <p className="py-8 text-center font-mono text-xs text-blanco-40">{comments.length === 0 ? 'AÚN NO HAY COMENTARIOS EN ESTA PIEZA.' : 'SIN COMENTARIOS ABIERTOS'}</p>}
        </div>
        <form onSubmit={submitComment} className="mt-5 border-t border-blanco-20 pt-5"><p className="mb-3 font-mono text-[10px] text-mostaza">PUBLICAR COMO: {ROLE_LABEL[role]}</p><input value={text} onChange={(event) => setText(event.target.value)} className="input-brutal" placeholder="Escribe una decisión, duda o ajuste..." /><button disabled={busy} className="btn-brutal mt-3 w-full sm:w-auto" type="submit">{busy ? 'PUBLICANDO…' : 'PUBLICAR COMENTARIO →'}</button></form>
      </div>
      <div className="border-2 border-mostaza bg-mostaza/5 p-5 sm:p-7">
        <p className="mono-label text-mostaza">VERSIONES Y ARCHIVOS</p>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-blanco-60">Centraliza referencia, guion, crudo y entregables. Cada carga deja una versión y nunca reemplaza la anterior.</p>
        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,.7fr)]">
          <div>
            <label className="block"><span className="mono-label mb-2 block text-mostaza">// TIPO DE ENTREGA</span><select value={stage} onChange={(event) => setStage(event.target.value as AssetStage)} className="input-brutal">{stageOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <label className="mt-4 flex min-h-32 cursor-pointer flex-col items-center justify-center border-2 border-dashed border-mostaza p-6 text-center hover:bg-mostaza/10"><input type="file" className="sr-only" onChange={handleUpload} disabled={busy} accept="image/*,video/*,.pdf,.doc,.docx" /><span className="font-display text-xl font-bold text-mostaza">{busy ? 'SUBIENDO…' : `+ CARGAR ${stageLabel(stage)}`}</span><span className="mt-2 font-mono text-[10px] text-blanco-40">PDF · VIDEO · IMAGEN · GUIÓN</span></label>
            {notice && <p role="status" className="mt-4 border border-mostaza bg-mostaza/10 p-3 font-mono text-[10px] leading-5 text-blanco">{notice}</p>}
          </div>
          <div className="border-l-2 border-mostaza/50 pl-5">
            <p className="mono-label text-mostaza">HISTORIAL DE ENTREGAS</p>
            <div className="mt-4 space-y-2">
              {assets.map((asset) => <button key={asset.id} onClick={() => openAsset(asset)} className="block w-full border-b border-blanco-20 py-3 text-left font-mono text-[10px] hover:bg-blanco-05"><div className="flex items-center justify-between gap-2"><span className="truncate text-blanco-60">{asset.kind} // {asset.name}</span><span className="shrink-0 text-mostaza">{asset.version}</span></div><span className="mt-1 block text-blanco-40">{stageLabel(asset.stage)} · {asset.createdAt}</span></button>)}
              {assets.length === 0 && <p className="py-6 font-mono text-[10px] leading-5 text-blanco-40">AÚN NO HAY ARCHIVOS. CARGA EL GUION, EL CRUDO O UNA VERSIÓN PARA INICIAR EL HISTORIAL.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>;
}
