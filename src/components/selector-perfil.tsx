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

/**
 * Marca de que ya se leyó el aviso de configuración del perfil.
 *
 * MEDIDO 2026-10-05: va en `localStorage` y no en el estado del componente a
 * propósito. Si fuera estado, recargar la página lo volvería a mostrar y quien
 * ya eligió su perfil tendría que cerrar el aviso otra vez cada vez que carga.
 */
const CLAVE_AVISO_PERFIL = 'rr-hub:aviso-perfil-visto';

/**
 * Suscripción del aviso de perfil.
 *
 * MEDIDO 2026-10-05: el aviso se marca como visto al pulsar «ENTENDIDO», que
 * ocurre FUERA de React. Si el valor se leyera solo al pintar, el menú seguiría
 * mostrando el aviso hasta la siguiente recarga. Estos dos eventos son los que
 * hacen que el store se entere y vuelva a leer `localStorage`.
 */
const oyentesAviso = new Set<() => void>();

function avisarCambioAviso() {
  oyentesAviso.forEach((fn) => fn());
}

function suscribirAvisoPerfil(alCambiar: () => void): () => void {
  oyentesAviso.add(alCambiar);
  return () => oyentesAviso.delete(alCambiar);
}

/** Marca el aviso como visto y avisa al store para que se repinte. */
function marcarAvisoPerfilVisto() {
  try {
    window.localStorage.setItem(CLAVE_AVISO_PERFIL, '1');
  } catch {
    // Sin localStorage no hay nada que guardar. El aviso se volverá a mostrar,
    // que es aceptable: es una molestia, no un fallo.
  }
  avisarCambioAviso();
}

/**
 * Una opción del desplegable.
 *
 * MEDIDO 2026-10-04: estaba escrita dentro del `.map` del equipo y, al añadir el
 * grupo de clientes, copiarla habría dejado dos versiones que se van a quedar
 * desiguales con el tiempo. Aquí hay una sola.
 */
function fila(
  p: PerfilVotante,
  elegido: PerfilVotante | null,
  cerrar: (v: boolean) => void,
) {
  const activo = elegido?.email.toLowerCase() === p.email.toLowerCase();
  return (
    <li key={p.email}>
      <button
        type="button"
        role="option"
        aria-selected={activo}
        onClick={() => { guardarPerfil(p); cerrar(false); }}
        className={`flex min-h-[44px] w-full items-center gap-2 px-3 py-2 text-left font-mono text-[12px] transition-colors ${
          activo ? 'bg-orquidea-10 text-orquidea' : 'text-blanco-80 hover:bg-blanco-05'
        }`}
      >
        <span className="shrink-0">{activo ? '●' : '○'}</span>
        <span className="truncate">{p.nombre}</span>
      </button>
    </li>
  );
}

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
  // MEDIDO 2026-10-04, Santiago: «crea dos perfiles para el cliente para que se
  // puedan reconocer como tal y votar». El cliente no es equipo, así que va en su
  // propia lista y en su propio apartado del desplegable: mezclados con el
  // equipo, el cliente no sabe cuál es el suyo.
  const [clientesTraidos, setClientesTraidos] = useState<PerfilVotante[]>([]);
  const [cargando, setCargando] = useState(!equipoDelServidor && pedirEquipo);
  useEffect(() => {
    if (equipoDelServidor || !pedirEquipo) return;
    let vivo = true;
    fetch(`/api/workspace/equipo?proyecto=${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { equipo?: PerfilVotante[]; clientes?: PerfilVotante[] }) => {
        if (!vivo) return;
        setEquipoTraido(d.equipo ?? []);
        setClientesTraidos(d.clientes ?? []);
        setCargando(false);
      })
      // Un fallo al pedir la lista NO es motivo para tapar el selector: sin equipo
      // se muestra el texto de que no hay, que es la verdad de ese momento.
      .catch(() => { if (vivo) { setEquipoTraido([]); setClientesTraidos([]); setCargando(false); } });
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

  const todos = [...equipo, ...clientesTraidos];
  const sinEquipo = todos.length === 0;

  /*
     * MEDIDO 2026-10-05 (feedback de Santiago: «quiero que al abrir salga un popup
     * para configurar esto primero»). Antes el botón «ELEGIR QUIÉN VOTA» abría
     * una lista plana y el texto de encima decía, sin más, «Elige tu perfil antes
     * de votar. El voto necesita un nombre del equipo». Eso explica una vez y no
     * cada vez; quien llega nuevo no sabe qué está configurando ni qué pasa al
     * elegir.
     *
     * Ahora la PRIMERA vez que se abre —sin perfil guardado— sale un panel encima
     * de la lista que dice qué se está eligiendo, qué pasa al elegir y cómo volver
     * a cambiarlo. Las siguientes veces el menú es la lista, porque ya está
     * configurado.
     *
     * La lista SIEMPRE se muestra debajo. Configurar y elegir son dos cosas: si el
     * panel tapara la lista, quien solo quiere cambiar de perfil tendría que
     * cerrar un formulario para llegar a la lista.
     *
     * `useSyncExternalStore` y no un `useEffect` con `setState`: el aviso se lee
     * de `localStorage` en cada pintado, como ya se hace con el perfil elegido
     * (`perfilElegido`). Con un efecto, el primer render del menú ya abría sin
     * el aviso y un frame después salía —el mismo parpadeo que el selector de
     * perfil ya tenía y que se arregló así en su día.
     */
  const primerVez = useSyncExternalStore(
    suscribirAvisoPerfil,
    () => {
      if (elegido || sinEquipo) return false;
      try {
        return window.localStorage.getItem(CLAVE_AVISO_PERFIL) !== '1';
      } catch {
        return true; // sin localStorage: se avisa una vez de más, no falla nada
      }
    },
    () => false);

  function cerrarSinElegir() {
    try {
      window.localStorage.setItem(CLAVE_AVISO_PERFIL, '1');
    } catch { /* sin localStorage: se volvera a mostrar, que es aceptable */ }
    marcarAvisoPerfilVisto();
  }

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
          /*
           * MEDIDO 2026-10-05: `max-h-96` (384 px) con `overflow-y-auto` cortaba
           * el panel de configuración por la mitad: el botón «ENTENDIDO, ELIJO
           * ABAJO» quedaba debajo del pliegue y había que hacer scroll dentro del
           * propio menú para cerrarlo. Ahora la lista scrollea sola (`max-h-72`) y
           * el panel de aviso queda FIJO arriba, sin scroll.
           */
          className="absolute right-0 z-40 mt-1 flex max-h-[70vh] w-80 flex-col border border-blanco-20 bg-negro sm:w-72"
        >
          {/*
            MEDIDO 2026-10-05: el panel de configuración sale PRIMERO, encima de
            la lista, y solo la primera vez. Explica qué se está haciendo, no solo
            que hay que elegir. La lista queda accesible debajo: configurar y
            elegir son dos pasos distintos y quien solo quiere cambiar de perfil
            no debería tener que cerrar un formulario para llegar a la lista.
          */}
          {primerVez && (
            <div className="border-b border-orquidea-50 bg-orquidea-05 p-4">
              <p className="font-mono text-[10px] uppercase tracking-widest text-orquidea">
                Antes de votar
              </p>
              <h2 className="mt-2 font-display text-base font-bold leading-tight text-blanco">
                Dile al hub con qué nombre estás.
              </h2>
              <p className="mt-2 text-[12px] leading-5 text-blanco-70">
                Cada voto queda firmado con un nombre de tu equipo. Eso permite
                ver quién aprobó qué y cambiar el voto después si te equivocaste.
              </p>
              <ul className="mt-3 space-y-2 text-[12px] leading-5 text-blanco-70">
                <li className="flex gap-2">
                  <span aria-hidden="true" className="text-orquidea">01</span>
                  <span>Elige tu nombre en la lista de abajo. Queda guardado en este navegador.</span>
                </li>
                <li className="flex gap-2">
                  <span aria-hidden="true" className="text-orquidea">02</span>
                  <span>Desde ahí puedes votar en cualquier idea, sin volver a preguntarte.</span>
                </li>
                <li className="flex gap-2">
                  <span aria-hidden="true" className="text-orquidea">03</span>
                  <span>Si votaste con otro nombre, vuelve a este botón y cámbialo.</span>
                </li>
              </ul>
              <button
                type="button"
                onClick={cerrarSinElegir}
                className="mt-4 flex min-h-[44px] w-full items-center justify-center gap-2 border border-orquidea-50 px-3 font-mono text-[11px] text-orquidea transition-colors hover:bg-orquidea-10"
              >
                ENTENDIDO, ELIJO ABAJO <Icon name="arrow" size={13} />
              </button>
            </div>
          )}

          <p className="shrink-0 border-b border-blanco-10 p-3 font-mono text-[10px] leading-4 text-blanco-50">
            {primerVez
              ? `${todos.length} nombres en esta lista. El tuyo es el que usas para votar.`
              : 'Con qué nombre de este equipo vas a votar. Puedes cambiarlo entre ideas: el elegido se recuerda en este navegador.'}
          </p>
          {/* MEDIDO 2026-10-05: la lista scrollea sola, el aviso no. Con 21
              nombres en `equipo` el menú crecía sin límite y empujaba el botón
              «OLVIDAR ESTE PERFIL» fuera de la pantalla. */}
          <div className="min-h-0 flex-1 overflow-y-auto">
          <ul>
            {equipo.map((p) => fila(p, elegido, setAbierto))}
          </ul>
          {clientesTraidos.length > 0 && (
            <>
              {/* El cliente se separa del equipo porque EL se busca a si mismo en
                  esta lista. Mezclados, «Cliente Wundeer 1» caia entre veinte
                  nombres del equipo y no se encontraba. */}
              <p className="border-y border-blanco-10 bg-blanco-05 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-blanco-50">
                Del cliente
              </p>
              <ul>
                {clientesTraidos.map((p) => fila(p, elegido, setAbierto))}
              </ul>
            </>
          )}
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