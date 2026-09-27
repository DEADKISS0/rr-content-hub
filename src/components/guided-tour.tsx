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
    target: 'header a[href$="/ideas/nueva"]',
    titulo: 'Este botón crea una pieza',
    texto: 'Tócalo cuando quieras sumar una idea. El hub te va pidiendo lo que falta, paso a paso, y no te deja avanzar si algo quedó en blanco.',
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
    target: '[data-guia="preview"]',
    titulo: 'Así se verá publicado',
    texto: 'Una vista de la referencia real. Si no hay referencia todavía, lo dice: nunca te muestra una foto inventada.',
  },
  {
    target: '[data-guia="brief"]',
    titulo: 'Aquí está el trabajo del equipo',
    texto: 'Qué se graba, cómo, quién actúa y cómo se edita. Todo lo que la pieza necesita para rodarse sin preguntar nada.',
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
      {/* Siempre disponible: la guía no se esconde después de la primera vez. */}
      <button
        type="button"
        onClick={() => setPaso(0)}
        className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 border border-blanco-20 bg-negro px-3 py-2 font-mono text-xs text-blanco-70 transition-colors hover:border-blanco-40 hover:bg-blanco-10 hover:text-blanco"
        aria-label="Abrir la guía: te explica cada botón"
      >
        <Icon name="eye" size={14} /> ¿CÓMO SE USA?
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
              {caja && (
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
          {!caja && <div aria-hidden="true" className="pointer-events-none fixed inset-0 bg-negro/45" />}

          <div
            ref={tarjeta}
            tabIndex={-1}
            className="anim-pop fixed bottom-4 left-1/2 w-[min(34rem,calc(100vw-2rem))] -translate-x-1/2 border border-blanco-30 bg-negro p-5 outline-none sm:bottom-8"
            style={caja && caja.top < window.innerHeight / 2
              ? { top: Math.min(caja.top + caja.height + 24, window.innerHeight - 220), bottom: 'auto' }
              : undefined}
          >
            <p className="font-mono text-xs tracking-[0.1em] text-blanco-50">
              PASO {paso! + 1} DE {pasos.length}
            </p>
            <h2 id="guia-titulo" className="mt-2 font-display text-2xl font-bold leading-tight text-blanco">
              {pasos[paso!].titulo}
            </h2>
            <p className="mt-3 text-base leading-7 text-blanco-70 sm:text-lg sm:leading-8">{pasos[paso!].texto}</p>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              {paso! > 0 && (
                <button
                  type="button"
                  onClick={() => setPaso((n) => Math.max(0, (n ?? 0) - 1))}
                  className="inline-flex items-center gap-2 border border-blanco-20 px-3 py-2 font-mono text-xs text-blanco-60 transition-colors hover:border-blanco-40 hover:text-blanco"
                >
                  ← ATRÁS
                </button>
              )}
              <button
                type="button"
                onClick={() => (ultimo ? cerrar() : setPaso((n) => (n ?? 0) + 1))}
                className="btn-brutal inline-flex items-center gap-2"
              >
                {ultimo ? 'YA ENTENDÍ' : 'SIGUIENTE'} <Icon name="arrow" size={14} />
              </button>
              <button
                type="button"
                onClick={cerrar}
                className="font-mono text-xs text-blanco-50 underline transition-colors hover:text-blanco"
              >
                {ultimo ? 'CERRAR' : 'SALTAR'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
