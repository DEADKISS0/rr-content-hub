'use client';

import { useCallback, useState } from 'react';
import { voteIdea, type VotoResultado } from '@/lib/workspace-client';
import { estadoVotacion, votosParaDecidir, VOTOS_NECESARIOS } from '@/lib/flow';
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
 * - **Mayoría simple CON un mínimo de tres.** Santiago eligió mayoría simple el
 *   2026-09-28, y al medirla en producción salió el defecto: con "más sí que no"
 *   a secas, un solo voto a favor movía la pieza al cliente y quien pulsaba
 *   primero decidía por toda la casa. El 2026-09-29 añadió un mínimo de TRES
 *   votos, en los dos lados. Los números salen de `flow.ts`, no de aquí: si
 *   cambia el mínimo, esta pantalla lo dice solo.
 *
 * - **La pantalla dice cuántos votos faltan.** Un "1 a favor" a secas se lee como
 *   que va ganando, y no es así: es una votación incompleta. El número solo no
 *   informa de si decide o no.
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
  // La regla vive en el dominio: aquí solo se pinta lo que ya decidió. Si el
  // mínimo cambia en `flow.ts`, esta pantalla no se toca.
  const comoVa = estadoVotacion(aFavor, enContra);
  const faltan = votosParaDecidir(aFavor, enContra);

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

    // Lo que dice el servidor, no lo que el navegador supone. Antes, con un
    // voto a favor la respuesta decía "que se adelante" aunque la pieza ya
    // hubiera salido: el `gano` del cliente no miraba el mínimo de tres.
    if (resultado.votacion === 'ganada') {
      // La idea salió al cliente. Se avisa y se recarga para que la ficha entera
      // (estado, botón de siguiente paso) quede coherente: votar no refleja solo
      // un número, refleja un cambio de fase.
      setAviso('Aprobada. La idea ya pasó a revisión del cliente.');
      window.setTimeout(() => window.location.reload(), 1400);
    } else if (resultado.votacion === 'perdida') {
      setAviso('La votación se decidió en contra. La idea vuelve a revisión interna.');
      window.setTimeout(() => window.location.reload(), 1400);
    } else {
      const faltanAhora = resultado.faltan ?? 1;
      setAviso(
        `Tu voto quedó registrado. Falta${faltanAhora === 1 ? '' : 'n'} ${faltanAhora} `
        + `voto${faltanAhora === 1 ? '' : 's'} para que la votación decida `
        + `(hacen falta ${VOTOS_NECESARIOS}).`,
      );
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
          {/* El número solo no dice si la votación decide. Con el mínimo de tres,
              "1 a favor" se leería como que va ganando y no es así: está
              incompleta. La línea de debajo dice si falta y cuánto. */}
          {abierto && comoVa === 'esperando' && total > 0 && (
            <span className="text-mostaza"> · FALTAN {faltan}</span>
          )}
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
            Sale al cliente con más votos a favor que en contra, y hacen falta{' '}
            {VOTOS_NECESARIOS} votos para que la votación decida. Puedes cambiar tu
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
          VOTACIÓN {comoVa === 'ganada' ? 'GANADA' : comoVa === 'perdida' ? 'PERDIDA' : 'SIN DECIDIR'} ·{' '}
          {aFavor} A FAVOR · {enContra} EN CONTRA
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
