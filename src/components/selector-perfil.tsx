'use client';

/**
 * Elegir con qué perfil se vota.
 *
 * MEDIDO 2026-10-03. Lo que había: en el tablero, quien entraba sin puerta veía
 * un cartel de SOLO LECTURA y no podía votar. La votación interna es justamente
 * lo que el equipo hace sin ser cliente, así que dejarla detrás de un cartel la
 * dejaba sin usar.
 *
 * Lo que hace esta pieza:
 *
 * - El perfil se elige una vez y se recuerda en el navegador. Entrar al hub es
 *   una cosa; votar en la reunión es otra, y el que vota puede no ser quien
 *   escribió la idea.
 *
 * - Avisa de verdad lo que significa. Si no hay perfil elegido, el voto NO se
 *   manda: es mejor un aviso claro que un voto que se pierde en silencio.
 *
 * - Cambiar de perfil cambia el botón, no las reglas. El token del navegador
 *   sigue siendo la clave del vote, y el servidor vuelve a comprobar el correo
 *   contra la lista del equipo. Elegir un perfil no abre nada que antes
 *   estuviera cerrado.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import {
  guardarPerfil, perfilElegido, suscribirPerfil, type PerfilVotante,
} from '@/lib/perfil-votante';
import { Icon } from '@/components/ui/icons';

export function SelectorPerfil({
  equipo: equipoDelServidor,
  slug,
  /** Si no le llegan personas, las pide ella misma. */
  pedirEquipo = false,
}: {
  /** Las personas que pueden votar, del servidor. */
  equipo?: PerfilVotante[];
  /** El cliente, solo para el `data-guia` del tour y para pedir el equipo. */
  slug: string;
  /** Pedir el equipo por `fetch` cuando no viene por props. */
  pedirEquipo?: boolean;
}) {
  // MEDIDO 2026-10-03. `WorkspaceShell` lo usan ocho pantallas; pasar el equipo
  // por props a todas era ocho sitios que mantener para lo mismo. Aquí se pide una
  // vez y se cachea por cliente en el navegador.
  const [equipoTraido, setEquipoTraido] = useState<PerfilVotante[]>(equipoDelServidor ?? []);
  const [cargando, setCargando] = useState(!equipoDelServidor && pedirEquipo);
  useEffect(() => {
    if (equipoDelServidor || !pedirEquipo) return;
    let vivo = true;
    fetch(`/api/workspace/equipo?proyecto=${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { equipo?: PerfilVotante[] }) => { if (vivo) { setEquipoTraido(d.equipo ?? []); setCargando(false); } })
      // Un fallo al pedir la lista NO es motivo para tapar el selector: sin equipo
      // se muestra el texto de que no hay, que es la verdad de ese momento.
      .catch(() => { if (vivo) { setEquipoTraido([]); setCargando(false); } });
    return () => { vivo = false; };
  }, [equipoDelServidor, pedirEquipo, slug]);

  const equipo = equipoDelServidor ?? equipoTraido;
  /**
   * `useSyncExternalStore` y no un `useEffect` con `setState`.
   *
   * MEDIDO 2026-10-03. Antes era un `useEffect` que hacía `setElegido(perfilElegido())`,
   * y el linter lo marcaba: setState síncrono dentro de un efecto puede encadenar
   * renders. No era solo estilo. El perfil se leía DESPUÉS del primer pintado, así
   * que durante un frame el botón decía "ELEGIR QUIÉN VOTA" aunque ya hubiera un
   * perfil elegido.
   *
   * `useSyncExternalStore` resuelve las dos cosas a la vez: el servidor devuelve
   * `null` (no hay `localStorage` allí) y el navegador devuelve lo elegido, sin
   * estado intermedio que renderizar de más.
   */
  const elegido = useSyncExternalStore(suscribirPerfil, perfilElegido, () => null);
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);

  // Cierra al pulsar fuera. Con un `click` en el documento, no en `pointerdown`:
  // el segundo se dispara antes de que el botón reciba el clic, y el menú se
  // cerraba sin abrir.
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
    };
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false); };
    document.addEventListener('click', fuera);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('click', fuera);
      document.removeEventListener('keydown', escape);
    };
  }, [abierto]);

  const sinEquipo = equipo.length === 0;

  // Mientras se pide la lista, no se dice que no hay: se está diciendo lo que no
  // se sabe. MEDIDO 2026-10-03 — un «SIN EQUIPO DE VOTACIÓN CONFIGURADO»
  // aparecerá en el tablero durante el primer medio segundo de cada carga.
  if (cargando) {
    return (
      <p className="font-mono text-[10px] text-blanco-40">CARGANDO EQUIPO…</p>
    );
  }

  if (sinEquipo) {
    return (
      <p className="font-mono text-[10px] text-blanco-50">
        {/* No hay equipo con voting habilitado: no se ofrece un selector vacío
            que parece roto. El texto dice lo que falta, no "sin acceso". */}
        SIN EQUIPO DE VOTACIÓN CONFIGURADO
      </p>
    );
  }

  return (
    <div className="relative" ref={caja} data-guia="perfil-voto" data-slug={slug}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-haspopup="listbox"
        /* MEDIDO 2026-10-03 en 320 y 390 px: medía 174x29 px. Con un dedo no se
           pincha, y es el control con el que se elige con quién se vota. Mínimo
           táctil de 44 px, y la etiqueta de 10 px sube a 11 px para que se lea
           en un teléfono. */
        className={`inline-flex min-h-[44px] items-center gap-2 border px-3 font-mono text-[11px] transition-colors ${
          elegido
            ? 'border-orquidea-50 text-orquidea hover:border-orquidea'
            : 'border-mostaza-40 text-mostaza hover:border-mostaza'
        }`}
      >
        <Icon name="user" size={13} />
        {elegido ? `CAMBIAR · ${elegido.nombre.toUpperCase()}` : 'ELEGIR QUIÉN VOTA'}
        <Icon name={abierto ? 'arrow' : 'chevron'} size={11} />
      </button>

      {abierto && (
        <div
          role="listbox"
          className="absolute right-0 z-40 mt-1 max-h-96 w-72 overflow-y-auto border border-blanco-20 bg-negro"
        >
          <p className="border-b border-blanco-10 p-3 font-mono text-[10px] leading-4 text-blanco-50">
            Con qué nombre de este equipo vas a votar. Puedes cambiarlo entre ideas:
            el elegido se recuerda en este navegador.
          </p>
          <ul>
            {equipo.map((p) => {
              const activo = elegido?.email.toLowerCase() === p.email.toLowerCase();
              return (
                <li key={p.email}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={activo}
                    onClick={() => { guardarPerfil(p); setAbierto(false); }}
                    className={`flex min-h-[44px] w-full items-center gap-2 px-3 py-2 text-left font-mono text-[12px] transition-colors ${
                      activo ? 'bg-orquidea-10 text-orquidea' : 'text-blanco-80 hover:bg-blanco-05'
                    }`}
                  >
                    <span className="shrink-0">{activo ? '●' : '○'}</span>
                    <span className="truncate">{p.nombre}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {elegido && (
            <div className="border-t border-blanco-10 p-2">
              <button
                type="button"
                onClick={() => guardarPerfil(null)}
                className="flex min-h-[44px] w-full items-center justify-center px-2 font-mono text-[11px] text-blanco-50 hover:text-blanco-80"
              >
                OLVIDAR ESTE PERFIL
              </button>
            </div>
          )}
        </div>
      )}

      {/* El aviso va fuera del desplegable: si viviera dentro, cerrarse el menú
          se llevaría por delante el texto que explica por qué no se puede
          pulsar.

          MEDIDO 2026-10-03. Este aviso salía SIEMPRE que `puedeVotar` fuera falso,
          y `puedeVotar` se calcula con `esDelEquipo(emailElegido(), equipo)`. Con
          un perfil elegido pero cuyo correo no está en la lista que llegó del
          servidor —o simplemente con `equipo` aún vacío mientras carga— el aviso
          decía «Elige tu perfil» con un perfil YA elegido. Cambiar de perfil no
          cambiaba el aviso, y parecía que el botón no hacía nada.

          Ahora el aviso solo aparece cuando NO hay perfil. Si hay, lo que urge es
          poder cambiarlo: para eso está el desplegable, y para eso `CAMBiar`. */}
      {!elegido && (
        <p className="mt-1 font-mono text-[11px] leading-4 text-mostaza">
          Elige tu perfil antes de votar. El voto necesita un nombre del equipo.
        </p>
      )}
    </div>
  );
}