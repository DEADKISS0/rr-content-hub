'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useState, useSyncExternalStore } from 'react';
import { GuidedTour } from './guided-tour';
import { Icon, type IconName } from './ui/icons';

/**
 * Cascarón del proyecto.
 *
 * Simplificado el 2026-09-26 después de medir el tablero: **47 cosas clicables,
 * 47 etiquetas distintas y 822 palabras** en una pantalla. Qué se hizo:
 *
 *  1. La navegación de fases del header se eliminó: repetía la barra lateral y
 *     los cuatro pasos que la guía del tablero ya muestra con sus conteos.
 *  2. Cuatro secciones quedan a la vista (tablero, piezas, espera respuesta,
 *     plan) con nombres en español llano. Rodaje y publicación pasan a "ver
 *     más": son de uso interno y se llega igual desde la guía de pasos.
 *  3. La letra subió: las etiquetas de navegación de 12 a 14 px y las ayudas de
 *     10 a 12 px. Nada clicable queda por debajo de 12 px.
 *  4. El modo guía (botón flotante "¿CÓMO SE USA?") explica cada botón.
 *
 * La barra se puede compactar (queda en `localStorage`, así que la preferencia
 * sobrevive recargas).
 *
 * El rol no se dibuja a propósito: cualquiera con el link ve el tablero
 * completo, así que la navegación no finge permisos.
 */
const PRINCIPAL: readonly { label: string; path: string; help: string; icon: IconName }[] = [
  { label: 'EL TABLERO', path: '', help: 'Todo el trabajo, de un vistazo', icon: 'map' },
  { label: 'LAS PIEZAS', path: '/ideas', help: 'La lista completa', icon: 'pieces' },
  { label: 'ESPERA RESPUESTA', path: '/aprobaciones', help: 'Lo que hay que decidir', icon: 'decisions' },
  { label: 'EL PLAN', path: '/roadmap', help: 'Cuánto falta para el final', icon: 'roadmap' },
];

const SECUNDARIO: readonly { label: string; path: string; help: string; icon: IconName }[] = [
  { label: 'EN MARCHA', path: '/produccion', help: 'Rodaje y edición', icon: 'camera' },
  { label: 'LO PUBLICADO', path: '/publicaciones', help: 'Lo que ya salió y la pauta', icon: 'publish' },
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

  function enlace(item: { label: string; path: string; help: string; icon: IconName }) {
    const href = `/${slug}${item.path}`;
    const active = item.path ? pathname.startsWith(href) : pathname === `/${slug}`;
    return (
      <Link
        key={item.label}
        href={href}
        title={item.help}
        onClick={() => setMenuOpen(false)}
        aria-current={active ? 'page' : undefined}
        className={`group flex items-center gap-3 border-l-2 py-3 transition-colors ${collapsed ? 'md:justify-center md:px-0' : 'items-start px-3'} ${active ? 'border-blanco bg-blanco-10 text-blanco' : 'border-transparent text-blanco-60 hover:border-blanco-40 hover:bg-blanco-05 hover:text-blanco'}`}
      >
        <span className={`shrink-0 ${collapsed ? '' : 'mt-[3px]'} ${active ? 'text-blanco' : 'text-blanco-40 group-hover:text-blanco'}`}>
          <Icon name={item.icon} size={18} />
        </span>
        <span className={`collapse-label min-w-0 ${collapsed ? 'md:hidden' : ''}`}>
          <strong className="block font-mono text-sm tracking-[0.05em]">{item.label}</strong>
          <small className="mt-1 block text-xs leading-4 text-blanco-50">{item.help}</small>
        </span>
      </Link>
    );
  }

  return (
    <div className="min-h-screen bg-negro md:flex">
      {menuOpen && (
        <button aria-label="Cerrar menú" onClick={() => setMenuOpen(false)} className="mobile-nav-backdrop fixed inset-0 z-30 bg-negro/80 md:hidden" />
      )}

      <aside
        className={`shell-aside fixed inset-y-0 left-0 z-40 flex flex-col overflow-y-auto border-r-2 border-blanco bg-negro transition-transform md:sticky md:top-0 md:h-screen md:translate-x-0 ${menuOpen ? 'translate-x-0' : '-translate-x-full'} ${collapsed ? 'md:w-[4.5rem] p-3' : 'w-72 p-6'}`}
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
            aria-label={collapsed ? 'Expandir el menú' : 'Compactar el menú'}
            title={collapsed ? 'Expandir el menú' : 'Compactar el menú'}
            className="hidden h-8 w-8 shrink-0 items-center justify-center border border-blanco-20 text-blanco-60 transition-colors hover:border-mostaza hover:text-mostaza md:flex"
          >
            <span className={`transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`}>
              <Icon name="chevron" size={14} />
            </span>
          </button>
        </div>

        <nav className="mt-2 space-y-1" aria-label="Menú principal">
          {PRINCIPAL.map(enlace)}

          {/* Rodaje y publicación son de uso interno: quedan a un toque, sin
              ocupar los cuatro lugares principales. */}
          {!collapsed && (
            <details className="group/mas pt-2">
              <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 px-3 font-mono text-xs text-blanco-50 transition-colors hover:text-mostaza">
                <Icon name="chevron" size={11} className="transition-transform group-open/mas:rotate-180" />
                VER MÁS
              </summary>
              <div className="mt-1">{SECUNDARIO.map(enlace)}</div>
            </details>
          )}
        </nav>

        <div className="mt-auto space-y-3 border-t border-blanco-10 pt-5">
          {/* Crear vive en UN solo lugar: el botón del banner, siempre visible.
              Tenerlo también aquí y en la cabecera del tablero daba tres botones
              idénticos en la misma pantalla. */}
          <p className={`collapse-label font-mono text-[11px] leading-5 text-blanco-50 ${collapsed ? 'md:hidden' : ''}`}>
            RR CONTENT HUB · {project.name.toUpperCase()}<br />Datos vivos de Supabase
          </p>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 border-b-2 border-blanco bg-negro/95 backdrop-blur">
          <div className="flex items-center justify-between gap-3 px-5 py-3 md:px-10">
            <button onClick={() => setMenuOpen(true)} className="inline-flex items-center gap-2 border border-blanco-20 px-2 py-1.5 font-mono text-xs text-mostaza md:hidden">
              <Icon name="list" size={14} /> MENÚ
            </button>
            <Link href={`/${slug}`} className="hidden font-mono text-xs text-blanco-60 transition-colors hover:text-blanco md:block">
              {project.name.toUpperCase()} · TODO EL CONTENIDO EN UN LUGAR
            </Link>
            {/* Una sola acción en el header: crear. La navegación de fases se
                eliminó (la guía del tablero ya muestra los cuatro pasos). */}
            <Link href={`/${slug}/ideas/nueva`} className="btn-brutal inline-flex items-center gap-2">
              <Icon name="plus" size={14} /> NUEVA PIEZA
            </Link>
          </div>
        </header>
        {children}
      </div>

      <GuidedTour />
    </div>
  );
}
