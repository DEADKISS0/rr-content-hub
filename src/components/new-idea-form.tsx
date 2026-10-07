'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ReferenceWithBrief } from '@/components/reference-with-brief';
import { BotonBiblioteca } from '@/components/ad-library-picker';
import { buildIdeaPack, createIdea, looksLikeUrl } from '@/lib/workspace-client';
import { Icon } from './ui/icons';

type FormState = { title: string; type: 'Orgánico' | 'Pauta'; category: string; objective: string; description: string; camera: string; talent: string; edit: string; reference: string; adId: string; adName: string };
const empty: FormState = { title: '', type: 'Orgánico', category: '', objective: '', description: '', camera: '', talent: '', edit: '', reference: '', adId: '', adName: '' };

/**
 * Guided capture. A pasted reference is checked so a broken link never reaches
 * the client, and the ad library is offered without overwriting what was typed.
 *
 * This component no longer talks to Supabase directly. It used to read the
 * project and preview the next piece code with the anon key, which no longer
 * works — the hub has no browser key, and the identity is a signed cookie the
 * browser cannot read. Everything it needs now arrives from the server page as
 * a prop, and everything it writes goes through `/api/workspace`.
 */
export function NewIdeaForm({ projectSlug, projectId, anuncios, usosPorAnuncio }: {
  projectSlug: string;
  projectId: string | null;
  anuncios: { id: string; name: string; platform: string; format: string; externalUrl: string; objective: string; brand: string }[];
  usosPorAnuncio: Record<string, number>;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(empty);
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  const contentType = form.type === 'Orgánico' ? 'organic' : 'paid';
  const update = (field: keyof FormState, value: string) => setForm((current) => ({ ...current, [field]: value }));

  // El código de la pieza (O1, P7...) ya no se calcula en el navegador. Antes se
  // predecía leyendo `rr_hub_ideas` con la clave anónima para enseñarlo antes de
  // guardar: era una vista previa, no el código real, y dos personas guardando a
  // la vez podían ver el mismo número. El servidor asigna el definitivo al
  // insertar, y con el RLS cerrado esa lectura ya no era posible de todos modos.
  // El proyecto llega como prop porque la página es de servidor y sí puede leerlo.

  const referenceValid = looksLikeUrl(form.reference);
  const generated = buildIdeaPack({ title: form.title, objective: form.objective, description: form.description, reference: form.reference });
  const titleError = notice && !form.title.trim() ? 'El titulo es obligatorio.' : '';
  const objectiveError = notice && !form.objective.trim() ? 'El objetivo es obligatorio.' : '';
  const referenceError = notice && (!form.reference.trim() || !referenceValid)
    ? 'Pega una URL valida que empiece por https://.'
    : '';

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (!form.title.trim() || !form.objective.trim()) { avisar('Falta el título o el objetivo.'); return; }
    if (!form.reference.trim()) { avisar('Toda idea necesita al menos un link de referencia (Instagram, TikTok, YouTube, Google Drive o cualquier URL pública). Sin referencia no se crea la idea.'); return; }
    if (!referenceValid) { avisar('La referencia debe ser un enlace válido (https://…).'); return; }
    if (!projectId) { avisar('No se pudo identificar el cliente de esta idea. Recarga la página.'); return; }
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
      // El puntero al anuncio, no su texto. La ficha se lee por relación: si
      // mañana se corrige el copy en la biblioteca, las piezas que lo usan lo
      // ven corregido. Copiarlo dejaría 3 textos desincronizados sin que nadie
      // se entere. Por eso no se guarda el copy del anuncio en la idea.
      adId: form.adId.trim() || null,
    });
    if (error || !id) { setSaving(false); avisar(error ?? 'No se guardó la idea.'); return; }
    router.push(`/${projectSlug}/ideas/${id}`);
  }

  /**
   * Un fallo que aparece 800 px más abajo del botón que lo provocó se lee como
   * "no pasa nada". Por eso el aviso sube a la vista y la página se desplaza
   * hasta él. Con el hub en modo abierto ya no hay el caso de "falta sesión",
   * así que el aviso es solo el motivo y nada más.
   */
  function avisar(texto: string) {
    setNotice(texto);
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
      </div>
    )}

    <div className="grid gap-6 md:grid-cols-[120px_1fr]">
      <div className="block">
        <span className="mono-label mb-2 block text-blanco-50">// CÓDIGO</span>
        <div className="input-brutal bg-blanco-10 px-2 py-2 text-center font-display text-xl text-blanco-40">AUTO</div>
        {/* Antes aquí se predecía el número (O7, P3) leyendo las ideas con la
            clave anónima. Se quitó porque era una mentira útil: dos personas
            guardando a la vez veían el mismo número, y el definitivo lo ponía
            el servidor. Ahora el campo dice lo que es y no promete nada. */}
        <span className="mt-2 block font-mono text-[10px] text-blanco-40">Se genera al guardar</span>
      </div>
      <Field label="TÍTULO *" value={form.title} onChange={(value) => update('title', value)} placeholder="Ej. La textura que se siente" maxLength={120} error={titleError} id="idea-title" />
    </div>

    <div className="grid gap-6 md:grid-cols-2">
      <Field label="TIPO" value={form.type} onChange={(value) => update('type', value)} select options={['Orgánico', 'Pauta']} />
      <Field label="CATEGORÍA" value={form.category} onChange={(value) => update('category', value)} placeholder="Producto y tela" maxLength={80} />
    </div>
    <Field label="OBJETIVO *" value={form.objective} onChange={(value) => update('objective', value)} textarea placeholder="¿Qué debe conseguir esta pieza?" maxLength={500} error={objectiveError} id="idea-objective" />
    <Field label="DESCRIPCIÓN / CONCEPTO" value={form.description} onChange={(value) => update('description', value)} textarea placeholder="Describe la idea en lenguaje claro para el cliente y el equipo..." maxLength={2000} />
    <div>
      <BotonBiblioteca
        anuncios={anuncios}
        usosPorAnuncio={usosPorAnuncio}
        onElegir={(elegido) => {
          // La referencia se rellena siempre: es lo que se vino a buscar. El
          // título y el objetivo SOLO si estaban vacíos: si la persona ya
          // escribió algo, su texto manda. Un selector que pisa lo escrito es un
          // selector que nadie usa dos veces.
          update('reference', elegido.reference);
          if (!form.title.trim()) update('title', elegido.tituloSugerido);
          if (!form.objective.trim()) update('objective', elegido.objetivoSugerido);
          update('adId', elegido.adId);
          update('adName', elegido.adName);
          avisar(`Anuncio: ${elegido.adName}. La pieza queda ligada a él, no copiada.`);
        }}
      />
      <Field label="REFERENCIA * (INSTAGRAM, TIKTOK, YOUTUBE, DRIVE O CUALQUIER URL PÚBLICA)" value={form.reference} onChange={(value) => update('reference', value)} placeholder="Obligatorio: pega un enlace de referencia. Sin referencia no se crea la idea." maxLength={2000} error={referenceError} id="idea-reference" />
      {!referenceValid && form.reference.trim() && !referenceError && <p role="alert" className="mt-2 border border-blanco-20 bg-blanco-05 p-2 font-mono text-[10px] text-blanco">Ese texto no parece un enlace válido. Debe empezar por https://</p>}
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
              <Field label="" value={form[campo]} onChange={(value) => update(campo, value)} textarea placeholder="O escribe tu propia versión (vacío = usar la generada)" className="mt-4" maxLength={1000} id={`brief-${campo}`} />
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
      <span className="font-mono text-[10px] text-blanco-50">GUARDADO EN EL HUB COMPARTIDO</span>
    </div>
  </form>;
}

function Field({ label, value, onChange, placeholder, textarea, select, options, className = '', maxLength, error, id }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; textarea?: boolean; select?: boolean; options?: string[]; className?: string; maxLength?: number; error?: string; id?: string }) {
  const inputId = id ?? label.toLowerCase().replace(/[^a-z]/g, '-');
  const errorId = error ? `${inputId}-error` : undefined;
  return (
    <label className={`block ${className}`}>
      {label && <span className="mono-label mb-2 block text-blanco-50">// {label}</span>}
      {select
        ? <select id={inputId} value={value} onChange={(event) => onChange(event.target.value)} className="input-brutal">{options?.map((option) => <option key={option}>{option}</option>)}</select>
        : textarea
          ? <textarea id={inputId} value={value} onChange={(event) => onChange(event.target.value)} className="input-brutal min-h-24" placeholder={placeholder} maxLength={maxLength} aria-invalid={!!error} aria-describedby={errorId} />
          : <input id={inputId} value={value} onChange={(event) => onChange(event.target.value)} className="input-brutal" placeholder={placeholder} maxLength={maxLength} aria-invalid={!!error} aria-describedby={errorId} />}
      {error && <p id={errorId} role="alert" className="mt-2 border border-blanco-20 bg-blanco-05 p-2 font-mono text-[10px] text-blanco">{error}</p>}
    </label>
  );
}
