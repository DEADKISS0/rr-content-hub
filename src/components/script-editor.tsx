'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { saveIdeaScript } from '@/lib/workspace-client';
import { RoleKey } from '@/lib/flow';

export function ScriptEditor({ ideaId, initialScript }: { ideaId: string; initialScript: string }) {
  const draftKey = `rr-hub-script-draft:${ideaId}`;
  const [content, setContent] = useState(() => {
    if (typeof window === 'undefined') return initialScript ?? '';
    return window.localStorage.getItem(draftKey) ?? initialScript ?? '';
  });
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [lastSaved, setLastSaved] = useState(initialScript ?? '');
  const dirty = content !== lastSaved;

  const handleSave = useCallback(async (automatico = false) => {
    if (!dirty || saving) return;
    setSaving(true);
    const { error } = await saveIdeaScript({ ideaId, script: content, role: 'owner' as RoleKey });
    setSaving(false);
    if (error) {
      setNotice(`Error al guardar: ${error}`);
      return;
    }
    setLastSaved(content);
    window.localStorage.removeItem(draftKey);
    setNotice(automatico ? '✓ Autoguardado' : '✓ Guion guardado correctamente');
    if (!automatico) setEditing(false);
    setTimeout(() => setNotice(''), 3000);
  }, [content, dirty, draftKey, ideaId, saving]);

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty]);

  useEffect(() => {
    if (!editing || !dirty || saving) return;
    const id = window.setTimeout(() => { void handleSave(true); }, 30_000);
    return () => window.clearTimeout(id);
  }, [dirty, editing, handleSave, saving]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const siguiente = e.target.value.slice(0, 5000);
    setContent(siguiente);
    window.localStorage.setItem(draftKey, siguiente);
  }, [draftKey]);

  return (
    <section className="border border-blanco-20 bg-blanco-05 p-5 sm:p-7 anim-rise">
      <div className="flex items-center justify-between">
        <p className="mono-label text-blanco-50">[GUIÓN EDITABLE]</p>
        <button
          onClick={() => setEditing(!editing)}
          className="font-mono text-[10px] text-blanco-60 border border-blanco-20 px-2 py-1 hover:border-blanco-40 hover:text-blanco"
        >
          {editing ? 'CANCELAR' : '✎ EDITAR GUION'}
        </button>
      </div>

      <h2 className="mt-3 font-display text-2xl font-bold text-blanco sm:text-3xl">El plan de la pieza.</h2>

      {editing ? (
        <div className="mt-6 space-y-4">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            maxLength={5000}
            className="w-full min-h-[200px] bg-negro border border-blanco-30 p-4 font-mono text-sm leading-6 text-blanco focus:outline-none focus:border-blanco-40 resize-none"
            placeholder="Escribe el desglose, ganchos, llamada a la acción y bloques del guion..."
          />
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-blanco-40">
              {content.length} / 5000 caracteres
            </span>
            <button
              onClick={() => { void handleSave(false); }}
              disabled={saving}
              className="btn-brutal text-xs"
            >
              {saving ? 'GUARDANDO…' : 'GUARDAR CAMBIOS →'}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-6 whitespace-pre-wrap border-l-4 border-blanco-20 bg-negro/40 p-5 text-sm leading-7 text-blanco-60">
          {content || 'Aún no hay guion registrado. Haz clic en "Editar Guion" para redactarlo.'}
        </div>
      )}

      {notice && (
        <p className="mt-3 border border-blanco-20 bg-blanco-05 p-2 font-mono text-[10px] text-blanco">
          {notice}
        </p>
      )}
    </section>
  );
}