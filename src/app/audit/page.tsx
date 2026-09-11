import Link from 'next/link';
import { getAuditProjects, getAuditSettings } from '@/lib/data';

export const dynamic = 'force-dynamic';

function formatDate(value: string | null) {
  if (!value) return 'SIN LÍMITE';
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(value));
}

/** Public entry point: every project, plus the state of the audit window. */
export default async function AuditIndex() {
  const [projects, settings] = await Promise.all([getAuditProjects(), getAuditSettings()]);
  const open = Boolean(settings.enabled);

  if (!open) {
    return <div className="mx-auto max-w-3xl px-5 py-20 md:px-10">
      <div className="border-2 border-mostaza p-10">
        <p className="eyebrow">[AUDITORÍA · CERRADA]</p>
        <h1 className="mt-4 font-display text-4xl font-bold text-blanco">LA VENTANA DE AUDITORÍA ESTÁ CERRADA.</h1>
        <p className="mt-5 text-sm leading-7 text-blanco-60">El owner abre la auditoría por ventanas. Pide que se habilite o entra con tu cuenta autorizada para ver el contenido.</p>
        <Link href="/login" className="btn-brutal mt-8 inline-block">ENTRAR CON GOOGLE →</Link>
      </div>
    </div>;
  }

  return <div className="mx-auto max-w-6xl px-5 py-12 md:px-10">
    <header className="mb-10 border-b border-blanco-10 pb-9">
      <p className="eyebrow">[MODO AUDITORÍA · GLOBAL]</p>
      <h1 className="display-title">REVISIÓN<br/><em>ABIERTA.</em></h1>
      <p className="mt-5 max-w-2xl text-base leading-8 text-blanco-60">Vista pública de <strong className="text-blanco">todo</strong> el Content Hub: cada proyecto, cada pieza, su trazabilidad, su equipo y sus archivos. Es de solo lectura: se ve el estado real, pero no se puede modificar nada.</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <span className="border-2 border-mostaza px-4 py-2 font-mono text-[10px] text-mostaza">VENTANA ABIERTA HASTA {formatDate(settings.expires_at)}</span>
        <Link href="/audit/admin" className="border-2 border-blanco-20 px-4 py-2 font-mono text-[10px] text-blanco hover:border-fucsia">PANEL ADMINISTRATIVO →</Link>
      </div>
    </header>

    <section className="mb-10">
      <div className="mb-4 flex items-end justify-between border-b border-blanco-10 pb-3">
        <p className="eyebrow">[PROYECTOS ABIERTOS]</p>
        <span className="font-mono text-[10px] text-blanco-40">{projects.length} REGISTROS</span>
      </div>
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {(projects as any[]).filter((project) => project.slug === 'wundeer').map((project) => <Link key={project.slug} href={`/audit/${project.slug}`} className="group brutal-panel flex min-h-48 flex-col justify-between">
          <div>
            <p className="mono-label">[{project.client_name}]</p>
            <h2 className="mt-4 font-display text-3xl font-bold text-blanco group-hover:text-mostaza">{project.name}</h2>
            <p className="mt-3 line-clamp-3 text-sm leading-6 text-blanco-60">{project.description}</p>
          </div>
          <div className="border-t border-blanco-10 pt-4 font-mono text-xs text-fucsia group-hover:text-mostaza">ABRIR AUDITORÍA →</div>
        </Link>)}
      </div>
    </section>

    <section className="border-2 border-blanco-20 p-6">
      <p className="eyebrow">[QUÉ INCLUYE ESTA VISTA]</p>
      <ul className="mt-4 grid gap-3 text-sm leading-6 text-blanco-60 sm:grid-cols-2">
        <li>→ Todos los proyectos, sin excepción.</li>
        <li>→ Banco completo y ficha de cada pieza, con briefs y guion.</li>
        <li>→ Trazabilidad de decisiones con autor y fecha.</li>
        <li>→ Comentarios y archivos entregados por etapa.</li>
        <li>→ Equipo, accesos por proyecto e invitaciones pendientes.</li>
        <li>→ Solo lectura: ninguna acción de escritura está disponible.</li>
      </ul>
    </section>
  </div>;
}
