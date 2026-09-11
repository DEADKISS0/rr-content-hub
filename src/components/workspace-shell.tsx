'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useParams, usePathname } from 'next/navigation';
import { useState } from 'react';
import { ROLE_HOME, ROLE_LABEL, type RoleKey } from '@/lib/flow';

const modeInfo: Record<string, string> = {
  Resumen: 'Dónde estás y qué sigue',
  Ideas: 'Propuestas y referencias',
  Producción: 'Guion, rodaje y edición',
  Aprobaciones: 'Decisiones por tomar',
  Publicaciones: 'Salidas y evidencia',
  Métricas: 'Resultados y aprendizajes',
};

/** Each role sees fewer tabs, ordered so the first one is its real queue. */
const ROLE_NAV: Record<RoleKey, string[][]> = {
  owner: [['Resumen', ''], ['Aprobaciones', '/aprobaciones'], ['Producción', '/produccion'], ['Ideas', '/ideas'], ['Publicaciones', '/publicaciones'], ['Métricas', '/metricas']],
  creator: [['Resumen', ''], ['Ideas', '/ideas'], ['Aprobaciones', '/aprobaciones'], ['Producción', '/produccion']],
  camera: [['Resumen', ''], ['Producción', '/produccion'], ['Ideas', '/ideas']],
  model: [['Resumen', ''], ['Producción', '/produccion'], ['Ideas', '/ideas']],
  editor: [['Resumen', ''], ['Producción', '/produccion'], ['Publicaciones', '/publicaciones'], ['Ideas', '/ideas']],
  publisher: [['Resumen', ''], ['Publicaciones', '/publicaciones'], ['Métricas', '/metricas'], ['Ideas', '/ideas']],
  media_buyer: [['Resumen', ''], ['Publicaciones', '/publicaciones'], ['Métricas', '/metricas']],
  client_approver: [['Resumen', ''], ['Aprobaciones', '/aprobaciones'], ['Publicaciones', '/publicaciones']],
  client_viewer: [['Resumen', ''], ['Aprobaciones', '/aprobaciones'], ['Publicaciones', '/publicaciones']],
};

export function WorkspaceShell({ children, project, role }: { children: React.ReactNode; project: { slug: string; name: string; client_name: string }; role: string }) {
  const params = useParams<{ projectSlug: string }>();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const roleKey = (role in ROLE_NAV ? role : 'owner') as RoleKey;
  const modes = ROLE_NAV[roleKey];
  const home = ROLE_HOME[roleKey];

  return <div className="min-h-screen bg-negro md:flex">
    {menuOpen && <button aria-label="Cerrar menú" onClick={() => setMenuOpen(false)} className="mobile-nav-backdrop fixed inset-0 z-30 bg-negro/80 md:hidden"/>}
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-80 flex-col overflow-y-auto border-r-2 border-blanco bg-negro p-6 transition-transform md:sticky md:top-0 md:h-screen md:translate-x-0 ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="mb-8 flex items-center justify-between">
        <Link href="/select-project" className="flex items-center gap-3"><Image src="/brand/rr-symbol-fucsia-on-negro.png" alt="Símbolo RR Aliados" width={64} height={48} className="h-12 w-16 object-contain"/><span className="font-display text-xl font-bold text-blanco">RR ALIADOS</span></Link>
        <button onClick={() => setMenuOpen(false)} className="font-mono text-xs text-blanco-60 md:hidden">×</button>
      </div>

      <div className="border-b border-blanco-10 pb-6">
        <p className="mono-label text-mostaza">PROYECTO ACTIVO</p>
        <Link href={`/${project.slug}`} className="mt-3 block font-display text-3xl font-bold text-blanco hover:text-fucsia">{project.name}</Link>
        <p className="mt-2 font-mono text-[10px] leading-5 text-blanco-40">{project.client_name}</p>
      </div>

      <div className="mt-6 border-2 border-mostaza bg-mostaza/5 p-4">
        <p className="mono-label text-mostaza">[TU ROL · {ROLE_LABEL[roleKey]}]</p>
        <p className="mt-2 font-display text-lg font-bold text-blanco">{home.headline}</p>
        <p className="mt-2 text-xs leading-5 text-blanco-60">{home.explanation}</p>
        <Link href={`/${params.projectSlug}${home.queue}`} onClick={() => setMenuOpen(false)} className="mt-3 inline-block font-mono text-[10px] text-mostaza underline">IR A MI COLA →</Link>
      </div>

      <nav className="mt-6 space-y-2" aria-label="Navegación del proyecto">
        {modes.map(([label, path]) => {
          const href = `/${params.projectSlug}${path}`;
          const active = path ? pathname.startsWith(href) : pathname === `/${params.projectSlug}`;
          return <Link key={label} href={href} onClick={() => setMenuOpen(false)} className={`flex min-h-16 items-center justify-between border-l-2 px-4 py-3 font-mono text-xs ${active ? 'border-fucsia bg-fucsia/10 text-blanco' : 'border-transparent text-blanco-60 hover:border-mostaza hover:text-mostaza'}`}>
            <span><strong className="block text-xs">{label.toUpperCase()}</strong><small className="mt-1 block text-[10px] leading-4 text-blanco-40">{modeInfo[label]}</small></span>
          </Link>;
        })}
      </nav>

      <div className="mt-auto border-t border-blanco-10 pt-6">
        <p className="font-mono text-[10px] leading-5 text-blanco-40">El rol decide qué puedes ejecutar. Todos conservan el mismo contexto de cada pieza.</p>
        <Link href="/audit" className="mt-3 inline-block font-mono text-[10px] text-blanco-40 underline">VER MODO AUDITORÍA →</Link>
      </div>
    </aside>

    <div className="min-w-0 flex-1">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b-2 border-blanco bg-negro/95 px-5 py-4 backdrop-blur md:px-10">
        <button onClick={() => setMenuOpen(true)} className="font-mono text-xs text-mostaza md:hidden">☰ MENÚ</button>
        <span className="hidden font-mono text-[10px] text-blanco-40 md:block">RR CONTENT HUB // {project.name} // {ROLE_LABEL[roleKey]}</span>
        <div className="flex items-center gap-3"><span className="h-2 w-2 bg-mostaza"/><span className="font-mono text-[10px] text-blanco-60">SISTEMA ACTIVO</span></div>
      </header>
      {children}
    </div>
  </div>;
}
