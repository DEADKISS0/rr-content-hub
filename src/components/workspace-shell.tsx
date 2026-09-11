'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useParams, usePathname } from 'next/navigation';
import { useState } from 'react';
import { ROLE_HOME, ROLE_LABEL, type RoleKey } from '@/lib/flow';
import { PUBLIC_MODE } from '@/lib/mode';

const NAV = [['MAPA', ''], ['PIEZAS', '/ideas'], ['DECISIONES', '/aprobaciones'], ['PRODUCCIÓN', '/produccion']] as const;
const HELP: Record<string, string> = { MAPA: 'Todo de un vistazo', PIEZAS: 'Busca y abre una idea', DECISIONES: 'Lo que espera respuesta', PRODUCCIÓN: 'Rodaje y edición' };

export function WorkspaceShell({ children, project, role }: { children: React.ReactNode; project: { slug: string; name: string; client_name: string }; role: string }) {
  const params = useParams<{ projectSlug: string }>(); const pathname = usePathname(); const [menuOpen, setMenuOpen] = useState(false);
  const roleKey = (role in ROLE_HOME ? role : 'owner') as RoleKey; const home = ROLE_HOME[roleKey];
  return <div className="min-h-screen bg-negro md:flex">{menuOpen && <button aria-label="Cerrar menú" onClick={() => setMenuOpen(false)} className="mobile-nav-backdrop fixed inset-0 z-30 bg-negro/80 md:hidden"/>}<aside className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r-2 border-blanco bg-negro p-6 transition-transform md:sticky md:top-0 md:h-screen md:translate-x-0 ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
    <Link href="/wundeer" className="mb-10 flex items-center gap-3"><Image src="/brand/rr-symbol-fucsia-on-negro.png" alt="RR Aliados" width={52} height={40} className="h-10 w-12 object-contain"/><span className="font-display text-xl font-bold text-blanco">RR / WUNDEER</span></Link>
    <div className="border-b border-blanco-10 pb-6"><p className="mono-label text-mostaza">PROYECTO ACTIVO</p><p className="mt-3 font-display text-3xl font-bold text-blanco">WUNDEER</p><p className="mt-2 font-mono text-[10px] text-blanco-40">{project.client_name}</p></div>
    <div className="mt-6 border-2 border-mostaza bg-mostaza/5 p-4"><p className="mono-label text-mostaza">[TU PAPEL · {ROLE_LABEL[roleKey]}]</p><p className="mt-2 font-display text-lg font-bold text-blanco">{home.headline}</p><Link href={`/${params.projectSlug}${home.queue}`} onClick={() => setMenuOpen(false)} className="mt-3 inline-block font-mono text-[10px] text-mostaza underline">IR A MI COLA →</Link></div>
    <nav className="mt-8 space-y-2" aria-label="Navegación principal">{NAV.map(([label, path]) => { const href = `/${params.projectSlug}${path}`; const active = path ? pathname.startsWith(href) : pathname === `/${params.projectSlug}`; return <Link key={label} href={href} onClick={() => setMenuOpen(false)} className={`block border-l-2 px-4 py-4 ${active ? 'border-fucsia bg-fucsia/10 text-blanco' : 'border-transparent text-blanco-60 hover:border-mostaza hover:text-mostaza'}`}><strong className="block font-mono text-xs">{label}</strong><small className="mt-1 block text-[10px] text-blanco-40">{HELP[label]}</small></Link>; })}</nav>
    <div className="mt-auto border-t border-blanco-10 pt-5">{PUBLIC_MODE && <p className="border border-mostaza/60 p-3 font-mono text-[10px] leading-5 text-blanco-60">LECTURA PÚBLICA · editar requiere cuenta autorizada.</p>}<Link href="/audit" className="mt-3 inline-block font-mono text-[10px] text-blanco-40 underline">MODO AUDITORÍA →</Link></div>
  </aside><div className="min-w-0 flex-1"><header className="sticky top-0 z-20 flex items-center justify-between border-b-2 border-blanco bg-negro/95 px-5 py-4 backdrop-blur md:px-10"><button onClick={() => setMenuOpen(true)} className="font-mono text-xs text-mostaza md:hidden">☰ MENÚ</button><span className="hidden font-mono text-[10px] text-blanco-40 md:block">WUNDEER // CONTENT OPERATING SYSTEM</span><span className="font-mono text-[10px] text-mostaza">● ACTIVO</span></header>{children}</div></div>;
}
