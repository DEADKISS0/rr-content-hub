'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ReferenceWithBrief } from '@/components/reference-with-brief';
import { createClient } from '@/lib/supabase/client';
import { buildIdeaPack, createIdea, looksLikeUrl, nextIdeaCode } from '@/lib/workspace-client';

type FormState = { title: string; type: 'Orgánico' | 'Pauta'; category: string; objective: string; description: string; camera: string; talent: string; edit: string; reference: string };
const empty: FormState = { title: '', type: 'Orgánico', category: '', objective: '', description: '', camera: '', talent: '', edit: '', reference: '' };

/**
 * Guided capture. Two things were added after the audit: the piece gets its
 * human code (O1, P1…) shown before saving, and a pasted reference is checked
 * so a broken link never reaches the client.
 */
export function NewIdeaForm({ projectSlug }: { projectSlug: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [form, setForm] = useState<FormState>(empty);
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [code, setCode] = useState('');

  const contentType = form.type === 'Orgánico' ? 'organic' : 'paid';
  const update = (field: keyof FormState, value: string) => setForm((current) => ({ ...current, [field]: value }));

  // Preview the code the piece will receive, so it is never created anonymous.
  const refreshCode = useCallback(async () => {
    if (!supabase) return;
    const { data: project } = await supabase.from('rr_hub_projects').select('id').eq('slug', projectSlug).maybeSingle();
    if (!project) return;
    setProjectId(project.id);
    setCode(await nextIdeaCode(project.id, contentType));
  }, [supabase, projectSlug, contentType]);

  useEffect(() => { const timer = window.setTimeout(refreshCode, 0); return () => window.clearTimeout(timer); }, [refreshCode]);

  const referenceValid = looksLikeUrl(form.reference);
  const generated = buildIdeaPack({ title: form.title, objective: form.objective, description: form.description, reference: form.reference });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (!form.title.trim() || !form.objective.trim()) { setNotice('Completa al menos título y objetivo para conservar el contexto de la idea.'); return; }
    if (!referenceValid) { setNotice('La referencia debe ser un enlace válido (https://…). Revísala antes de guardar.'); return; }
    if (!supabase) { setNotice('Supabase no está configurado en este entorno. Avisa al administrador para activar el guardado compartido.'); return; }
    setSaving(true);
    // The insert and the event go through the server: it checks that this
    // session has a role in the project, and it assigns the code. The browser
    // used to do both with the anon key, so "code" was a preview that two
    // concurrent writers could duplicate, and a role was never checked at all.
    const { error, id } = await createIdea({
      projectSlug,
      title: form.title.trim(),
      description: form.description.trim(),
      objective: form.objective.trim(),
      contentType,
      category: form.category.trim(),
      referenceUrls: form.reference.trim() ? [form.reference.trim()] : [],
      cameraBrief: form.camera.trim() || generated.camera,
      talentBrief: form.talent.trim() || generated.talent,
      editBrief: form.edit.trim() || generated.edit,
      script: generated.script,
    });
    if (error || !id) { setNotice(error ?? 'No se guardó la idea.'); setSaving(false); return; }
    router.push(`/${projectSlug}/ideas/${id}`);
  }

  return <form onSubmit={submit} className="mt-10 space-y-6">
    <div className="border-l-2 border-blanco-20 bg-blanco-05 px-4 py-3 font-mono text-[10px] leading-5 text-blanco-60">[CAPTURA GUIADA] Pega la referencia, escribe título y objetivo. El sistema prepara un primer brief para cámara, modelo, edición y guion; cada rol lo puede afinar después.</div>
    {notice && <p role="alert" className="border border-blanco-20 bg-blanco-05 p-3 font-mono text-xs text-blanco anim-pop">{notice}</p>}

    <div className="grid gap-6 md:grid-cols-[120px_1fr]">
      <label className="block"><span className="mono-label mb-2 block text-blanco-50">// CÓDIGO</span><input value={code || '—'} disabled className="input-brutal bg-blanco-10 text-center font-display text-xl text-blanco" /><span className="mt-2 block font-mono text-[10px] text-blanco-40">Se genera solo</span></label>
      <Field label="TÍTULO *" value={form.title} onChange={(value) => update('title', value)} placeholder="Ej. La textura que se siente" />
    </div>

    <div className="grid gap-6 md:grid-cols-2">
      <Field label="TIPO" value={form.type} onChange={(value) => update('type', value)} select options={['Orgánico', 'Pauta']} />
      <Field label="CATEGORÍA" value={form.category} onChange={(value) => update('category', value)} placeholder="Producto y tela" />
    </div>
    <Field label="OBJETIVO *" value={form.objective} onChange={(value) => update('objective', value)} textarea placeholder="¿Qué debe conseguir esta pieza?" />
    <Field label="DESCRIPCIÓN / CONCEPTO" value={form.description} onChange={(value) => update('description', value)} textarea placeholder="Describe la idea en lenguaje claro para el cliente y el equipo..." />
    <div>
      <Field label="REFERENCIA VISUAL (INSTAGRAM, TIKTOK, YOUTUBE O FACEBOOK)" value={form.reference} onChange={(value) => update('reference', value)} placeholder="Pega un enlace: la previsualización aparece abajo" />
      {!referenceValid && <p role="alert" className="mt-2 border border-blanco-20 bg-blanco-05 p-2 font-mono text-[10px] text-blanco">Ese texto no parece un enlace válido. Debe empezar por https://</p>}
    </div>
    {form.reference.trim() && referenceValid && <section aria-live="polite"><p className="mono-label mb-2 text-blanco-50">// PREVISUALIZACIÓN AUTOMÁTICA</p><ReferenceWithBrief url={form.reference.trim()} title={form.title || 'Nueva idea'} brief={{ intention: form.objective, camera: form.camera, talent: form.talent, edit: form.edit }} /></section>}
    <details className="border border-blanco-20 p-5" open><summary className="cursor-pointer font-mono text-[10px] text-blanco-50">BRIEF AUTOMÁTICO · PUEDES AJUSTARLO ANTES DE GUARDAR</summary>
      <div className="mt-5 grid gap-6 md:grid-cols-3">
        <Field label="CÁMARA" value={form.camera} onChange={(value) => update('camera', value)} textarea placeholder={generated.camera} />
        <Field label="TALENTO / MODELAJE" value={form.talent} onChange={(value) => update('talent', value)} textarea placeholder={generated.talent} />
        <Field label="EDICIÓN" value={form.edit} onChange={(value) => update('edit', value)} textarea placeholder={generated.edit} />
      </div>
    </details>
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <button disabled={saving || !referenceValid} className="btn-brutal" type="submit">{saving ? 'GUARDANDO…' : 'CREAR IDEA →'}</button>
      <span className="font-mono text-[10px] text-blanco-40">{supabase ? `SE GUARDARÁ COMO ${code || 'NUEVA IDEA'}` : 'GUARDADO COMPARTIDO NO DISPONIBLE'}</span>
    </div>
  </form>;
}

function Field({ label, value, onChange, placeholder, textarea, select, options }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; textarea?: boolean; select?: boolean; options?: string[] }) {
  return <label className="block"><span className="mono-label mb-2 block text-blanco-50">// {label}</span>{select ? <select value={value} onChange={(event) => onChange(event.target.value)} className="input-brutal">{options?.map((option) => <option key={option}>{option}</option>)}</select> : textarea ? <textarea value={value} onChange={(event) => onChange(event.target.value)} className="input-brutal min-h-28" placeholder={placeholder} /> : <input value={value} onChange={(event) => onChange(event.target.value)} className="input-brutal" placeholder={placeholder} />}</label>;
}
