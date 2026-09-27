import Link from 'next/link';
import { getProjects } from '@/lib/data';
import { Icon } from '@/components/ui/icons';

/**
 * Selección de espacio. Hoy solo hay un proyecto visible, así que la página
 * aprovecha para explicar en cuatro líneas qué se va a encontrar al entrar.
 */
export default async function SelectProject() {
  const { projects } = await getProjects();
  const access: any = projects[0];
  const project = access?.projects ?? access;

  if (!project) {
    return <main className="grid min-h-screen place-items-center bg-negro px-5 py-20">
      <div className="w-full max-w-2xl border border-blanco-20 p-8 anim-rise">
        <p className="eyebrow">[RR CONTENT HUB]</p>
        <h1 className="mt-4 font-display text-4xl font-bold text-blanco">Sin datos disponibles.</h1>
        <p className="mt-5 text-sm leading-7 text-blanco-60">No pudimos leer el proyecto. Revisa la conexión con la base o avisa al administrador.</p>
      </div>
    </main>;
  }

  const steps = [
    { icon: 'spark' as const, label: 'IDEAS', text: 'La creativa propone; el cliente decide.' },
    { icon: 'pen' as const, label: 'GUIONES', text: 'Se escribe y se aprueba el plan.' },
    { icon: 'camera' as const, label: 'PRODUCCIÓN', text: 'Rodaje, crudo, montaje y corte final.' },
    { icon: 'publish' as const, label: 'PUBLICACIÓN', text: 'Sale, se registra la evidencia y se cierra.' },
  ];

  return <main className="min-h-screen bg-negro px-5 py-10 md:px-12">
    <div className="mx-auto max-w-5xl">
      <header className="mb-12 border-b border-blanco-20 pb-10 anim-rise">
        <p className="eyebrow">[RR CONTENT HUB · ESPACIO ÚNICO]</p>
        <h1 className="display-title">{project.name ?? 'Proyecto'} en marcha.</h1>
        <p className="mt-6 max-w-xl text-base leading-8 text-blanco-60">Aquí vive toda la operación de contenido. Una sola marca, un solo tablero, un siguiente paso claro.</p>
      </header>

      <Link href={`/${project.slug}`} className="group block border border-blanco-20 bg-blanco-05 p-7 transition-colors duration-300 hover:border-blanco-40 anim-rise md:p-10" style={{ animationDelay: '120ms' }}>
        <p className="mono-label text-blanco-50">[PROYECTO ACTIVO · {(access.role_in_project ?? 'OWNER').toUpperCase()}]</p>
        <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
          <div>
            <h2 className="font-display text-5xl font-bold text-blanco md:text-7xl">{project.name}</h2>
            <p className="mt-3 font-mono text-xs text-blanco-60">{project.client_name}</p>
          </div>
          <span className="inline-flex items-center gap-2 font-mono text-sm text-blanco-60">ABRIR EL MAPA <Icon name="arrow" size={15} /></span>
        </div>
        <ol className="mt-8 grid gap-px border-t border-blanco-20 pt-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => <li key={step.label} className="flex items-start gap-3 pr-4">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center border border-blanco-20 text-blanco-40"><Icon name={step.icon} size={13} /></span>
            <span>
              <strong className="block font-mono text-[10px] tracking-[0.08em] text-blanco">{String(index + 1).padStart(2, '0')} · {step.label}</strong>
              <small className="mt-1 block font-mono text-[10px] leading-5 text-blanco-60">{step.text}</small>
            </span>
          </li>)}
        </ol>
      </Link>

      <p className="mt-8 font-mono text-[10px] text-blanco-50">
        {(projects as any[]).length > 1 ? `${(projects as any[]).length} PROYECTOS VISIBLES EN ESTE HUB.` : 'ESTE ES EL ÚNICO PROYECTO VISIBLE EN ESTE HUB.'}
        {' '}¿Solo necesitas revisar? <Link href={`/audit/${project.slug}`} className="text-blanco-60 underline hover:text-blanco">ABRE LA AUDITORÍA</Link>.
      </p>
    </div>
  </main>;
}
