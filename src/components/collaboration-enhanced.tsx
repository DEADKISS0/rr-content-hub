'use client';

import { useSyncExternalStore } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addComment,
  resolveComment,
  signedAssetUrl,
  uploadAsset,
  type AssetStage,
  type IdeaAsset,
  type IdeaComment,
  type TimelineEvent,
} from '@/lib/workspace-client';
import { statusMeta } from '@/lib/flow';
import { emailElegido, esDelEquipo, perfilElegido, suscribirPerfil } from '@/lib/perfil-votante';
import { SelectorPerfil } from '@/components/selector-perfil';

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
  /**
   * Lo que el servidor ya leyó. Antes venía de `loadComments`/`loadAssets`/
   * `loadTimeline` en el navegador, con la clave anónima; con la puerta por
   * código el anon no lee esas tablas y llegaban vacías. Sin error visible: una
   * lista vacía y una lista que no se cargó se ven igual en la ficha.
   */
  comentariosIniciales: IdeaComment[];
  assetsIniciales: IdeaAsset[];
  timelineInicial: TimelineEvent[];
  /**
   * Las personas del equipo, para el selector de perfil. MEDIDO 2026-10-03: sin
   * esto el bloque de comentarios era la parte del hub que no funcionaba sin
   * sesión, y el hilo es justamente lo que el equipo usa sin ser cliente.
   */
  equipo?: { email: string; nombre: string }[];
}

/**
 * Versión simplificada de IdeaCollaboration
 * - Sin drag & drop complejo
 * - Carga por input normal
 * - Barra de progreso básica
 * - Comentarios con estado en vivo
 */
export function EnhancedIdeaCollaboration({ projectSlug, ideaId, comentariosIniciales, assetsIniciales, timelineInicial, equipo = [] }: EnhancedIdeaCollaborationProps) {
  // Arrancan con lo que leyó el servidor, para que la ficha se pinte con su
  // contenido en el primer render y no con tres listas vacías.
  const [comments, setComments] = useState<IdeaComment[]>(comentariosIniciales);
  const [assets, setAssets] = useState<IdeaAsset[]>(assetsIniciales);
  const [text, setText] = useState('');
  const [showResolved, setShowResolved] = useState(false);
  /**
   * MEDIDO 2026-10-03: sin perfil elegido el comentario no se publica. Antes
   * el botón se activaba, se pulsaba y el servidor respondía «Entra con el código
   * de tu cliente». Ahora se explica antes de intentarlo.
   */
  const perfilActual = useSyncExternalStore(suscribirPerfil, perfilElegido, () => null);
  const puedeComentar = esDelEquipo(perfilActual?.email ?? '', equipo);
  const [stage, setStage] = useState<AssetStage>('reference_brief');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [timeline, setTimeline] = useState<TimelineEvent[]>(timelineInicial);

  const refresh = useCallback(async () => {
    // Por la API del servidor, no con la clave del navegador. `loadComments` y
    // compañía leían `rr_hub_comments` con el anon, que ya no tiene permiso: el
    // refresco cada 20 segundos se enteraba de que no había nada y lo pintaba
    // como que no había nada. Era peor que no refrescar, porque el seemed
    // vivo.
    try {
      const respuesta = await fetch(`/api/workspace/pieza?ideaId=${encodeURIComponent(ideaId)}`, {
        cache: 'no-store',
        credentials: 'same-origin',
      });
      if (!respuesta.ok) return;
      const cuerpo = await respuesta.json() as {
        comentarios: IdeaComment[]; assets: IdeaAsset[]; timeline: TimelineEvent[];
      };
      setComments(cuerpo.comentarios ?? []);
      setAssets(cuerpo.assets ?? []);
      setTimeline(cuerpo.timeline ?? []);
    } catch {
      // Un refresco fallido no puede romper la ficha ni vaciar lo que ya está
      // en pantalla: se conserva lo anterior y se vuelve a intentar en 20 s.
    }
  }, [ideaId]);

  // (realtime retirado: el anon ya no lee estas tablas — ver el bloque de refresco)
  // Sin simulación de "usuarios escribiendo": si no hay movimiento real, no se
  // muestra nada. El movimiento sale de rr_hub_events (quién cambió qué estado
  // y cuándo), no de un Math.random().

  const visible = useMemo(() => comments.filter((comment) => showResolved || !comment.resolved), [comments, showResolved]);

  async function submitComment(event: React.FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    /**
     * MEDIDO 2026-10-03. Esto fallaba con «Entra con el código de tu cliente y con
     * un correo de la lista», que es exactamente lo que ve el equipo con el hub
     * en puerta por código. El comentario exigía sesión, y el hilo —que es lo
     * que más se usa sin ser cliente— quedaba sin poder usarse.
     *
     * Ahora el autor sale del perfil elegido, el mismo que usa la votación. El
     * servidor lo vuelve a comprobar contra `rr_hub_profiles`; escribir el
     * nombre de otra persona en el cuerpo no publica en su nombre.
     */
    const { error } = await addComment({
      ideaId, body: text.trim(), authorProfile: emailElegido(), roleLabel: 'RR ALIADOS',
    });
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
    const { error } = await resolveComment({ commentId: comment.id, ideaId, resolved: !comment.resolved });
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

  return <section className="mt-8 border-t border-blanco-20 pt-8" aria-labelledby="collaboration-title">
    {/* Movimiento real, no simulado: sale de rr_hub_events. */}
    {lastMove && (
      <div className="mb-4 flex flex-wrap items-center gap-3 border border-blanco-20 bg-blanco-05 px-3 py-2">
        <span className="inline-flex h-2 w-2 shrink-0 bg-blanco-50 anim-pulse" aria-hidden />
        <span className="font-mono text-[10px] text-blanco-50">ÚLTIMO MOVIMIENTO · {lastMove.createdAt}</span>
        <span className="font-mono text-[10px] text-blanco">{lastMove.actor} → {statusMeta(lastMove.status).label.toUpperCase()}</span>
        {timeline.length > 1 && <span className="font-mono text-[10px] text-blanco-50">· {timeline.length} MOVIMIENTOS REGISTRADOS</span>}
      </div>
    )}

    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="eyebrow">[SHARED_CONTEXT]</p>
        <h2 id="collaboration-title" className="section-heading mt-2 text-3xl">Colaboración sin pérdida.</h2>
      </div>
      <span className="font-mono text-[10px] text-blanco-50">
        {comments.filter((comment) => !comment.resolved).length} ABIERTOS · TODOS VEN EL MISMO HILO
      </span>
    </div>

    <p className="mb-3 border border-blanco-20 bg-blanco-05 p-2 font-mono text-[10px] leading-5 text-blanco-60 anim-fade">
      [ESPACIO COLABORATIVO] Todo cambio queda guardado en la base y visible para todos desde cualquier dispositivo.
    </p>

    {/* Panel de comentarios */}
    <div className="border border-blanco-20 bg-blanco-05 p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <span className="mono-label text-blanco-50">HILO DE DECISIONES</span>
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
              comment.resolved ? 'border-blanco-20 opacity-60' : 'border-blanco-40'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-[10px] text-blanco">{comment.author}</span>
              <span className="border border-blanco-20 px-2 py-0.5 font-mono text-[10px] text-blanco-60">{comment.role}</span>
            </div>
            <p className="mt-2 text-sm leading-6 text-blanco-60">{comment.text}</p>
            <p className="mt-2 font-mono text-[10px] text-blanco-40">{comment.createdAt}</p>
            <button 
              onClick={() => toggleResolved(comment)} 
              className="mt-3 font-mono text-[10px] text-blanco-60 underline hover:text-blanco"
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

      {/* MEDIDO 2026-10-03. El selector va AQUÍ, pegado al campo, y no en un
          menú del perfil general. Publicar en el hilo es la vía para pedir un
          cambio —es lo que más se usa sin ser cliente—, y antes exigía sesión sin
          decir dónde conseguirla. El error decía «Entra con el código de tu
          cliente», que en el hub sin puerta no lleva a ninguna parte. */}
      {equipo.length > 0 && (
        <div className="mb-3">
          <SelectorPerfil equipo={equipo} slug={projectSlug} />
        </div>
      )}
      {!puedeComentar && (
        <p className="mb-3 border-l-4 border-l-mostaza bg-mostaza-05 px-3 py-2 text-sm leading-6 text-mostaza">
          Elige con qué perfil del equipo comentas. Sin perfil no se puede publicar
          en el hilo.
        </p>
      )}

      <form 
        onSubmit={submitComment} 
        className="mt-4 border-t border-blanco-20 pt-3"
      >
        <div className="relative">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="input-brutal w-full min-h-[80px] resize-none focus:outline-none focus:border-blanco-40"
            placeholder="Escribe una decisión, duda o ajuste..."
          />
          {busy && (
            <div className="absolute inset-0 flex items-center justify-center bg-negro/70">
              <span className="font-mono text-[10px] text-blanco-60 anim-pulse">PUBLICANDO…</span>
            </div>
          )}
        </div>
        <div className="mt-2 flex justify-end">
          <button
            disabled={busy || !text.trim() || (equipo.length > 0 && !puedeComentar)}
            className="btn-brutal text-[10px] px-3 py-1.5 disabled:opacity-50 transition-transform hover:scale-[1.02]"
          >
            {busy ? 'ENVIANDO…' : 'ENVIAR COMENTARIO →'}
          </button>
        </div>
      </form>
    </div>

    {/* Panel de archivos simplificado */}
    <div className="mt-5 border-t border-blanco-10 pt-5">
      <p className="mono-label text-blanco-50">VERSIONES Y ARCHIVOS</p>
      <p className="mt-2 text-sm leading-6 text-blanco-60">
        Centraliza referencia, guion, crudo y entregables. Cada carga deja una versión y nunca reemplaza la anterior.
      </p>
      
      <div className="mt-4 space-y-3">
        {/* Controles de selección de tipo */}
        <div>
          <label className="block">
            <span className="mono-label mb-1 block text-blanco-50">// TIPO DE ENTREGA</span>
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
        <label className="mt-3 flex min-h-32 cursor-pointer flex-col items-center justify-center border border-dashed border-blanco-20 p-4 text-center transition-all duration-200 hover:border-blanco-40 hover:bg-blanco-05">
          <input 
            type="file" 
            className="sr-only" 
            onChange={handleUpload} 
            disabled={busy} 
            accept="image/*,video/*,.pdf,.doc,.docx"
          />
          <span className="font-display text-lg font-bold text-blanco-70">
            {busy ? 'SUBIENDO…' : `+ CARGAR ${stageLabel(stage)}`}
          </span>
          <span className="mt-1 font-mono text-[10px] text-blanco-40">
            PDF · VIDEO · IMAGEN · GUIÓN
          </span>
        </label>
        
        {notice && (
          <p 
            role="status" 
            className="mt-2 border border-blanco-20 bg-blanco-05 p-1 font-mono text-[10px] leading-4 text-blanco"
          >
            {notice}
          </p>
        )}
      </div>
      
      {/* Historial de entregas simplificado */}
      <div className="mt-4 border-t border-blanco-10 pt-3">
        <p className="mono-label text-blanco-50">HISTORIAL DE ENTREGAS</p>
        <div className="mt-2 space-y-1">
          {assets.map((asset) => (
            <button 
              key={asset.id} 
              onClick={() => openAsset(asset)} 
              className="block w-full text-left font-mono text-[10px] text-blanco-60 transition-colors duration-150 hover:text-blanco"
            >
              <div className="flex items-center justify-between gap-1 mb-0.5">
                <span className="truncate text-blanco-60">{asset.kind} // {asset.name}</span>
                <span className="text-blanco-60">{asset.version}</span>
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