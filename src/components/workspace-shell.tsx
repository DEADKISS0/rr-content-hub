'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useState, useSyncExternalStore } from 'react';
import { Icon, type IconName } from './ui/icons';

/**
 * Cascarón del proyecto.
 *
 * La barra lateral se puede compactar (queda en `localStorage`, así que la
 * preferencia sobrevive recargas). Compacta = solo íconos, con el nombre de la
 * sección en el tooltip: deja 4.5rem de rail en vez de 18rem de texto.
 *
 * El rol no se dibuja a propósito: cualquiera con el link ve el tablero
 * completo, así que la navegación no finge permisos.
 */
const NAV: readonly { label: string; path: string; help: string; icon: IconName }[] = [
  { label: 'MAPA', path: '', help: 'Todo el flujo', icon: 'map' },
  { label: 'PIEZAS', path: '/ideas', help: 'Todo el banco de ideas', icon: 'pieces' },
  { label: 'DECISIONES', path: '/aprobaciones', help: 'Lo que espera respuesta', icon: 'decisions' },
  { label: 'PRODUCCIÓN', path: '/produccion', help: 'Rodaje y edición', icon: 'camera' },
  { label: 'PUBLICACIÓN', path: '/publicaciones', help: 'Salidas y pauta', icon: 'publish' },
  { label: 'ROADMAP', path: '/roadmap', help: 'La ruta al go-live', icon: 'roadmap' },
];

const FLOW: readonly { number: string; label: string; path: string; icon: IconName }[] = [
  { number: '01', label: 'IDEA', path: '/ideas', icon: 'spark' },
  { number: '02', label: 'GUIÓN', path: '/ideas', icon: 'pen' },
  { number: '03', label: 'PRODUCCIÓN', path: '/produccion', icon: 'camera' },
  { number: '04', label: 'PUBLICADO', path: '/publicaciones', icon: 'publish' },
];

const STORAGE_KEY = 'rr-hub-aside';
const STORAGE_EVENT = 'rr-hub-aside-change';

/**
 * La preferencia de la barra vive en localStorage. Se lee con
 * useSyncExternalStore (y no con un useEffect + setState) para que el primer
 * render del servidor y del cliente coincidan: en el servidor siempre arranca
 * expandida, y al hidratar toma lo guardado sin producir un render en cascada.
 */
function subscribeAside(callback: () => void) {
  window.addEventListener(STORAGE_EVENT, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(STORAGE_EVENT, callback);
    window.removeEventListener('storage', callback);
  };
}

function readAside(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function WorkspaceShell({ children, project }: { children: React.ReactNode; project: { slug: string; name: string; client_name: string }; role: string }) {
  const params = useParams<{ projectSlug: string }>();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const collapsed = useSyncExternalStore(subscribeAside, readAside, () => false);
  const slug = params.projectSlug;

  function toggleCollapsed() {
    try {
      window.localStorage.setItem(STORAGE_KEY, collapsed ? '0' : '1');
    } catch {
      /* sin persistencia, pero el cambio se aplica igual */
    }
    window.dispatchEvent(new Event(STORAGE_EVENT));
  }

  return (
    <div className="min-h-screen bg-negro md:flex">
      {menuOpen && (
        <button aria-label="Cerrar menú" onClick={() => setMenuOpen(false)} className="mobile-nav-backdrop fixed inset-0 z-30 bg-negro/80 md:hidden" />
      )}

      <aside
        className={`shell-aside fixed inset-y-0 left-0 z-40 flex flex-col border-r-2 border-blanco bg-negro transition-transform md:sticky md:top-0 md:h-screen md:translate-x-0 ${menuOpen ? 'translate-x-0' : '-translate-x-full'} ${collapsed ? 'md:w-[4.5rem] p-3' : 'w-72 p-6'}`}
      >
        <div className={`mb-6 flex items-center gap-3 ${collapsed ? 'md:flex-col md:gap-2' : 'justify-between'}`}>
          <Link href={`/${slug}`} title={project.name} className="flex items-center gap-3">
            <Image src="/brand/rr-symbol-fucsia-on-negro.png" alt="RR Aliados" width={52} height={40} className="h-10 w-auto object-contain" />
            <span className={`collapse-label font-display text-xl font-bold text-blanco ${collapsed ? 'md:hidden' : ''}`}>RR / {project.name.toUpperCase()}</span>
          </Link>
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expandir la barra lateral' : 'Compactar la barra lateral'}
            title={collapsed ? 'Expandir barra lateral' : 'Compactar barra lateral'}
            className="hidden h-8 w-8 shrink-0 items-center justify-center border border-blanco-20 text-blanco-60 transition-colors hover:border-mostaza hover:text-mostaza md:flex"
          >
            <span className={`transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`}>
              <Icon name="chevron" size={14} />
            </span>
          </button>
        </div>

        <div className={`relative overflow-hidden border-2 border-blanco-20 transition-all ${collapsed ? 'md:hidden' : 'p-4'}`}>
          <span className="pointer-events-none absolute inset-0 grid-bg opacity-60" aria-hidden="true" />
          <p className="mono-label relative text-mostaza">PROYECTO ACTIVO</p>
          <p className="relative mt-2 font-display text-3xl font-bold leading-none text-blanco">{project.name.toUpperCase()}</p>
          <p className="relative mt-2 font-mono text-[10px] text-blanco-50">{project.client_name}</p>
        </div>

        <nav className="mt-4 space-y-1" aria-label="Navegación">
          {NAV.map((item) => {
            const href = `/${slug}${item.path}`;
            const active = item.path ? pathname.startsWith(href) : pathname === `/${slug}`;
            return (
              <Link
                key={item.label}
                href={href}
                title={item.label}
                onClick={() => setMenuOpen(false)}
                aria-current={active ? 'page' : undefined}
                className={`group flex items-center gap-3 border-l-2 py-3 transition-colors ${collapsed ? 'md:justify-center md:px-0' : 'items-start px-3'} ${active ? 'border-fucsia bg-fucsia/10 text-blanco' : 'border-transparent text-blanco-60 hover:border-mostaza hover:bg-blanco-05 hover:text-mostaza'}`}
              >
                <span className={`shrink-0 ${collapsed ? '' : 'mt-[2px]'} ${active ? 'text-fucsia' : 'text-blanco-40 group-hover:text-mostaza'}`}>
                  <Icon name={item.icon} size={16} />
                </span>
                <span className={`collapse-label min-w-0 ${collapsed ? 'md:hidden' : ''}`}>
                  <strong className="block font-mono text-xs tracking-[0.06em]">{item.label}</strong>
                  <small className="mt-1 block text-[10px] leading-3 text-blanco-50">{item.help}</small>
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-3 border-t border-blanco-10 pt-5">
          {/* Crear vive en UN solo lugar: el botón del banner, siempre visible.
              Tenerlo también aquí y en la cabecera del tablero daba tres botones
              idénticos en la misma pantalla. */}
          <p className={`collapse-label font-mono text-[10px] leading-5 text-blanco-50 ${collapsed ? 'md:hidden' : ''}`}>
            RR CONTENT HUB · {project.name.toUpperCase()}<br />Datos vivos de Supabase
          </p>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 border-b-2 border-blanco bg-negro/95 backdrop-blur">
          <div className="flex items-center justify-between gap-3 px-5 py-3 md:px-10">
            <button onClick={() => setMenuOpen(true)} className="inline-flex items-center gap-2 border border-blanco-20 px-2 py-1 font-mono text-[11px] text-mostaza md:hidden">
              <Icon name="list" size={13} /> MENÚ
            </button>
            <span className="hidden font-mono text-[10px] text-blanco-50 md:block">{project.name.toUpperCase()} // CONTENT OPERATING SYSTEM</span>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-2 font-mono text-[10px] text-mostaza">
                <span className="h-2 w-2 bg-mostaza anim-pulse" aria-hidden /> ACTIVO
              </span>
              <Link href={`/${slug}/ideas/nueva`} className="inline-flex items-center gap-2 border border-mostaza px-2 py-1 font-mono text-[10px] text-mostaza transition-colors hover:bg-mostaza hover:text-negro">
                <Icon name="plus" size={12} /> <span className="hidden sm:inline">NUEVA PIEZA</span>
              </Link>
            </div>
          </div>
          <nav aria-label="Navegación de fases" className="scroll-thin grid overflow-x-auto border-t border-blanco-10 sm:grid-cols-4">
            {FLOW.map((step) => {
              const active = step.path === '/ideas' ? pathname.includes('/ideas') || pathname.includes('/aprobaciones') : pathname.includes(step.path);
              return (
                <Link
                  key={`${step.number}-${step.label}`}
                  href={`/${slug}${step.path}`}
                  aria-current={active ? 'step' : undefined}
                  className={`flex items-center gap-2 border-r border-blanco-10 px-4 py-3 font-mono text-[10px] tracking-[0.06em] transition-colors ${active ? 'bg-mostaza text-negro' : 'text-blanco-50 hover:bg-blanco-05 hover:text-blanco'}`}
                >
                  <Icon name={step.icon} size={13} />
                  <span className="opacity-60">{step.number}</span>
                  <strong>{step.label}</strong>
                </Link>
              );
            })}
          </nav>
        </header>
        {children}
      </div>
    </div>
  );
}
