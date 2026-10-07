'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon, type IconName } from './ui/icons';
import { BriefRail, type BriefState } from './ui/meter';

/**
 * «Lo que falta de esta ficha», como algo que se abre.
 *
 * MEDIDO 2026-10-04, Santiago: «el apartado que dice lo que falta de esta ficha
 * que sea más interactivo o se me salte como en un pop up que son como las
 * cosas que me faltan, para que tenga toda la información».
 *
 * Antes eran cinco renglones de texto gris en una caja al FINAL de la columna
 * derecha. MEDIDO en 390 px: el bloque estaba en y=5817 con una página de 6423
 * px — al final de todo, a seis scrolls de donde empieza la ficha. Quien abría
 * una pieza leía el título y los botones de votar, y esa caja no la veía nunca.
 *
 * Por qué un popup y no un `<details>` como el de la trazabilidad: un details
 * despliega EN EL LUGAR, y aquí el sitio es el final de la columna. El popup
 * aparece donde está el botón, que es el sitio del problema.
 *
 * Y el popup no solo dice qué falta: dice qué hay ya. Un «lo que falta» que solo
 * enumera carencias obliga a ir a buscarlas; uno que también dice «ya tienes
 * guion y cámara» sirve para decidir sin moverse.
 */
export function PanelFaltan({ states, missing }: { states: BriefState[]; missing: BriefState[] }) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);

  // Escape y clic fuera, como el resto de capas del hub. Sin esto el panel
  // abierto se queda pegado y tapa la referencia de la pieza.
  useEffect(() => {
    if (!abierto) return;
    caja.current?.focus();
    const fuera = (e: PointerEvent) => {
      if (caja.current?.contains(e.target as Node)) return;
      if (boton.current?.contains(e.target as Node)) return;
      setAbierto(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false); };
    document.addEventListener('pointerdown', fuera);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', fuera);
      document.removeEventListener('keydown', esc);
    };
  }, [abierto]);

  const completos = states.length - missing.length;
  const listo = missing.length === 0;

  return (
    <div className="relative">
      {/* Cuando no falta nada no hay nada que abrir. Un botón que se abre para
          decir «está todo bien» es ruido, y la señal de que una pieza está lista
          tiene que leerse de un vistazo. */}
      {listo ? (
        <div className="border border-orquidea/40 bg-orquidea/5 p-5 anim-rise">
          <p className="mono-label text-orquidea">// FICHA COMPLETA</p>
          <p className="mt-3 font-mono text-[10px] leading-5 text-blanco-70">
            Los cinco datos están cargados. La pieza puede circular sin preguntas.
          </p>
          <div className="mt-4"><BriefRail states={states} /></div>
        </div>
      ) : (
        <>
          <button
            ref={boton}
            type="button"
            onClick={() => setAbierto((v) => !v)}
            aria-expanded={abierto}
            aria-controls="panel-faltan"
            className="w-full border border-mostaza/50 bg-mostaza/5 p-5 text-left transition-colors hover:border-mostaza hover:bg-mostaza/10 min-h-[44px] anim-rise"
          >
            <span className="flex items-start justify-between gap-3">
              <span className="min-w-0">
                <span className="mono-label block text-mostaza">// LO QUE FALTA DE ESTA FICHA</span>
                <span className="mt-2 block font-mono text-xs leading-5 text-blanco">
                  Faltan {missing.length} de {states.length} datos
                </span>
                <span className="mt-1 block font-mono text-[10px] leading-4 text-blanco-60">
                  Toca para ver los cinco y cuáles te faltan
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <BriefRail states={states} />
                <Icon
                  name={abierto ? 'chevron' : 'chevron'}
                  size={14}
                  className={`text-mostaza transition-transform duration-200 ${abierto ? 'rotate-180' : ''}`}
                />
              </span>
            </span>
          </button>

          {abierto && (
            <div
              id="panel-faltan"
              ref={caja}
              tabIndex={-1}
              role="dialog"
              aria-label="Lo que falta de esta ficha"
              className="anim-pop fixed inset-x-3 bottom-4 z-50 max-h-[70dvh] overflow-y-auto border border-mostaza bg-negro p-4 shadow-2xl sm:inset-x-auto sm:left-auto sm:right-6 sm:w-[24rem] sm:max-h-[60dvh]"
            >
              <div className="flex items-start justify-between gap-3 border-b border-blanco-10 pb-3">
                <div>
                  <p className="mono-label text-mostaza">// LO QUE FALTA</p>
                  <p className="mt-1 font-mono text-[10px] text-blanco-60">
                    {completos} de {states.length} listos
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAbierto(false)}
                  aria-label="Cerrar el panel de lo que falta"
                  className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center border border-blanco-20 text-blanco-60 transition-colors hover:border-blanco-40 hover:text-blanco"
                >
                  <Icon name="close" size={14} />
                </button>
              </div>

              <ul className="mt-3 space-y-px">
                {states.map((state) => {
                  const listoEste = state.done;
                  return (
                    <li
                      key={state.key}
                      className={`flex items-start gap-3 border-l-2 px-3 py-3 ${
                        listoEste ? 'border-orquidea/60 bg-blanco-05' : 'border-mostaza bg-mostaza/10'
                      }`}
                    >
                      <span className={`mt-0.5 shrink-0 ${listoEste ? 'text-orquidea' : 'text-mostaza'}`}>
                        <Icon name={state.icon as IconName} size={13} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-mono text-xs font-bold text-blanco">
                          {state.label}
                        </span>
                        <span className={`mt-0.5 block font-mono text-[10px] leading-4 ${listoEste ? 'text-blanco-60' : 'text-mostaza'}`}>
                          {listoEste ? 'YA ESTÁ CARGADO' : 'FALTA — se edita abajo en la ficha'}
                        </span>
                      </span>
                      <span className={`shrink-0 font-mono text-[10px] ${listoEste ? 'text-orquidea' : 'text-mostaza'}`}>
                        {listoEste ? 'LISTO' : 'FALTA'}
                      </span>
                    </li>
                  );
                })}
              </ul>

              <p className="mt-3 border-t border-blanco-10 pt-3 font-mono text-[10px] leading-4 text-blanco-50">
                Sin estos datos la pieza no está lista para ir al cliente. Se
                completan en EDITAR DATOS, dentro de la misma ficha.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}