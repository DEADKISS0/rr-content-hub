'use client';

import { useCallback, useState } from 'react';
import { voteIdea, type VotoResultado } from '@/lib/workspace-client';
import { Icon } from '@/components/ui/icons';

/**
 * Votación interna de una idea.
 *
 * Lo que pidió Santiago: que en la ficha se vea cuántas votaciones lleva la idea
 * antes de subirla, y que el equipo pueda votar. Añadido el 2026-09-28: votar es
 * de alguien del equipo que ha entrado con su correo, no de un clic suelto.
 *
 * Decisiones que se tomaron y por qué:
 *
 * - **Solo el equipo, y solo activo.** El token del navegador sigue estando —es
 *   lo que impide que dos clics del mismo navegador cuenten como dos personas—
 *   pero ya no es identidad. La identidad es la sesión: su correo tiene que
 *   estar en la lista blanca del equipo y con la fila activa. Antes bastaba con
 *   inventar un token, y el conteo que decide si una pieza avanza al cliente lo
 *   podía falsear cualquiera que abriera la URL.
 *
 * - **Mayoría simple, no un número fijo.** Es la regla que eligió Santiago: sale
 *   si hay más votos a favor que en contra. Con un número fijo, una idea con dos
 *   votos a favor y uno en contra se quedaba parada, que es lo contrario de lo
 *   que se busca.
 *
 * - **El contador se lee del servidor, nunca se acumula en local.** Si el
 *   navegador sumara, recargar la página bastaría para inflar la votación.
 *
 * - **Cuando la idea se mueve, el bloque desaparece solo.** Si ganó la votación,
 *   la idea ya no está en `voting` y los botones pierden sentido: aquí se
 *   muestra el resultado y nada más.
 */
export function IdeaVoting({
  ideaId,
  status,
  inicial,
}: {
  ideaId: string;
  status: string;
  /** Conteo que llega del servidor al pintar la ficha. */
  inicial: { aFavor: number; enContra: number };
}) {
  const [aFavor, setAFavor] = useState(inicial.aFavor);
  const [enContra, setEnContra] = useState(inicial.enContra);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [fallo, setFallo] = useState('');

  const total = aFavor + enContra;

  // Solo hay algo que hacer en `voting`. En cualquier otro estado el bloque
  // informa, o desaparece si nunca hubo votación.
  const abierto = status === 'voting';

  const votar = useCallback(async (decision: 'yes' | 'no') => {
    if (enviando) return;
    setEnviando(true);
    setFallo('');
    setAviso('');

    const resultado: VotoResultado = await voteIdea(ideaId, decision);
    setEnviando(false);

    if (resultado.error) { setFallo(resultado.error); return; }

    setAFavor(resultado.aFavor ?? 0);
    setEnContra(resultado.enContra ?? 0);

    if (resultado.gano) {
      // La idea ya salió al cliente. Se avisa y se recarga para que la ficha
      // entera (estado, botón de siguiente paso) quede coherente: votar no
      // refleja solo un número, refleja un cambio de fase.
      setAviso('Aprobada por mayoría. La idea ya pasó a revisión del cliente.');
      window.setTimeout(() => window.location.reload(), 1400);
    } else if (decision === 'yes') {
      setAviso('Tu voto a favor quedó registrado. Falta que se adelante al de los demás.');
    } else {
      setAviso('Tu voto en contra quedó registrado.');
    }
  }, [ideaId, enviando]);

  // Nunca votada y ya fuera de votación: no hay nada que contar y no hay nada
  // que hacer. Poner un "0 votos" en una pieza publicada sería ruido.
  if (!abierto && total === 0) return null;

  return (
    <div className="border border-blanco-20 p-5 anim-rise" data-guia="votacion">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="mono-label text-blanco-50">// VOTACIÓN INTERNA</p>
        <p className="font-mono text-[10px] text-blanco-50">
          {total === 0 ? 'SIN VOTOS TODAVÍA' : `${total} ${total === 1 ? 'VOTO' : 'VOTOS'}`}
        </p>
      </div>

      {/* El contador va con palabras además de con cifras: si alguien no
          distingue fucsia de mostaza, "3 a favor / 1 en contra" sigue leyéndose. */}
      <div className="mt-4 flex items-baseline gap-5">
        <p className="font-display text-4xl font-bold text-orquidea">{aFavor}</p>
        <p className="font-mono text-[10px] uppercase tracking-wide text-blanco-50">
          a favor
          <br />
          <span className="text-blanco-40">sale si gana</span>
        </p>
        <p className="ml-auto font-display text-4xl font-bold text-blanco-40">{enContra}</p>
        <p className="font-mono text-[10px] uppercase tracking-wide text-blanco-50">
          en contra
          <br />
          <span className="text-blanco-40">deja la idea parada</span>
        </p>
      </div>

      {abierto ? (
        <>
          <p className="mt-4 text-xs leading-5 text-blanco-60">
            Sale al cliente con más votos a favor que en contra. Puedes cambiar tu
            voto: el último vale.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => votar('yes')}
              disabled={enviando}
              className="btn-brutal inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon name="check" size={13} />
              {enviando ? 'ENVIANDO…' : 'VOTO A FAVOR'}
            </button>
            <button
              type="button"
              onClick={() => votar('no')}
              disabled={enviando}
              className="btn-ghost inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon name="close" size={13} />
              VOTO EN CONTRA
            </button>
          </div>
        </>
      ) : (
        <p className="mt-4 font-mono text-[10px] text-blanco-50">
          VOTACIÓN CERRADA · {aFavor} A FAVOR · {enContra} EN CONTRA
        </p>
      )}

      {aviso && (
        <p id="aviso-votacion" role="status" className="mt-4 border-l-4 border-l-orquidea bg-blanco-05 px-3 py-2 text-sm leading-6 text-blanco-80 anim-pop">
          {aviso}
        </p>
      )}
      {fallo && (
        <p id="aviso-votacion-error" role="alert" className="mt-4 border-l-4 border-l-mostaza bg-blanco-05 px-3 py-2 text-sm leading-6 text-blanco-80 anim-pop">
          {fallo}
        </p>
      )}
    </div>
  );
}
