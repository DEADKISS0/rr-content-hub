'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Icon } from './ui/icons';

/**
 * Modo guía.
 *
 * Por qué existe: medido el 2026-09-26, el tablero tenía **47 cosas clicables,
 * 47 etiquetas distintas, 33 encabezados y 822 palabras** en una sola pantalla,
 * y ninguna explicación al abrir. Un adulto ocupado se pierde; un niño o una
 * persona mayor, más.
 *
 * Esto no agrega funciones: agrega UNA. Un recuadro se posa sobre cada botón
 * importante y lo explica en español llano, con "siguiente" y "atrás". Se abre
 * solo la primera vez (queda en localStorage), y siempre se puede volver a
 * abrir con el botón flotante de abajo a la derecha.
 *
 * Reglas de estilo que respeta: esquinas duras, borde 2px, texto mono para las
 * etiquetas, y solo clases de animación que ya viven dentro de
 * `prefers-reduced-motion`.
 */
const CLAVE = 'rr-hub-guia-v1';

type Paso = { target: string; titulo: string; texto: string };

/** El tablero: de lo general a lo particular, en el orden en que se usa. */
const PASOS_TABLERO: Paso[] = [
  {
    target: 'aside',
    titulo: 'Este es el menú',
    texto: 'Está a la izquierda. Cada línea te lleva a una parte del hub. Nada de lo que toques aquí borra información: puedes tocar sin miedo.',
  },
  {
    // El botón de crear es condicional: un rol de solo lectura no lo ve, y la
    // guía no puede apuntar a algo que no existe para todo el mundo. El header
    // siempre está, así que la guía señala el sitio y el texto explica la regla.
    target: 'header',
    titulo: 'Aquí se crea una pieza',
    texto: 'El botón de la derecha suma una idea. Antes de entrar, el hub te pide lo que falta paso a paso. Si tu rol es de solo lectura, aquí verás "solo lectura" en vez del botón.',
  },
  {
    target: 'section[aria-label="Guía del flujo"]',
    titulo: 'Estos son los cuatro pasos',
    texto: 'Toda pieza hace el mismo recorrido: idea, guion, producción y publicado. El número grande dice cuántas piezas hay en cada paso. Si tocas un paso, abajo te quedan solo esas.',
  },
  {
    target: '.idea-card',
    titulo: 'Cada tarjeta es una pieza',
    texto: 'Arriba a la izquierda está su código: O1, P7. La franja de color del borde te dice de quién es el turno. Toca la tarjeta y se abre completa.',
  },
  {
    target: 'a[href$="/aprobaciones"]',
    titulo: 'Aquí ves lo que espera respuesta',
    texto: 'Si una pieza lleva días parada, aparece en esta lista. Es lo primero que conviene mirar cada día.',
  },
  {
    target: 'a[href$="/roadmap"]',
    titulo: 'Y aquí, el plan completo',
    texto: 'Cuánto falta para cerrar cada tramo del proyecto. Sirve para saber si vamos al día sin tener que preguntarle a nadie.',
  },
];

/** La ficha de una pieza. */
const PASOS_FICHA: Paso[] = [
  {
    target: 'main h1',
    titulo: 'Esta es tu pieza',
    texto: 'Arriba está el nombre y, al lado, en qué punto va. Las etiquetas de color te dicen si está completa o si le faltan datos.',
  },
  {
    target: '[data-guia="accion"]',
    titulo: 'Lo primero: qué hacer ahora',
    texto: 'Este recuadro dice quién tiene la pelota y te da el botón para mover la pieza. Si no te toca a ti, te lo dice y no te ofrece botones de más.',
  },
  {
    target: '[data-guia="brief"]',
    titulo: 'Esta es la referencia y su brief',
    texto: 'A la izquierda, el video real de la referencia. A la derecha, qué hay que copiar de ella: encuadre, talento, ritmo. El equipo trabaja con esto, no con el enlace suelto.',
  },
  {
    target: '[data-guia="comentarios"]',
    titulo: 'Y aquí se habla',
    texto: 'Cada decisión o duda queda escrita y la ven todos, desde cualquier computador. Nadie pierde el hilo en WhatsApp.',
  },
];

/** Las colas: lo que espera una decisión. */
const PASOS_COLA: Paso[] = [
  {
    target: 'main',
    titulo: 'Aquí está lo que no avanza solo',
    texto: 'Cada pieza de esta lista está esperando una respuesta de alguien. Están ordenadas por lo que más lleva parado: la de arriba es la más urgente.',
  },
  {
    target: 'a.idea-card',
    titulo: 'Toca una pieza para abrirla',
    texto: 'Se abre completa: qué falta, quién actúa y el botón para decidir. Con el botón de atrás del navegador vuelves a esta lista.',
  },
];

function pasosDe(ruta: string): Paso[] {
  if (/\/ideas\/[^/]+$/.test(ruta) && !ruta.endsWith('/nueva')) return PASOS_FICHA;
  if (/\/(aprobaciones|produccion|publicaciones)$/.test(ruta)) return PASOS_COLA;
  return PASOS_TABLERO;
}

export function GuidedTour() {
  const ruta = usePathname();
  const pasos = pasosDe(ruta ?? '');
  const [paso, setPaso] = useState<number | null>(null);
  const [caja, setCaja] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const tarjeta = useRef<HTMLDivElement>(null);
  const reducido = useRef(false);

  /**
   * MEDIDO 2026-10-03. Santiago: «el apartado de como se usa, para celular esta
   * totalmente dañado». Y tenía razón, medido en cuatro anchos:
   *
   *   390x844   zona de texto   40 px de alto   (necesita 284)
   *            SIGUIENTE       top=1087        (289 px POR DEBAJO de la pantalla)
   *
   * La causa: la tarjeta se colocaba pegada al elemento resaltado, con
   * `top: caja.top + caja.height + 24`. En escritorio el elemento está arriba y
   * eso cabe. En un celular el elemento resaltado puede estar en y=600, el
   * `top` daba 664, y la tarjeta —con `max-h`— se quedaba con el alto mínimo del
   * contenido y el resto se iba debajo. Los botones, que van al final, nunca se
   * veían: el tour no tenía salida en el móvil.
   *
   * En móvil la tarjeta deja de ir pegada al objetivo y pasa a ser un panel de
   * pantalla completa con el texto en una zona que se baja y los botones FIJOS
   * abajo, siempre visibles. Que es como funciona un tutorial en un teléfono.
   */
  const [movil, setMovil] = useState(false);
  useEffect(() => {
    const medir = () => setMovil(window.innerWidth < 768);
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, []);

  // La primera visita abre la guía sola. Terminarla o saltarla la marca vista:
  // una guía que vuelve a saltar en cada pantalla deja de ser ayuda y pasa a
  // ser estorbo. El botón flotante siempre está para volver a abrirla.
  useEffect(() => {
    reducido.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    try {
      if (window.localStorage.getItem(CLAVE) !== 'visto') {
        const t = window.setTimeout(() => setPaso(0), 700);
        return () => window.clearTimeout(t);
      }
    } catch {
      /* sin localStorage, no se abre sola */
    }
  }, []);

  const medir = useCallback((indice: number) => {
    const objetivo = document.querySelector(pasos[indice]?.target ?? '');
    if (!objetivo) {
      setCaja(null);
      return false;
    }
    const r = objetivo.getBoundingClientRect();
    setCaja({ top: r.top, left: r.left, width: r.width, height: r.height });
    return true;
  }, [pasos]);

  /** ¿Ya se ve entero? Entonces no movemos la página: moverla marea. */
  const yaSeVe = useCallback((objetivo: Element) => {
    const r = objetivo.getBoundingClientRect();
    return r.top >= 0 && r.bottom <= window.innerHeight && r.left >= 0 && r.right <= window.innerWidth;
  }, []);

  // Al cambiar de paso: traer el objetivo a la vista y medirlo. Si el objetivo
  // no existe en esta pantalla, el paso se salta solo. Todo el trabajo va
  // dentro del temporizador: el linter de React 19 rechaza (con razón) que un
  // efecto cambie estado en su propio cuerpo.
  useEffect(() => {
    if (paso === null) return;
    const t = window.setTimeout(() => {
      let n = paso;
      while (n < pasos.length && !document.querySelector(pasos[n].target)) n += 1;

      if (n !== paso) {
        setPaso(n < pasos.length ? n : null);
        return;
      }

      const objetivo = document.querySelector(pasos[n].target);
      if (!objetivo) return;
      if (!yaSeVe(objetivo)) {
        objetivo.scrollIntoView({ block: 'center', behavior: reducido.current ? 'auto' : 'smooth' });
        window.setTimeout(() => medir(n), reducido.current ? 0 : 300);
      } else {
        medir(n);
      }
      tarjeta.current?.focus({ preventScroll: true });
    }, reducido.current ? 0 : 80);
    return () => window.clearTimeout(t);
  }, [paso, pasos, medir, yaSeVe]);

  // El recuadro queda pegado al objetivo si la página se mueve.
  useEffect(() => {
    if (paso === null) return;
    const alMover = () => medir(paso);
    window.addEventListener('scroll', alMover, { passive: true });
    window.addEventListener('resize', alMover);
    return () => {
      window.removeEventListener('scroll', alMover);
      window.removeEventListener('resize', alMover);
    };
  }, [paso, medir]);

  const cerrar = useCallback(() => {
    try { window.localStorage.setItem(CLAVE, 'visto'); } catch { /* da igual */ }
    setPaso(null);
    setCaja(null);
  }, []);

  useEffect(() => {
    if (paso === null) return;
    const alTeclear = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cerrar();
      if (event.key === 'ArrowRight') setPaso((n) => (n === null ? n : Math.min(n + 1, pasos.length - 1)));
      if (event.key === 'ArrowLeft') setPaso((n) => (n === null ? n : Math.max(n - 1, 0)));
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [paso, pasos.length, cerrar]);

  const abierto = paso !== null;
  const ultimo = paso === pasos.length - 1;

  return (
    <>
      {/* Siempre disponible: la guía no se esconde después de la primera vez.

          En móvil el botón baja a la esquina y NO tapa el texto. Ser `fixed`
          encima del contenido se midió en 20 posiciones de scroll: con el texto
          completo tapaba entre 9 y 14 elementos en todas, y aun reducido al
          ícono seguía pisando el brief (`// INTENCIÓN` y su párrafo) porque
          ese bloque ocupa todo el ancho de la columna.

          Un botón flotante encima de texto de ancho completo no tiene arreglo
          por tamaño. Así que en móvil se le deja su propia franja: es un botón
          de ancho completo pegado abajo, fuera del flujo del texto, y la
          página reserva ese alto con `padding-bottom`. Se sigue viendo, se
          sigue tocando, y no pisa el brief.

          En escritorio sigue siendo el botón flotante de la esquina: ahí hay
          sitio de sobra y nunca estorba. */}
      {/* MEDIDO 2026-10-02 (auditoria del frontend): este boton y el
          `INSTALAR EL HUB` comparten `sm:bottom-4 sm:right-4` con el mismo
          `z-40`. Sin z distinto gana el ultimo en el DOM, y `InstalarApp` se
          monta DESPUES de los hijos en `layout.tsx`: el instalador tapaba la
          guia. Aqui la guia sube a `sm:bottom-20` y quedan apilados sin
          solaparse. */}
      <button
        type="button"
        onClick={() => setPaso(0)}
        /* MEDIDO 2026-10-03: esto era `bottom-0 left-0 right-0 w-full h-12`, una
           barra que cruzaba la pantalla entera en el móvil y tapaba el borde
           inferior de la lista. En un teléfono un botón de ayuda va en su
           esquina, como en escritorio, y ocupa lo que ocupa. */
        className="fixed bottom-3 left-3 z-40 inline-flex min-h-[44px] items-center justify-center gap-2 border border-blanco-20 bg-negro px-3 font-mono text-xs text-blanco-70 transition-colors hover:bg-blanco-10 hover:text-blanco sm:bottom-20 sm:left-auto sm:right-4 sm:px-3 sm:py-2"
        aria-label="Abrir la guía: te explica cada botón"
        title="¿Cómo se usa?"
      >
        <Icon name="eye" size={16} />
        <span>¿CÓMO SE USA?</span>
      </button>

      {abierto && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="guia-titulo">
          {/* El recuadro que se posa sobre el botón. La sombra gigante atenúa
              el resto lo justo para que el foco se lea, sin borrar la página:
              el objetivo es explicar lo que ya se ve, no taparlo.
              El `pointer-events-none` NO está en este div a propósito: sin él,
              el recuadro gigante se come los clics de toda la pantalla y el
              usuario queda encerrado en la guía. Por eso el overlay tampoco
              cierra al hacer clic fuera — cerrarlo sería un descuido. Lo que
              se puede es saltar, con Escape o el botón. */}
              {/* MEDIDO 2026-10-03: en móvil el recuadro se descarta. El objetivo se
             orce outside y el panel ocupa casi toda la pantalla; un borde de
              300 px pegado a un elemento que no se ve solo añade ruido. */}
          {caja && !movil && (
            <div
              aria-hidden="true"
              className="pointer-events-none fixed border-2 border-mostaza"
              style={{
                top: Math.max(4, caja.top - 6),
                left: Math.max(4, caja.left - 6),
                width: Math.min(caja.width + 12, window.innerWidth - 8),
                height: caja.height + 12,
                boxShadow: '0 0 0 9999px rgba(7,0,1,0.45)',
              }}
            />
          )}
          {(movil || !caja) && <div aria-hidden="true" className="pointer-events-none fixed inset-0 bg-negro/45" />}

          <div
            ref={tarjeta}
            tabIndex={-1}
            className={`anim-pop fixed flex flex-col border border-blanco-30 bg-negro outline-none ${
              movil
                ? 'inset-x-3 top-3 max-h-[calc(100dvh-6.5rem)] rounded-none'
                /* MEDIDO 2026-10-03 a 1440x900: el popup daba 544x434, el 48% de
                   la altura de la pantalla, para un texto de tres líneas y 170
                   caracteres. Lo que se pide es que RODEE EL MENSAJE, no que
                   ocupe media pantalla. `w-fit` + `max-w` deja que la caja tenga
                   el ancho del texto más largo y nada más; el `max-h` sigue
                   guarding casos de un texto largo en una pantalla chica. */
                : 'left-1/2 w-fit max-w-[min(34rem,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] -translate-x-1/2 overflow-y-auto p-5'
            }`}
            /*
             * MEDIDO 2026-10-01: esto estaba anclado con
             *   top: Math.min(caja.top + caja.height + 24, window.innerHeight - 220)
             * y el 220 era una suposición sobre lo que mide la tarjeta. Mide más:
             * título, texto y tres botones. Con el `top` ya calculado, los botones
             * caían por debajo del borde inferior (SALTAR en y=678 con una
             * ventana de 664) y el overlay, que no lleva `pointer-events-none`,
             * se comía el toque. La app entera quedaba bloqueada sin salida.
             *
             * Ahora: se da `top` Y `bottom`, y el navegador resuelve la
             * diferencia. La tarjeta nunca puede salirse de la ventana por abajo
             * porque su borde inferior está anclado a la ventana, no a un cálculo.
             * `max-h` + `overflow-y-auto` por si el texto es largo de verdad.
             * `dvh` y no `vh`: en iPhone la barra del navegador encoge el `vh`.
             */
            style={movil || !caja || caja.top >= window.innerHeight / 2
              ? undefined
              // El `top` se acota a media pantalla: por muy abajo que esté el
              // elemento resaltado, la tarjeta nunca puede arrancar donde no
              // queda sitio para ella. Antes no había cota y en móvil eso era
              // exactamente el corte.
              : { top: Math.min(Math.max(16, caja.top + caja.height + 24), window.innerHeight / 2), bottom: 16 }}
          >
            {/* MEDIDO 2026-10-03: en móvil el contenido se separa en dos. El texto
                se baja solo en una zona con `overflow-y-auto`, y los botones van
                FUERA de esa zona, fijos abajo. Antes todo iba en el mismo bloque
                scrolleable: los botones quedaban al final de un texto largo, es
                decir, fuera de la pantalla, y el tour no tenía salida.

                `flex-1 min-h-0` es lo que hace el reparto: sin `min-h-0` un
                hijo flexible no baja de su alto de contenido y el padre se
                desborda en lugar de dejar que el hijo se encoja. */}
            <div className={`flex min-h-0 flex-1 flex-col ${movil ? 'overflow-hidden' : ''}`}>
              <div className={movil ? 'min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1' : ''}>
                <p className="font-mono text-[11px] tracking-[0.1em] text-blanco-60 sm:text-xs sm:text-blanco-50">
                  PASO {paso! + 1} DE {pasos.length}
                </p>
                <h2 id="guia-titulo" className="mt-2 font-display text-2xl font-bold leading-tight text-blanco">
                  {pasos[paso!].titulo}
                </h2>
                <p className="mt-3 text-[15px] leading-7 text-blanco-80 sm:text-lg sm:leading-8">{pasos[paso!].texto}</p>
              </div>

              <div className={`flex flex-wrap items-center gap-3 ${
                movil
                  ? 'shrink-0 border-t border-blanco-20 bg-negro pt-3 pb-1'
                  : 'mt-5'
              }`}>
              {paso! > 0 && (
                <button
                  type="button"
                  onClick={() => setPaso((n) => Math.max(0, (n ?? 0) - 1))}
                  className="inline-flex min-h-[44px] items-center gap-2 border border-blanco-20 px-3 py-2 font-mono text-xs text-blanco-60 transition-colors hover:border-blanco-40 hover:text-blanco"
                >
                  ← ATRÁS
                </button>
              )}
              <button
                type="button"
                onClick={() => (ultimo ? cerrar() : setPaso((n) => (n ?? 0) + 1))}
                className="btn-brutal inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 sm:flex-none"
              >
                {ultimo ? 'YA ENTENDÍ' : 'SIGUIENTE'} <Icon name="arrow" size={14} />
              </button>
              {/* MEDIDO: este botón medía 16px de alto. En un dedo no se
                  pincha, y era la única salida del tour en un iPhone. Mínimo
                  táctil de 44px, como el resto de la app. */}
              <button
                type="button"
                onClick={cerrar}
                className="inline-flex min-h-[44px] items-center px-3 font-mono text-xs text-blanco-60 underline transition-colors hover:text-blanco"
              >
                {ultimo ? 'CERRAR' : 'SALTAR'}
              </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
