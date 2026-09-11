'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useParams, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ROLE_HOME, ROLE_LABEL, type RoleKey } from '@/lib/flow';
import { PUBLIC_MODE } from '@/lib/mode';
import { setStoredRole } from '@/lib/role-client';
import { HelpCenter } from '@/components/help-center';

const openHelp = (tab?: string) => window.dispatchEvent(new CustomEvent('rr-hub-open-help', { detail: tab ?? 'FLUJO' }));

const NAV_BY_ROLE: Record<RoleKey, readonly [string, string, string][]> = {
  owner: [['MAPA', '', 'Todo el flujo'], ['PIEZAS', '/ideas', 'Crear y revisar'], ['DECISIONES', '/aprobaciones', 'Destrabar respuestas'], ['PRODUCCIÓN', '/produccion', 'Rodaje y edición']],
  creator: [['MAPA', '', 'Todo el flujo'], ['MIS IDEAS', '/ideas', 'Crear, ajustar y guionar'], ['DECISIONES', '/aprobaciones', 'Lo que espera al cliente']],
  camera: [['MAPA', '', 'Dónde está cada pieza'], ['PRODUCCIÓN', '/produccion', 'Qué se debe grabar'], ['PIEZAS', '/ideas', 'Referencia y brief']],
  model: [['MAPA', '', 'Dónde está cada pieza'], ['RODAJES', '/produccion', 'Actitud y continuidad'], ['PIEZAS', '/ideas', 'Referencia y talento']],
  editor: [['MAPA', '', 'Dónde está cada pieza'], ['EDICIÓN', '/produccion', 'Crudo, ritmo y corte'], ['PIEZAS', '/ideas', 'Guion y referencia']],
  publisher: [['MAPA', '', 'Todo el flujo'], ['PUBLICACIÓN', '/publicaciones', 'Piezas listas para salir'], ['PIEZAS', '/ideas', 'Contexto de cada pieza']],
  media_buyer: [['MAPA', '', 'Todo el flujo'], ['PUBLICACIÓN', '/publicaciones', 'Salida y pauta']],
  client_approver: [['MAPA', '', 'Cómo avanza todo'], ['POR DECIDIR', '/aprobaciones', 'Ideas esperando tu respuesta'], ['PIEZAS', '/ideas', 'Referencias y guiones']],
  client_viewer: [['MAPA', '', 'Cómo avanza todo'], ['PIEZAS', '/ideas', 'Consulta de propuestas']],
};
const FLOW = [['01', 'IDEA', '/ideas'], ['02', 'GUIÓN', '/ideas'], ['03', 'PRODUCCIÓN', '/produccion'], ['04', 'PUBLICADO', '/publicaciones']] as const;

export function WorkspaceShell({ children, project, role }: { children: React.ReactNode; project: { slug: string; name: string; client_name: string }; role: string }) {
  const params = useParams<{ projectSlug: string }>(); const pathname = usePathname(); const [menuOpen, setMenuOpen] = useState(false); const [selectedRole, setSelectedRole] = useState<string | null>(null);
  useEffect(() => {
    const sync = () => { const stored = window.localStorage.getItem('rr-hub-role'); if (stored) setSelectedRole(stored); };
    sync();
    window.addEventListener('rr-hub-role-change', sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener('rr-hub-role-change', sync); window.removeEventListener('storage', sync); };
  }, []);
  const chooseRole = (value: string) => { setStoredRole(value as RoleKey); setSelectedRole(value); };
  const roleKey = ((selectedRole ?? role) in ROLE_HOME ? selectedRole ?? role : 'owner') as RoleKey; const home = ROLE_HOME[roleKey]; const navigation = NAV_BY_ROLE[roleKey];
  if (!selectedRole) return <RolePicker onSelect={chooseRole}/>;
  return <div className="min-h-screen bg-negro md:flex">{menuOpen && <button aria-label="Cerrar menú" onClick={() => setMenuOpen(false)} className="mobile-nav-backdrop fixed inset-0 z-30 bg-negro/80 md:hidden"/>}<HelpCenter/><aside className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r-2 border-blanco bg-negro p-6 transition-transform md:sticky md:top-0 md:h-screen md:translate-x-0 ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
    <Link href="/wundeer" className="mb-10 flex items-center gap-3"><Image src="/brand/rr-symbol-fucsia-on-negro.png" alt="RR Aliados" width={52} height={40} className="h-10 w-12 object-contain"/><span className="font-display text-xl font-bold text-blanco">RR / WUNDEER</span></Link>
    <div className="border-b border-blanco-10 pb-6"><p className="mono-label text-mostaza">PROYECTO ACTIVO</p><p className="mt-3 font-display text-3xl font-bold text-blanco">WUNDEER</p><p className="mt-2 font-mono text-[10px] text-blanco-40">{project.client_name}</p></div>
    <div className="mt-6 border-2 border-mostaza bg-mostaza/5 p-4"><p className="mono-label text-mostaza">[TU PAPEL · {ROLE_LABEL[roleKey]}]</p><p className="mt-2 font-display text-lg font-bold text-blanco">{home.headline}</p><Link href={`/${params.projectSlug}${home.queue}`} onClick={() => setMenuOpen(false)} className="mt-3 inline-block font-mono text-[10px] text-mostaza underline">IR A MI COLA →</Link><button onClick={() => openHelp('BOTONES')} className="mt-2 block w-full text-left font-mono text-[10px] text-blanco-40 underline hover:text-mostaza">? QUÉ HACE CADA BOTÓN</button></div>
    <nav className="mt-8 space-y-2" aria-label="Navegación de tu rol">{navigation.map(([label, path, help]) => { const href = `/${params.projectSlug}${path}`; const active = path ? pathname.startsWith(href) : pathname === `/${params.projectSlug}`; return <Link key={label} href={href} onClick={() => setMenuOpen(false)} className={`block border-l-2 px-4 py-4 ${active ? 'border-fucsia bg-fucsia/10 text-blanco' : 'border-transparent text-blanco-60 hover:border-mostaza hover:text-mostaza'}`}><strong className="block font-mono text-xs">{label}</strong><small className="mt-1 block text-[10px] text-blanco-40">{help}</small></Link>; })}</nav>
    <div className="mt-auto border-t border-blanco-10 pt-5">{PUBLIC_MODE && <p className="border border-mostaza/60 p-3 font-mono text-[10px] leading-5 text-blanco-60">MODO COLABORATIVO · estás trabajando como {ROLE_LABEL[roleKey]}. Tus cambios quedan en la base.</p>}<div className="mt-3 flex items-center justify-between gap-2"><button onClick={() => openHelp('FLUJO')} className="font-mono text-[10px] text-mostaza underline">AYUDA</button><button onClick={() => openHelp('ROL')} className="font-mono text-[10px] text-blanco-40 underline hover:text-mostaza">CAMBIAR ROL</button></div></div>
  </aside><div className="min-w-0 flex-1"><header className="sticky top-0 z-20 border-b-2 border-blanco bg-negro/95 backdrop-blur"><div className="flex items-center justify-between px-5 py-4 md:px-10"><button onClick={() => setMenuOpen(true)} className="font-mono text-xs text-mostaza md:hidden">☰ MENÚ</button><span className="hidden font-mono text-[10px] text-blanco-40 md:block">WUNDEER // CONTENT OPERATING SYSTEM</span><span className="font-mono text-[10px] text-mostaza">● ACTIVO</span></div><nav aria-label="Paso a paso del flujo" className="grid border-t border-blanco-10 sm:grid-cols-4">{FLOW.map(([number, label, path]) => { const active = path === '/ideas' ? pathname.includes('/ideas') || pathname.includes('/aprobaciones') : pathname.includes(path); return <Link key={label} href={`/${params.projectSlug}${path}`} className={`flex items-center gap-2 border-r border-blanco-10 px-4 py-3 font-mono text-[10px] ${active ? 'bg-mostaza text-negro' : 'text-blanco-40 hover:bg-blanco-05 hover:text-blanco'}`}><span>{number}</span><strong>{label}</strong></Link>; })}</nav></header>{children}</div></div>;
}

function RolePicker({ onSelect }: { onSelect: (role: string) => void }) {
  const roles: [string, string, string][] = [['owner', 'ADMINISTRADOR', 'Ve y coordina todo el flujo'], ['creator', 'IDEACIÓN', 'Propone ideas y prepara guiones'], ['editor', 'EDICIÓN', 'Convierte el crudo en piezas'], ['camera', 'PRODUCCIÓN', 'Rueda lo que está aprobado'], ['model', 'MODELAJE', 'Ejecuta el talento en rodaje'], ['client_approver', 'VISTA CLIENTE', 'Revisa y aprueba propuestas']];
  return <main className="min-h-screen bg-negro px-5 py-10 md:px-12"><div className="mx-auto max-w-5xl"><header className="mb-10 border-b-2 border-blanco pb-10"><p className="eyebrow">[WUNDEER · PRIMER INGRESO]</p><h1 className="display-title">¿DESDE QUÉ<br/><em>ROL TRABAJAS?</em></h1><p className="mt-6 max-w-xl text-base leading-8 text-blanco-60">Elige tu vista para que el mapa te muestre solo las acciones que te corresponden. Puedes cambiarla después.</p></header><div className="grid gap-px border-2 border-blanco bg-blanco sm:grid-cols-2 lg:grid-cols-3">{roles.map(([key, label, copy], index) => <button key={key} onClick={() => onSelect(key)} className="group bg-negro p-6 text-left transition-colors hover:bg-fucsia/15"><span className="font-mono text-[10px] text-mostaza">0{index + 1} / ROL</span><h2 className="mt-7 font-display text-2xl font-bold text-blanco group-hover:text-mostaza">{label}</h2><p className="mt-3 text-sm leading-6 text-blanco-60">{copy}</p><span className="mt-8 block font-mono text-[10px] text-fucsia">ENTRAR COMO {label} →</span></button>)}</div></div></main>;
}
