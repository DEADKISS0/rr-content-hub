'use client';

import { useEffect, useMemo, useState } from 'react';

type Comment = { id: string; author: string; role: string; text: string; createdAt: string; resolved: boolean };
type Asset = { id: string; name: string; kind: string; stage: string; version: string; createdAt: string };

const seedComments: Comment[] = [
  { id: 'seed-1', author: 'Manuel · Creativa', role: 'CREATIVA', text: 'La referencia define el ritmo: textura primero, producto después. Validemos que el cierre no prometa disponibilidad que aún no está confirmada.', createdAt: 'Hoy · 09:42', resolved: false },
  { id: 'seed-2', author: 'Cliente', role: 'CLIENTE', text: 'Nos gusta la dirección. Para aprobar producción necesitamos confirmar la referencia exacta de la prenda.', createdAt: 'Hoy · 10:15', resolved: false },
];

export function IdeaCollaboration({ projectSlug, ideaId }: { projectSlug: string; ideaId: string }) {
  const commentKey = `rr-comments-${projectSlug}-${ideaId}`;
  const assetKey = `rr-assets-${projectSlug}-${ideaId}`;
  const [comments, setComments] = useState<Comment[]>(seedComments);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [text, setText] = useState('');
  const [role, setRole] = useState('RR ALIADOS');
  const [showResolved, setShowResolved] = useState(false);
  const [assetStage, setAssetStage] = useState('REFERENCIA / BRIEF');
  const [assetNotice, setAssetNotice] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => { try { const saved = localStorage.getItem(commentKey); if (saved) setComments(JSON.parse(saved)); const savedAssets = localStorage.getItem(assetKey); if (savedAssets) setAssets(JSON.parse(savedAssets)); } catch { /* demo mode remains usable */ } }, 0);
    return () => window.clearTimeout(timer);
  }, [commentKey, assetKey]);
  useEffect(() => { localStorage.setItem(commentKey, JSON.stringify(comments)); }, [commentKey, comments]);
  useEffect(() => { localStorage.setItem(assetKey, JSON.stringify(assets)); }, [assetKey, assets]);

  const visible = useMemo(() => comments.filter(comment => showResolved || !comment.resolved), [comments, showResolved]);
  function addComment(event: React.FormEvent) { event.preventDefault(); if (!text.trim()) return; setComments(current => [...current, { id: crypto.randomUUID(), author: `Usuario demo · ${role}`, role, text: text.trim(), createdAt: 'Ahora', resolved: false }]); setText(''); }
  function addAsset(event: React.ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; if (!file) return; setAssets(current => [...current, { id: crypto.randomUUID(), name: file.name, kind: file.type.split('/')[0].toUpperCase() || 'FILE', stage: assetStage, version: `v${current.length + 1}`, createdAt: 'Ahora' }]); setAssetNotice(`✓ ${file.name} quedó registrado como ${assetStage}.`); event.target.value = ''; }

  return <section className="mt-8 border-t-2 border-blanco pt-8" aria-labelledby="collaboration-title">
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">[SHARED_CONTEXT]</p><h2 id="collaboration-title" className="section-heading mt-2 text-3xl">COLABORACIÓN SIN PÉRDIDA.</h2></div><span className="font-mono text-[10px] text-mostaza">{comments.filter(c => !c.resolved).length} ABIERTOS · TODOS VEN EL MISMO HILO</span></div>
    <div className="space-y-6">
      <div className="border-2 border-blanco bg-blanco-05 p-4 sm:p-6"><div className="mb-4 flex items-center justify-between"><span className="mono-label text-mostaza">HILO DE DECISIONES</span><button onClick={() => setShowResolved(value => !value)} className="font-mono text-[10px] text-blanco-60 underline">{showResolved ? 'OCULTAR RESUELTOS' : 'VER RESUELTOS'}</button></div><div className="space-y-4">{visible.map(comment => <article key={comment.id} className={`border-l-2 p-3 ${comment.resolved ? 'border-blanco-20 opacity-60' : 'border-fucsia'}`}><div className="flex flex-wrap justify-between gap-2 font-mono text-[10px]"><span className="text-mostaza">{comment.author}</span><span className="text-blanco-40">{comment.createdAt}</span></div><p className="mt-2 text-sm leading-6 text-blanco-60">{comment.text}</p><button onClick={() => setComments(current => current.map(item => item.id === comment.id ? { ...item, resolved: !item.resolved } : item))} className="mt-3 font-mono text-[10px] text-orquidea underline">{comment.resolved ? 'REABRIR' : 'MARCAR RESUELTO'}</button></article>)}{visible.length === 0 && <p className="py-8 text-center font-mono text-xs text-blanco-40">SIN COMENTARIOS ABIERTOS</p>}</div><form onSubmit={addComment} className="mt-5 border-t border-blanco-20 pt-5"><div className="mb-3 flex flex-col gap-2 sm:flex-row"><select value={role} onChange={event => setRole(event.target.value)} className="input-brutal sm:w-44"><option>RR ALIADOS</option><option>CLIENTE</option><option>MODELO</option><option>CÁMARA</option><option>EDITOR</option><option>PAUTA</option></select><input value={text} onChange={event => setText(event.target.value)} className="input-brutal flex-1" placeholder="Escribe una decisión, duda o ajuste..." /></div><button className="btn-brutal w-full sm:w-auto" type="submit">PUBLICAR COMENTARIO →</button></form></div>
      <div className="border-2 border-mostaza bg-mostaza/5 p-5 sm:p-7"><p className="mono-label text-mostaza">VERSIONES Y ARCHIVOS</p><p className="mt-3 max-w-2xl text-sm leading-7 text-blanco-60">Centraliza referencia, guion, crudo y entregables. Cada carga deja una versión; nunca reemplaza la anterior. Cuando conectemos Storage, el equipo verá exactamente este mismo historial compartido.</p><div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,.7fr)]"><div><label className="block"><span className="mono-label mb-2 block text-mostaza">// TIPO DE ENTREGA</span><select value={assetStage} onChange={(event) => setAssetStage(event.target.value)} className="input-brutal"><option>REFERENCIA / BRIEF</option><option>GUIÓN</option><option>CONTENIDO CRUDO</option><option>EDICIÓN V1</option><option>EDICIÓN V2</option><option>EDICIÓN FINAL</option><option>PUBLICACIÓN / EVIDENCIA</option></select></label><label className="mt-4 flex min-h-32 cursor-pointer flex-col items-center justify-center border-2 border-dashed border-mostaza p-6 text-center hover:bg-mostaza/10"><input type="file" className="sr-only" onChange={addAsset} accept="image/*,video/*,.pdf,.doc,.docx" /><span className="font-display text-xl font-bold text-mostaza">+ CARGAR {assetStage}</span><span className="mt-2 font-mono text-[10px] text-blanco-40">PDF · VIDEO · IMAGEN · GUIÓN</span></label></div><div className="border-l-2 border-mostaza/50 pl-5"><p className="mono-label text-mostaza">HISTORIAL DE ENTREGAS</p>{assetNotice && <p role="status" className="mt-4 border border-mostaza bg-mostaza/10 p-3 font-mono text-[10px] leading-5 text-blanco">{assetNotice}</p>}<div className="mt-4 space-y-2">{assets.map(asset => <div key={asset.id} className="border-b border-blanco-20 py-3 font-mono text-[10px]"><div className="flex items-center justify-between gap-2"><span className="truncate text-blanco-60">{asset.kind} // {asset.name}</span><span className="shrink-0 text-mostaza">{asset.version}</span></div><span className="mt-1 block text-blanco-40">{asset.stage} · {asset.createdAt}</span></div>)}{assets.length === 0 && <p className="py-6 font-mono text-[10px] leading-5 text-blanco-40">AÚN NO HAY ARCHIVOS. CARGA EL GUION, EL CRUDO O UNA VERSIÓN PARA INICIAR EL HISTORIAL.</p>}</div></div></div></div>
    </div>
  </section>;
}
