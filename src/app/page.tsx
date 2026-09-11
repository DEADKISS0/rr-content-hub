import { getProjects } from '@/lib/data';
import Link from 'next/link';

/** Resolves the first available project across both row shapes (join object or plain row). */
function firstSlug(projects: any[]): string | null {
  for (const row of projects) {
    const project = row?.projects ?? row;
    const slug = project?.slug ?? (Array.isArray(project) ? project[0]?.slug : null);
    if (slug) return slug;
  }
  return null;
}

export default async function Home() {
  const { projects } = await getProjects();
  const slug = firstSlug(projects);

  if (!slug) {
    return <main className="min-h-screen bg-negro px-5 py-20"><div className="mx-auto max-w-3xl border-2 border-mostaza p-10">
      <p className="eyebrow">[RR CONTENT HUB]</p>
      <h1 className="mt-4 font-display text-4xl font-bold text-blanco">SIN PROYECTOS DISPONIBLES.</h1>
      <p className="mt-5 text-sm leading-7 text-blanco-60">No hay proyectos que mostrar en este momento. Revisa la conexión con Supabase o pide al administrador que habilite un proyecto.</p>
      <Link href="/audit" className="btn-brutal mt-8 inline-block">IR A AUDITORÍA →</Link>
    </div></main>;
  }

  return <main className="min-h-screen bg-negro px-5 py-20"><div className="mx-auto max-w-3xl">
    <p className="eyebrow">[RR CONTENT HUB · MODO PÚBLICO]</p>
    <h1 className="mt-4 font-display text-5xl font-bold text-blanco">ENTRA A UN<br/><em className="text-mostaza">PROYECTO.</em></h1>
    <p className="mt-6 text-sm leading-7 text-blanco-60">El link directo también funciona: cada proyecto vive en <span className="text-mostaza">/{slug}</span>.</p>
    <Link href={`/${slug}`} className="btn-brutal mt-8 inline-block">ABRIR {slug.toUpperCase()} →</Link>
    <p className="mt-4 text-sm"><Link href="/select-project" className="font-mono text-xs text-blanco-60 underline hover:text-mostaza">VER LOS TRES PROYECTOS →</Link></p>
  </div></main>;
}
