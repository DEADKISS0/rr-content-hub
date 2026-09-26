'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addComment,
  loadAssets,
  loadComments,
  loadTimeline,
  resolveComment,
  signedAssetUrl,
  uploadAsset,
  type AssetStage,
  type IdeaAsset,
  type IdeaComment,
  type TimelineEvent,
} from '@/lib/workspace-client';
import { createClient } from '@/lib/supabase/client';
import { statusMeta } from '@/lib/flow';

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

interface EnhancedIdeaCollaborationProps {
  projectSlug: string;
  ideaId: string;
}

/**
 * Versión simplificada de IdeaCollaboration
 * - Sin drag & drop complejo
 * - Carga por input normal
 * - Barra de progreso básica
 * - Comentarios con estado en vivo
 */
export function EnhancedIdeaCollaboration({ projectSlug, ideaId }: EnhancedIdeaCollaborationProps) {
  const [comments, setComments] = useState<IdeaComment[]>([]);
  const [assets, setAssets] = useState<IdeaAsset[]>([]);
  const [text, setText] = useState('');
  const [showResolved, setShowResolved] = useState(false);
  const [stage, setStage] = useState<AssetStage>('reference_brief');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);

  const refresh = useCallback(async () => {
    const [nextComments, nextAssets, nextTimeline] = await Promise.all([
      loadComments(ideaId),
      loadAssets(ideaId),
      loadTimeline(ideaId),
    ]);
    setComments(nextComments);
    setAssets(nextAssets);
    setTimeline(nextTimeline);
  }, [ideaId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  // Suscripción en tiempo real a comentarios y assets
  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    
    const channel = supabase.channel(`wundeer-collaboration-${ideaId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rr_hub_comments', filter: `idea_id=eq.${ideaId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rr_hub_assets', filter: `idea_id=eq.${ideaId}` }, refresh)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rr_hub_events', filter: `idea_id=eq.${ideaId}` }, refresh)
      .subscribe();
    
    return () => { supabase.removeChannel(channel); };
  }, [ideaId, refresh]);

  // Sin simulación de "usuarios escribiendo": si no hay movimiento real, no se
  // muestra nada. El movimiento sale de rr_hub_events (quién cambió qué estado
  // y cuándo), no de un Math.random().

  const visible = useMemo(() => comments.filter((comment) => showResolved || !comment.resolved), [comments, showResolved]);

  async function submitComment(event: React.FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    const { error } = await addComment({ ideaId, body: text.trim(), roleLabel: 'RR ALIADOS' });
    setBusy(false);
    if (error) { 
      setNotice(`No se publicó el comentario: ${error}`); 
      return; 
    }
    setText('');
    setNotice('✓ Comentario publicado en el hilo compartido.');
    // Enfocar el textarea después de enviar para facilitar edición rápida
    setTimeout(() => {
      const textarea = document.querySelector<HTMLTextAreaElement>('.input-brutal');
      if (textarea) {
        textarea.focus();
        textarea.select();
      }
    }, 100);
    refresh();
  }

  async function toggleResolved(comment: IdeaComment) {
    const { error } = await resolveComment({ commentId: comment.id, resolved: !comment.resolved });
    if (error) { setNotice(`No se pudo actualizar el comentario: ${error}`); return; }
    refresh();
  }

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    event.preventDefault();
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    const versionLabel = `v${assets.filter((asset) => asset.stage === stage).length + 1}`;
    const { error } = await uploadAsset({ ideaId, projectSlug, stage, file, versionLabel });
    setBusy(false);
    if (error) { 
      setNotice(`No se cargó el archivo: ${error}`); 
      return; 
    }
    setNotice(`✓ ${file.name} quedó registrado como ${stageLabel(stage)}.`);
    refresh();
  }

  async function openAsset(asset: IdeaAsset) {
    const url = await signedAssetUrl(asset.url ?? '');
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
    else setNotice('No se pudo generar el enlace del archivo.');
  }

  const lastMove = timeline[0];

  return <section className="mt-8 border-t-2 border-blanco pt-8" aria-labelledby="collaboration-title">
    {/* Movimiento real, no simulado: sale de rr_hub_events. */}
    {lastMove && (
      <div className="mb-4 flex flex-wrap items-center gap-3 border-2 border-mostaza bg-mostaza/10 px-3 py-2">
        <span className="inline-flex h-2 w-2 shrink-0 bg-mostaza anim-pulse" aria-hidden />
        <span className="font-mono text-[10px] text-mostaza">ÚLTIMO MOVIMIENTO · {lastMove.createdAt}</span>
        <span className="font-mono text-[10px] text-blanco">{lastMove.actor} → {statusMeta(lastMove.status).label.toUpperCase()}</span>
        {timeline.length > 1 && <span className="font-mono text-[10px] text-blanco-50">· {timeline.length} MOVIMIENTOS REGISTRADOS</span>}
      </div>
    )}

    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="eyebrow">[SHARED_CONTEXT]</p>
        <h2 id="collaboration-title" className="section-heading mt-2 text-3xl">COLABORACIÓN SIN PÉRDIDA.</h2>
      </div>
      <span className="font-mono text-[10px] text-mostaza">
        {comments.filter((comment) => !comment.resolved).length} ABIERTOS · TODOS VEN EL MISMO HILO
      </span>
    </div>

    <p className="mb-3 border-2 border-mostaza bg-mostaza/10 p-2 font-mono text-[10px] leading-5 text-blanco anim-fade">
      [ESPACIO COLABORATIVO] Todo cambio queda guardado en la base y visible para todos desde cualquier dispositivo.
    </p>

    {/* Panel de comentarios */}
    <div className="border-2 border-blanco bg-blanco-05 p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <span className="mono-label text-mostaza">HILO DE DECISIONES</span>
        {comments.length > 0 && (
          <button 
            onClick={() => setShowResolved((value) => !value)} 
            className="font-mono text-[10px] text-blanco-60 underline hover:text-blanco"
            >
              {showResolved ? 'OCULTAR RESUELTOS' : 'VER RESUELTOS'}
            </button>
          )}
      </div>
      
      <div className="space-y-4">
        {visible.map((comment) => (
          <article 
            key={comment.id} 
            className={`border-l-4 p-3 anim-slide transition-all duration-200 ${
              comment.resolved ? 'border-blanco-20 opacity-60' : 'border-mostaza'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-[10px] text-blanco">{comment.author}</span>
              <span className="border border-mostaza px-2 py-0.5 font-mono text-[10px] text-mostaza">{comment.role}</span>
            </div>
            <p className="mt-2 text-sm leading-6 text-blanco-60">{comment.text}</p>
            <p className="mt-2 font-mono text-[10px] text-blanco-40">{comment.createdAt}</p>
            <button 
              onClick={() => toggleResolved(comment)} 
              className="mt-3 font-mono text-[10px] text-orquidea underline hover:text-orquidea/80"
            >
              {comment.resolved ? 'REABRIR' : 'MARCAR RESUELTO'}
            </button>
          </article>
        ))}
        
        {visible.length === 0 && (
          <p className="py-4 text-center font-mono text-xs text-blanco-40">
            {comments.length === 0 ? 'AÚN NO HAY COMENTARIOS EN ESTA PIEZA.' : 'SIN COMENTARIOS ABIERTOS'}
          </p>
        )}
      </div>

      <form 
        onSubmit={submitComment} 
        className="mt-4 border-t border-blanco-20 pt-3"
      >
        <div className="relative">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="input-brutal w-full min-h-[80px] resize-none focus:outline-none focus:ring-2 focus:ring-mostaza/20"
            placeholder="Escribe una decisión, duda o ajuste..."
          />
          {busy && (
            <div className="absolute inset-0 flex items-center justify-center bg-negro/70">
              <span className="font-mono text-[10px] text-mostaza anim-pulse">PUBLICANDO…</span>
            </div>
          )}
        </div>
        <div className="mt-2 flex justify-end">
          <button
            disabled={busy || !text.trim()}
            className="btn-brutal text-[10px] px-3 py-1.5 disabled:opacity-50 hover:scale-[1.02] transition-transform"
          >
            {busy ? 'ENVIANDO…' : 'ENVIAR COMENTARIO →'}
          </button>
        </div>
      </form>
    </div>

    {/* Panel de archivos simplificado */}
    <div className="mt-5 border-t border-blanco-10 pt-5">
      <p className="mono-label text-mostaza">VERSIONES Y ARCHIVOS</p>
      <p className="mt-2 text-sm leading-6 text-blanco-60">
        Centraliza referencia, guion, crudo y entregables. Cada carga deja una versión y nunca reemplaza la anterior.
      </p>
      
      <div className="mt-4 space-y-3">
        {/* Controles de selección de tipo */}
        <div>
          <label className="block">
            <span className="mono-label mb-1 block text-mostaza">// TIPO DE ENTREGA</span>
            <select 
              value={stage} 
              onChange={(e) => setStage(e.target.value as AssetStage)} 
              className="input-brutal w-full"
            >
              {stageOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>
        
        {/* Zona de carga de archivos por input */}
        <label className="mt-3 flex min-h-32 cursor-pointer flex-col items-center justify-center border-2 border-dashed border-mostaza p-4 text-center hover:bg-mostaza/10 transition-all duration-200">
          <input 
            type="file" 
            className="sr-only" 
            onChange={handleUpload} 
            disabled={busy} 
            accept="image/*,video/*,.pdf,.doc,.docx"
          />
          <span className="font-display text-lg font-bold text-mostaza">
            {busy ? 'SUBIENDO…' : `+ CARGAR ${stageLabel(stage)}`}
          </span>
          <span className="mt-1 font-mono text-[10px] text-blanco-40">
            PDF · VIDEO · IMAGEN · GUIÓN
          </span>
        </label>
        
        {notice && (
          <p 
            role="status" 
            className="mt-2 border border-mostaza bg-mostaza/10 p-1 font-mono text-[10px] leading-4 text-blanco"
          >
            {notice}
          </p>
        )}
      </div>
      
      {/* Historial de entregas simplificado */}
      <div className="mt-4 border-t border-blanco-10 pt-3">
        <p className="mono-label text-mostaza">HISTORIAL DE ENTREGAS</p>
        <div className="mt-2 space-y-1">
          {assets.map((asset) => (
            <button 
              key={asset.id} 
              onClick={() => openAsset(asset)} 
              className="block w-full text-left font-mono text-[10px] text-blanco-60 hover:text-mostaza transition-colors duration-150"
            >
              <div className="flex items-center justify-between gap-1 mb-0.5">
                <span className="truncate text-blanco-60">{asset.kind} // {asset.name}</span>
                <span className="text-mostaza">{asset.version}</span>
              </div>
              <span className="text-blanco-40 text-[10px]">{stageLabel(asset.stage)} · {asset.createdAt}</span>
            </button>
          ))}
          
          {assets.length === 0 && (
            <p className="text-center text-[10px] text-blanco-40">
              AÚN NO HAY ARCHIVOS. CARGA EL GUION, EL CRUDO O UNA VERSIÓN PARA INICIAR EL HISTORIAL.
            </p>
          )}
        </div>
      </div>
    </div>
  </section>;
}