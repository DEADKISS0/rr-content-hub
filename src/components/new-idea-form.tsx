'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ReferenceWithBrief } from '@/components/reference-with-brief';
import { createClient } from '@/lib/supabase/client';
import { buildIdeaPack, createIdea, looksLikeUrl, nextIdeaCode } from '@/lib/workspace-client';
import { Icon } from './ui/icons';

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
  const [faltaSesion, setFaltaSesion] = useState(false);
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
    if (!form.title.trim() || !form.objective.trim()) { avisar('Falta el título o el objetivo.'); return; }
    if (!referenceValid) { avisar('La referencia debe ser un enlace válido (https://…).'); return; }
    if (!supabase) { avisar('Supabase no está configurado en este entorno. Avisa al administrador.'); return; }
    setSaving(true);
    setNotice('');
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
    if (error || !id) { setSaving(false); setAvisoDeFallo(error ?? 'No se guardó la idea.'); return; }
    router.push(`/${projectSlug}/ideas/${id}`);
  }

  /**
   * Un fallo que aparece 800 px más abajo del botón que lo provocó se lee como
   * "no pasa nada". Por eso el aviso sube a la vista y el botón baja hasta él.
   * Y cuando el problema es que no hay sesión, el aviso trae su propio botón:
   * mandar a /login sin más devolvía a la persona al tablero, con el formulario
   * perdido y la referencia escrita.
   */
  function avisar(texto: string) {
    setNotice(texto);
    window.setTimeout(() => {
      document.getElementById('aviso-crear')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 40);
  }

  /** Un 401 significa "no hay sesión": en vez de un texto muerto, un botón. */
  function setAvisoDeFallo(texto: string) {
    const sinSesion = /sesión/i.test(texto);
    setNotice(sinSesion
      ? `${texto} Entra con tu cuenta y vuelve: tu referencia y el brief se conservan.`
      : texto);
    setFaltaSesion(sinSesion);
    window.setTimeout(() => {
      document.getElementById('aviso-crear')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 40);
  }

  return <form onSubmit={submit} className="mt-10 space-y-6">
    <div className="border-l-2 border-blanco-20 bg-blanco-05 px-4 py-3 font-mono text-[10px] leading-5 text-blanco-60">[CAPTURA GUIADA] Pega la referencia, escribe título y objetivo. El sistema prepara un primer brief para cámara, modelo, edición y guion; cada rol lo puede afinar después.</div>

    {/* El aviso vive ARRIBA, a la vista, no debajo de ocho bloques. Antes se
        pintaba después del brief y del guion: quien hacía clic veía el botón
        cambiar de color y nada más, y concluía "no pasa nada". */}
    {notice && (
      <div id="aviso-crear" role="alert" className="anim-pop border-l-4 border-l-mostaza bg-blanco-05 px-4 py-3">
        <p className="text-sm leading-6 text-blanco-80">{notice}</p>
        {faltaSesion && <BotonEntrar projectSlug={projectSlug} />}
      </div>
    )}

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

    {/* El brief deja de ser un <details> que hay que descubrir: se lee ANTES de
        guardar. El pedido fue explícito — "cuando lo autorrellene tiene que ver
        y entender antes el contenido". Con el panel abierto y el guion debajo,
        quien crea lee lo que el equipo va a ejecutar y lo corrige ahí mismo, en
        lugar de descubrir un texto generado después de enviarlo.
        `mostaza` en el borde: es contenido nuevo que hay que mirar, no un dato
        más de la ficha. */}
    <section className="border-l-4 border-l-mostaza/70 border-y border-r border-blanco-20 bg-blanco-05">
      <header className="border-b border-blanco-20 px-5 py-4">
        <p className="eyebrow text-mostaza">[LO QUE EL EQUIPO VA A EJECUTAR]</p>
        <h2 className="mt-2 font-display text-xl font-bold text-blanco">El brief que se genera al guardar</h2>
        <p className="mt-2 text-sm leading-6 text-blanco-60">
          Se arma con tu título, tu objetivo y la referencia que pegaste. Léelo antes de crear: es lo que verá el equipo en cámara, talento y edición.
        </p>
      </header>

      <div className="grid gap-px bg-blanco-10 sm:grid-cols-3">
        {(['camera', 'talent', 'edit'] as const).map((campo) => {
          const etiqueta = campo === 'camera' ? 'CÁMARA' : campo === 'talent' ? 'TALENTO / MODELAJE' : 'EDICIÓN';
          const generado = campo === 'camera' ? generated.camera : campo === 'talent' ? generated.talent : generated.edit;
          const editado = Boolean(form[campo].trim());
          return (
            <div key={campo} className="bg-negro p-5">
              <div className="flex items-center justify-between gap-2">
                <span className="mono-label text-blanco-50">// {etiqueta}</span>
                {editado && <span className="font-mono text-[10px] text-mostaza">EDITADO</span>}
              </div>
              <p className="mt-3 text-sm leading-6 text-blanco-70">{generado}</p>
              <Field label="" value={form[campo]} onChange={(value) => update(campo, value)} textarea placeholder="O escribe tu propia versión (vacío = usar la generada)" className="mt-4" />
            </div>
          );
        })}
      </div>

      <details className="border-t border-blanco-20">
        <summary className="cursor-pointer px-5 py-3 font-mono text-[10px] text-blanco-50 hover:text-blanco">VER TAMBIÉN EL GUION QUE SE GENERARÁ</summary>
        <pre className="overflow-x-auto whitespace-pre-wrap border-t border-blanco-20 px-5 py-4 font-mono text-xs leading-6 text-blanco-60">{generated.script}</pre>
      </details>
    </section>

    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <button disabled={saving || !referenceValid} className="btn-brutal" type="submit">{saving ? 'GUARDANDO…' : 'CREAR IDEA →'}</button>
      <span className="font-mono text-[10px] text-blanco-50">{supabase ? `SE GUARDARÁ COMO ${code || 'NUEVA IDEA'}` : 'GUARDADO COMPARTIDO NO DISPONIBLE'}</span>
    </div>
  </form>;
}

/**
 * Entrar sin perder el trabajo.
 *
 * El `next` no es un adorno: sin él, el login devolvía a la persona al tablero
 * con el formulario vacío y la referencia escrita — la mitad del trabajo
 * perdida por un clic. Con él, el callback devuelve a este mismo paso.
 */
function BotonEntrar({ projectSlug }: { projectSlug: string }) {
  const destino = `/${projectSlug}/ideas/nueva`;
  return (
    <Link
      href={`/login?next=${encodeURIComponent(destino)}`}
      className="btn-brutal mt-3 inline-flex items-center gap-2"
    >
      <Icon name="user" size={14} /> ENTRAR Y SEGUIR
    </Link>
  );
}

function Field({ label, value, onChange, placeholder, textarea, select, options, className = '' }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; textarea?: boolean; select?: boolean; options?: string[]; className?: string }) {
  return <label className={`block ${className}`}>{label && <span className="mono-label mb-2 block text-blanco-50">// {label}</span>}{select ? <select value={value} onChange={(event) => onChange(event.target.value)} className="input-brutal">{options?.map((option) => <option key={option}>{option}</option>)}</select> : textarea ? <textarea value={value} onChange={(event) => onChange(event.target.value)} className="input-brutal min-h-24" placeholder={placeholder} /> : <input value={value} onChange={(event) => onChange(event.target.value)} className="input-brutal" placeholder={placeholder} />}</label>;
}
