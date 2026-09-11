'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useParams, usePathname } from 'next/navigation';
import { useState } from 'react';

/**
 * Simplified shell for presenting ideas. Role gating, the role picker and the
 * role panel are intentionally removed so anyone landing on the project sees
 * the full board immediately. The four-step flow strip stays: it is the map of
 * how a piece travels, which is useful during a presentation.
 */
const NAV: readonly [string, string, string][] = [
  ['MAPA', '', 'Todo el flujo'],
  ['PIEZAS', '/ideas', 'Todo el banco de ideas'],
  ['DECISIONES', '/aprobaciones', 'Lo que espera respuesta'],
  ['PRODUCCIÓN', '/produccion', 'Rodaje y edición'],
  ['PUBLICACIÓN', '/publicaciones', 'Salidas y pauta'],
];
const FLOW = [['01', 'IDEA', '/ideas'], ['02', 'GUIÓN', '/ideas'], ['03', 'PRODUCCIÓN', '/produccion'], ['04', 'PUBLICADO', '/publicaciones']] as const;

export function WorkspaceShell({ children, project }: { children: React.ReactNode; project: { slug: string; name: string; client_name: string }; role: string }) {
  const params = useParams<{ projectSlug: string }>(); const pathname = usePathname(); const [menuOpen, setMenuOpen] = useState(false);

  return <div className="min-h-screen bg-negro md:flex">{menuOpen && <button aria-label="Cerrar menú" onClick={() => setMenuOpen(false)} className="mobile-nav-backdrop fixed inset-0 z-30 bg-negro/80 md:hidden"/>}<aside className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r-2 border-blanco bg-negro p-6 transition-transform md:sticky md:top-0 md:h-screen md:translate-x-0 ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
    <Link href="/wundeer" className="mb-10 flex items-center gap-3"><Image src="/brand/rr-symbol-fucsia-on-negro.png" alt="RR Aliados" width={52} height={40} className="h-10 w-12 object-contain"/><span className="font-display text-xl font-bold text-blanco">RR / WUNDEER</span></Link>
    <div className="border-b border-blanco-10 pb-6"><p className="mono-label text-mostaza">PROYECTO ACTIVO</p><p className="mt-3 font-display text-3xl font-bold text-blanco">WUNDEER</p><p className="mt-2 font-mono text-[10px] text-blanco-40">{project.client_name}</p></div>
    <nav className="mt-8 space-y-2" aria-label="Navegación">{NAV.map(([label, path, help]) => { const href = `/${params.projectSlug}${path}`; const active = path ? pathname.startsWith(href) : pathname === `/${params.projectSlug}`; return <Link key={label} href={href} onClick={() => setMenuOpen(false)} className={`block border-l-2 px-4 py-4 ${active ? 'border-fucsia bg-fucsia/10 text-blanco' : 'border-transparent text-blanco-60 hover:border-mostaza hover:text-mostaza'}`}><strong className="block font-mono text-xs">{label}</strong><small className="mt-1 block text-[10px] text-blanco-40">{help}</small></Link>; })}</nav>
    <div className="mt-auto border-t border-blanco-10 pt-5"><p className="font-mono text-[10px] leading-5 text-blanco-40">RR CONTENT HUB · WUNDEER</p></div>
  </aside><div className="min-w-0 flex-1"><header className="sticky top-0 z-20 border-b-2 border-blanco bg-negro/95 backdrop-blur"><div className="flex items-center justify-between px-5 py-4 md:px-10"><button onClick={() => setMenuOpen(true)} className="font-mono text-xs text-mostaza md:hidden">☰ MENÚ</button><span className="hidden font-mono text-[10px] text-blanco-40 md:block">WUNDEER // CONTENT OPERATING SYSTEM</span><span className="font-mono text-[10px] text-mostaza">● ACTIVO</span></div><nav aria-label="Paso a paso del flujo" className="grid border-t border-blanco-10 sm:grid-cols-4">{FLOW.map(([number, label, path]) => { const active = path === '/ideas' ? pathname.includes('/ideas') || pathname.includes('/aprobaciones') : pathname.includes(path); return <Link key={label} href={`/${params.projectSlug}${path}`} className={`flex items-center gap-2 border-r border-blanco-10 px-4 py-3 font-mono text-[10px] ${active ? 'bg-mostaza text-negro' : 'text-blanco-40 hover:bg-blanco-05 hover:text-blanco'}`}><span>{number}</span><strong>{label}</strong></Link>; })}</nav></header>{children}</div></div>;
}
