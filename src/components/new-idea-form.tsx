'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ReferenceWithBrief } from '@/components/reference-with-brief';
import { Chip } from '@/components/ui/chips';
import { Icon } from '@/components/ui/icons';
import { PublicationPreview } from '@/components/ui/preview';
import { createClient } from '@/lib/supabase/client';
import { buildIdeaPack, looksLikeUrl, nextIdeaCode } from '@/lib/workspace-client';

type FormState = { title: string; type: 'Orgánico' | 'Pauta'; category: string; objective: string; description: string; camera: string; talent: string; edit: string; reference: string };
const empty: FormState = { title: '', type: 'Orgánico', category: '', objective: '', description: '', camera: '', talent: '', edit: '', reference: '' };

const STEPS = [
  { key: 'idea', label: 'LA IDEA', detail: 'Qué es y de qué tipo', icon: 'spark' as const },
  { key: 'referencia', label: 'LA REFERENCIA', detail: 'El enlace que inspira la pieza', icon: 'link' as const },
  { key: 'brief', label: 'EL BRIEF', detail: 'Objetivo y guía para el equipo', icon: 'pen' as const },
];

/**
 * Captura guiada en tres pasos.
 *
 * Antes era un formulario largo de una sola tirada: once campos abiertos y sin
 * señal de qué faltaba. Ahora va por partes — idea, referencia, brief — con la
 * lista de lo que falta a la vista, el código que recibirá la pieza y una
 * previsualización real del enlace mientras se escribe.
 *
 * La lógica de guardado no cambió: mismo insert, mismo evento, misma redirección.
 */
export function NewIdeaForm({ projectSlug }: { projectSlug: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [form, setForm] = useState<FormState>(empty);
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState(0);

  const contentType = form.type === 'Orgánico' ? 'organic' : 'paid';
  const update = (field: keyof FormState, value: string) => setForm((current) => ({ ...current, [field]: value }));

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

  // Checklist viva: lo que falta se ve, no se adivina.
  const checklist = [
    { key: 'title', label: 'Título de la pieza', done: form.title.trim().length > 1, hint: 'Cómo se llamará en el tablero' },
    { key: 'objective', label: 'Objetivo', done: form.objective.trim().length > 3, hint: 'Qué debe conseguir' },
    { key: 'reference', label: 'Referencia válida', done: referenceValid, hint: 'Un enlace https:// que inspire la pieza' },
  ];
  const missing = checklist.filter((item) => !item.done);
  const canMove = (index: number) => index === 0 ? form.title.trim().length > 1 : index === 1 ? referenceValid : checklist.every((item) => item.done);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (!form.title.trim() || !form.objective.trim()) { setNotice('Completa al menos título y objetivo para conservar el contexto de la idea.'); return; }
    if (!referenceValid) { setNotice('La referencia debe ser un enlace válido (https://…). Revísala antes de guardar.'); return; }
    if (!supabase) { setNotice('Supabase no está configurado en este entorno. Avisa al administrador para activar el guardado compartido.'); return; }
    setSaving(true);
    const resolvedProjectId = projectId || (await supabase.from('rr_hub_projects').select('id').eq('slug', projectSlug).maybeSingle()).data?.id;
    if (!resolvedProjectId) { setNotice('No pudimos encontrar el proyecto en la base. Intenta recargar la página.'); setSaving(false); return; }
    const finalCode = code || (await nextIdeaCode(resolvedProjectId, contentType));
    const { data, error } = await supabase.from('rr_hub_ideas').insert({
      project_id: resolvedProjectId,
      code: finalCode,
      title: form.title.trim(),
      description: form.description.trim() || 'Sin descripción aún.',
      objective: form.objective.trim(),
      content_type: contentType,
      category: form.category.trim() || 'Sin categoría',
      status: 'draft',
      priority: 'normal',
      camera_brief: form.camera.trim() || generated.camera,
      talent_brief: form.talent.trim() || generated.talent,
      edit_brief: form.edit.trim() || generated.edit,
      script_content: generated.script,
      reference_urls: form.reference.trim() ? [form.reference.trim()] : [],
    }).select('id').single();
    if (error || !data) { setNotice(`No se guardó la idea: ${error?.message ?? 'error desconocido'}.`); setSaving(false); return; }
    await supabase.from('rr_hub_events').insert({
      idea_id: data.id,
      to_status: 'draft',
      comment: 'Idea creada con referencia, brief automático y guion inicial.',
      actor_label: 'Modo colaborativo · RR ALIADOS',
    });
    router.push(`/${projectSlug}/ideas/${data.id}`);
  }

  return <form onSubmit={submit} className="mt-8 space-y-6">
    {/* Progreso: dónde voy y qué falta */}
    <section aria-label="Pasos del registro" className="border-2 border-blanco">
      <ol className="grid gap-px bg-blanco-20 sm:grid-cols-3">
        {STEPS.map((item, index) => {
          const done = index < step;
          const current = index === step;
          return <li key={item.key} className="bg-negro">
            <button
              type="button"
              onClick={() => setStep(index)}
              aria-current={current ? 'step' : undefined}
              className={`step-card flex w-full items-center gap-3 p-4 text-left transition-colors ${current ? 'bg-mostaza/15' : 'hover:bg-blanco-05'}`}
              style={{ animationDelay: `${index * 70}ms` }}
            >
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center border ${done ? 'border-fucsia bg-fucsia text-blanco' : current ? 'border-mostaza text-mostaza' : 'border-blanco-30 text-blanco-50'}`}>
                {done ? <Icon name="check" size={14} /> : <Icon name={item.icon} size={14} />}
              </span>
              <span className="min-w-0">
                <span className="block font-mono text-[10px] tracking-[0.08em] text-blanco-50">PASO {index + 1} DE 3</span>
                <strong className="block font-display text-lg font-bold text-blanco">{item.label}</strong>
                <small className="block font-mono text-[10px] text-blanco-60">{item.detail}</small>
              </span>
            </button>
          </li>;
        })}
      </ol>
      <div className="flex flex-wrap items-center gap-2 border-t border-blanco-20 px-4 py-3">
        <Chip icon="pieces" tone="mostaza">{code ? `SE GUARDARÁ COMO ${code}` : 'GENERANDO CÓDIGO…'}</Chip>
        {missing.length
          ? missing.map((item) => <Chip key={item.key} icon="alert" tone="neutro" title={item.hint}>FALTA: {item.label.toUpperCase()}</Chip>)
          : <Chip icon="check" tone="fucsia">TODO LISTO PARA CREAR</Chip>}
      </div>
    </section>

    {notice && <p role="alert" className="anim-pop border-2 border-fucsia bg-fucsia/10 p-3 font-mono text-xs text-blanco">{notice}</p>}

    {/* PASO 1 */}
    {step === 0 && <section className="anim-slide-down space-y-6">
      <div className="grid gap-6 md:grid-cols-[140px_1fr]">
        <label className="block">
          <span className="mono-label mb-2 block text-mostaza">// CÓDIGO</span>
          <input value={code || '—'} disabled className="input-brutal bg-blanco-10 text-center font-display text-xl text-mostaza" />
          <span className="mt-2 block font-mono text-[10px] text-blanco-50">Se genera solo, no se repite</span>
        </label>
        <Field label="TÍTULO *" value={form.title} onChange={(value) => update('title', value)} placeholder="Ej. La textura que se siente" />
      </div>

      <div>
        <span className="mono-label mb-2 block text-mostaza">// TIPO DE PIEZA</span>
        <div className="grid gap-px bg-blanco-20 sm:grid-cols-2">
          {(['Orgánico', 'Pauta'] as const).map((option) => {
            const active = form.type === option;
            return <button key={option} type="button" onClick={() => update('type', option)} aria-pressed={active}
              className={`flex items-center gap-3 bg-negro p-4 text-left transition-colors ${active ? 'bg-orquidea/15' : 'hover:bg-blanco-05'}`}>
              <span className={`flex h-8 w-8 items-center justify-center border ${active ? 'border-orquidea text-orquidea' : 'border-blanco-30 text-blanco-50'}`}>
                <Icon name={option === 'Orgánico' ? 'spark' : 'target'} size={14} />
              </span>
              <span>
                <strong className="block font-display text-lg font-bold text-blanco">{option.toUpperCase()}</strong>
                <small className="font-mono text-[10px] text-blanco-60">{option === 'Orgánico' ? 'Se publica en el feed de la marca' : 'Sale con inversión y segmentación'}</small>
              </span>
            </button>;
          })}
        </div>
      </div>

      <Field label="CATEGORÍA" value={form.category} onChange={(value) => update('category', value)} placeholder="Producto y tela" />
    </section>}

    {/* PASO 2 */}
    {step === 1 && <section className="anim-slide-down space-y-6">
      <Field label="REFERENCIA VISUAL (INSTAGRAM, TIKTOK, YOUTUBE, DRIVE…)" value={form.reference} onChange={(value) => update('reference', value)} placeholder="Pega el enlace: la vista previa aparece al lado" />
      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <div className="border-2 border-blanco-20 p-4">
          <p className="mono-label mb-3 text-mostaza">// CÓMO SE VERÁ EN EL TABLERO</p>
          <PublicationPreview url={form.reference} code={code || null} title={form.title || 'Nueva idea'} size="md" />
          <p className="mt-3 font-mono text-[10px] leading-5 text-blanco-60">
            {referenceValid ? 'Enlace válido. Instagram y TikTok no exponen miniatura sin API: en ese caso verás la tarjeta de referencia con su shortcode.' : 'Pega un enlace que empiece por https:// para ver la vista previa.'}
          </p>
        </div>
        <div className="border-2 border-blanco-20 p-4">
          {!referenceValid && form.reference.trim()
            ? <p role="alert" className="border-2 border-fucsia bg-fucsia/10 p-3 font-mono text-[10px] leading-5 text-blanco">Ese texto no parece un enlace válido. Debe empezar por https://</p>
            : referenceValid
              ? <ReferenceWithBrief url={form.reference.trim()} title={form.title || 'Nueva idea'} brief={{ intention: form.objective, camera: form.camera, talent: form.talent, edit: form.edit }} />
              : <div className="grid h-full min-h-40 place-items-center text-center">
                <div>
                  <Icon name="link" size={22} className="mx-auto text-blanco-30" />
                  <p className="mt-3 font-mono text-[10px] leading-5 text-blanco-60">AQUÍ APARECERÁ LA REFERENCIA COMPLETA CON SU BRIEF</p>
                </div>
              </div>}
        </div>
      </div>
    </section>}

    {/* PASO 3 */}
    {step === 2 && <section className="anim-slide-down space-y-6">
      <Field label="OBJETIVO *" value={form.objective} onChange={(value) => update('objective', value)} textarea placeholder="¿Qué debe conseguir esta pieza?" />
      <Field label="DESCRIPCIÓN / CONCEPTO" value={form.description} onChange={(value) => update('description', value)} textarea placeholder="Describe la idea en lenguaje claro para el cliente y el equipo…" />
      <details className="border-2 border-blanco-20 p-5" open>
        <summary className="cursor-pointer font-mono text-[10px] text-mostaza">BRIEF AUTOMÁTICO · PUEDES AJUSTARLO ANTES DE GUARDAR</summary>
        <p className="mt-3 font-mono text-[10px] leading-5 text-blanco-60">Si dejas un campo vacío se guarda la propuesta automática que ves en gris. Cada rol del equipo puede afinarla después desde la ficha de la pieza.</p>
        <div className="mt-5 grid gap-6 md:grid-cols-3">
          <Field label="CÁMARA" value={form.camera} onChange={(value) => update('camera', value)} textarea placeholder={generated.camera} />
          <Field label="TALENTO / MODELAJE" value={form.talent} onChange={(value) => update('talent', value)} textarea placeholder={generated.talent} />
          <Field label="EDICIÓN" value={form.edit} onChange={(value) => update('edit', value)} textarea placeholder={generated.edit} />
        </div>
      </details>
      <div className="border-2 border-mostaza bg-mostaza/5 p-4">
        <p className="mono-label text-mostaza">[AL GUARDAR]</p>
        <p className="mt-2 font-mono text-[10px] leading-5 text-blanco-60">
          La pieza nace en <strong className="text-blanco">BORRADOR</strong> (paso 01 IDEAS) y le toca a la CREATIVA. Se registra el evento en la trazabilidad con la nota de creación.
        </p>
      </div>
    </section>}

    {/* Barra de acción fija: una sola acción primaria, siempre visible. */}
    <div className="sticky bottom-0 z-20 -mx-5 flex flex-wrap items-center gap-3 border-t-2 border-blanco bg-negro/95 px-5 py-3 backdrop-blur md:-mx-10 md:px-10">
      <button type="button" disabled={step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))}
        className={`inline-flex items-center gap-2 border-2 px-4 py-3 font-mono text-[11px] transition-colors ${step === 0 ? 'border-blanco-10 text-blanco-30' : 'border-blanco-20 text-blanco-60 hover:border-blanco hover:text-blanco'}`}>
        <Icon name="chevron" size={13} className="rotate-180" /> ANTERIOR
      </button>
      {step < 2
        ? <button type="button" disabled={!canMove(step)} onClick={() => { setNotice(''); setStep((value) => Math.min(2, value + 1)); }}
            className={`inline-flex items-center gap-2 border-2 px-5 py-3 font-mono text-[11px] transition-colors ${canMove(step) ? 'border-mostaza text-mostaza hover:bg-mostaza hover:text-negro' : 'border-blanco-10 text-blanco-30'}`}>
            SIGUIENTE <Icon name="arrow" size={13} />
          </button>
        : <button disabled={saving || !checklist.every((item) => item.done)} className="btn-brutal inline-flex items-center gap-2" type="submit">
            {saving ? 'GUARDANDO…' : 'CREAR IDEA'} <Icon name="arrow" size={14} />
          </button>}
      <span className="font-mono text-[10px] text-blanco-60">
        {supabase ? (missing.length ? `FALTAN ${missing.length} DATO${missing.length === 1 ? '' : 'S'}` : 'LISTO PARA CREAR') : 'GUARDADO COMPARTIDO NO DISPONIBLE'}
      </span>
    </div>
  </form>;
}

function Field({ label, value, onChange, placeholder, textarea }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; textarea?: boolean; select?: boolean; options?: string[] }) {
  return <label className="block">
    <span className="mono-label mb-2 block text-mostaza">// {label}</span>
    {textarea
      ? <textarea value={value} onChange={(event) => onChange(event.target.value)} className="input-brutal min-h-28" placeholder={placeholder} />
      : <input value={value} onChange={(event) => onChange(event.target.value)} className="input-brutal" placeholder={placeholder} />}
  </label>;
}
