import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Public entry point: lists every project opened to audit and explains the mode. */
export default async function AuditIndex() {
  const supabase = await createClient();
  const { data } = supabase
    ? await supabase.from('rr_hub_projects').select('name, slug, client_name, description').eq('public_audit', true).order('name')
    : { data: null };
  const projects = data ?? [];

  return <div className="mx-auto max-w-5xl px-5 py-12 md:px-10">
    <header className="mb-10 border-b border-blanco-10 pb-9">
      <p className="eyebrow">[MODO AUDITORÍA]</p>
      <h1 className="display-title">REVISIÓN<br/><em>ABIERTA.</em></h1>
      <p className="mt-5 max-w-2xl text-base leading-8 text-blanco-60">Esta vista permite auditar el flujo completo de contenido sin iniciar sesión. Es de solo lectura: se ve el estado real, la trazabilidad y los archivos, pero no se puede modificar nada.</p>
    </header>

    {projects.length > 0 ? <section>
      <p className="eyebrow mb-4">[PROYECTOS ABIERTOS]</p>
      <div className="grid gap-5 md:grid-cols-2">
        {projects.map((project: any) => <Link key={project.slug} href={`/audit/${project.slug}`} className="group brutal-panel flex min-h-48 flex-col justify-between">
          <div>
            <p className="mono-label">[{project.client_name}]</p>
            <h2 className="mt-4 font-display text-3xl font-bold text-blanco group-hover:text-mostaza">{project.name}</h2>
            <p className="mt-3 text-sm leading-6 text-blanco-60">{project.description}</p>
          </div>
          <div className="border-t border-blanco-10 pt-4 font-mono text-xs text-fucsia group-hover:text-mostaza">ABRIR AUDITORÍA →</div>
        </Link>)}
      </div>
    </section> : <section className="border-2 border-dashed border-blanco-20 px-6 py-16 text-center">
      <p className="eyebrow">[SIN PROYECTOS PÚBLICOS]</p>
      <h2 className="mt-3 font-display text-3xl font-bold text-blanco">NINGÚN PROYECTO ESTÁ ABIERTO A AUDITORÍA.</h2>
      <p className="mt-4 text-sm leading-6 text-blanco-60">El owner activa el modo auditoría por proyecto cuando lo necesita.</p>
    </section>}

    <section className="mt-12 border-2 border-mostaza bg-mostaza/5 p-6">
      <p className="eyebrow">[QUÉ SE PUEDE VER]</p>
      <ul className="mt-4 grid gap-3 text-sm leading-6 text-blanco-60 sm:grid-cols-2">
        <li>→ Flujo en cinco fases con el conteo real por estado.</li>
        <li>→ Ficha completa: referencia, briefs, guion y objetivo.</li>
        <li>→ Trazabilidad de cada decisión con autor y fecha.</li>
        <li>→ Historial de archivos y comentarios del equipo.</li>
      </ul>
      <Link href="/login" className="mt-6 inline-block font-mono text-xs text-mostaza underline">SOY DEL EQUIPO · ENTRAR CON GOOGLE →</Link>
    </section>
  </div>;
}
