'use client';

import { useState, useCallback, useRef } from 'react';
import { saveIdeaScript } from '@/lib/workspace-client';
import { RoleKey } from '@/lib/flow';

export function ScriptEditor({ ideaId, initialScript }: { ideaId: string; initialScript: string }) {
  const [content, setContent] = useState(initialScript ?? '');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSave = useCallback(async () => {
    setSaving(true);
    const { error } = await saveIdeaScript({ ideaId, script: content, role: 'owner' as RoleKey });
    setSaving(false);
    if (error) {
      setNotice(`Error al guardar: ${error}`);
      return;
    }
    setNotice('✓ Guion guardado correctamente');
    setEditing(false);
    setTimeout(() => setNotice(''), 3000);
  }, [content, ideaId]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
  }, []);

  return (
    <section className="border-2 border-mostaza bg-mostaza/5 p-5 sm:p-7 anim-rise">
      <div className="flex items-center justify-between">
        <p className="mono-label text-mostaza">[GUIÓN EDITABLE]</p>
        <button
          onClick={() => setEditing(!editing)}
          className="font-mono text-[10px] text-mostaza border border-mostaza px-2 py-1 hover:bg-mostaza/10"
        >
          {editing ? 'CANCELAR' : '✎ EDITAR GUION'}
        </button>
      </div>

      <h2 className="mt-3 font-display text-2xl font-bold text-blanco sm:text-3xl">EL PLAN DE LA PIEZA.</h2>

      {editing ? (
        <div className="mt-6 space-y-4">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            className="w-full min-h-[200px] bg-negro border-2 border-mostaza p-4 font-mono text-sm leading-6 text-blanco focus:outline-none focus:ring-2 focus:ring-mostaza/20 resize-none"
            placeholder="Escribe el desglose, ganchos, llamada a la acción y bloques del guion..."
          />
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-blanco-40">
              {content.length} / 5000 caracteres
            </span>
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-brutal text-xs"
            >
              {saving ? 'GUARDANDO…' : 'GUARDAR CAMBIOS →'}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-6 whitespace-pre-wrap border-l-4 border-mostaza bg-negro/40 p-5 text-sm leading-7 text-blanco-60">
          {content || 'Aún no hay guion registrado. Haz clic en "Editar Guion" para redactarlo.'}
        </div>
      )}

      {notice && (
        <p className="mt-3 border border-mostaza bg-mostaza/10 p-2 font-mono text-[10px] text-blanco">
          {notice}
        </p>
      )}
    </section>
  );
}