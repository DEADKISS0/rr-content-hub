'use client';

import { useCallback, useState } from 'react';
import { voteIdea, type VotoResultado } from '@/lib/workspace-client';
import { estadoVotacion, votosParaDecidir, VOTOS_NECESARIOS, type DecisionVoto } from '@/lib/flow';
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
  const [cambios, setCambios] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [fallo, setFallo] = useState('');
  // El panel de "cambio" y el de "nota" son el mismo control con dos textos
  // distintos. Se abre con el botón y se cierra solo al responder.
  const [pidiendo, setPidiendo] = useState<'change' | 'note' | null>(null);
  const [texto, setTexto] = useState('');

  const total = aFavor + enContra;
  // La regla vive en el dominio: aquí solo se pinta lo que ya decidió. Si el
  // mínimo cambia en `flow.ts`, esta pantalla no se toca.
  const comoVa = estadoVotacion(aFavor, enContra);
  const faltan = votosParaDecidir(aFavor, enContra);

  // Solo hay algo que hacer en `voting`. En cualquier otro estado el bloque
  // informa, o desaparece si nunca hubo votación.
  const abierto = status === 'voting';

  const votar = useCallback(async (decision: DecisionVoto, nota = '') => {
    if (enviando) return;
    setEnviando(true);
    setFallo('');
    setAviso('');

    const resultado: VotoResultado = await voteIdea(ideaId, decision, nota);
    setEnviando(false);

    if (resultado.error) { setFallo(resultado.error); return; }

    setAFavor(resultado.aFavor ?? 0);
    setEnContra(resultado.enContra ?? 0);
    setCambios(resultado.cambiosPedidos ?? 0);
    setPidiendo(null);
    setTexto('');

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
    } else if (decision === 'change') {
      // El cambio pedido mueve la pieza aunque no haya mínimo. Y hay que decirlo
      // claro: no es que "quedan votos", es que alguien pidió tocar algo y la idea
      // vuelve a escribirse. Dejarlo como un "faltan 3" escondería lo que pasó.
      const cuantos = resultado.cambiosPedidos ?? 1;
      setAviso(
        `Tu cambio quedó pedido (${cuantos} en total). La idea vuelve a revisión interna `
        + `para aplicar lo que pediste.`,
      );
      window.setTimeout(() => window.location.reload(), 2200);
    } else if (decision === 'note') {
      // La nota no cuenta ni frena: se dice eso mismo, para que nadie espere que
      // su nota haya movido nada.
      setAviso('Tu nota quedó con el equipo. No cuenta como voto ni detiene la votación.');
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
            {/* La tercera y la cuarta respuesta. Santiago, 2026-09-29: hacía
                falta poder decir "ni sí ni no, hay que cambiar algo" sin que
                eso fuera equivalente a votar en contra. Aquí se abre un campo
                para decir QUÉ, porque un cambio sin decir cuál no sirve.

                "Dejar una nota" es lo otro que pidió: comentar sin bloquear.
                Y avisa de que no cuenta, para que nadie espere que su nota mueva
                algo. */}
            <button
              type="button"
              onClick={() => { setPidiendo('change'); setTexto(''); }}
              disabled={enviando}
              className="btn-ghost inline-flex items-center gap-2 border-dashed disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon name="pen" size={13} />
              QUIERO QUE CAMBIEN ALGO
            </button>
            <button
              type="button"
              onClick={() => { setPidiendo('note'); setTexto(''); }}
              disabled={enviando}
              className="btn-ghost inline-flex items-center gap-2 border-dashed disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon name="comment" size={13} />
              DEJAR UNA NOTA
            </button>
          </div>

          {pidiendo && (
            <div className="mt-4 border border-mostaza-40 bg-mostaza-05 p-4 anim-rise">
              <label
                htmlFor="nota-votacion"
                className="mono-label block text-mostaza"
              >
                {pidiendo === 'change' ? '// QUÉ HAY QUE CAMBIAR' : '// TU NOTA PARA EL EQUIPO'}
              </label>
              <textarea
                id="nota-votacion"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                rows={3}
                maxLength={800}
                autoFocus
                placeholder={
                  pidiendo === 'change'
                    ? 'Por ejemplo: el gancho está bien pero el formato no cabe en 15 segundos.'
                    : 'Lo que quieras que sepas, sin que esto pare la votación.'
                }
                className="mt-2 w-full resize-y border border-blanco-20 bg-negro p-3 text-sm leading-6 text-blanco placeholder:text-blanco-30 focus:border-mostaza focus:outline-none"
              />
              <p className="mt-2 font-mono text-[10px] leading-4 text-blanco-50">
                {pidiendo === 'change'
                  ? 'Con esto la idea vuelve a revisión interna para aplicar el cambio. No es un voto en contra: no la tira, la devuelve.'
                  : 'Esto no cuenta como voto ni detiene la votación. Solo lo lee el equipo.'}
              </p>
              <div className="mt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => { setPidiendo(null); setTexto(''); }}
                  disabled={enviando}
                  className="btn-ghost"
                >
                  CANCELAR
                </button>
                <button
                  type="button"
                  onClick={() => void votar(pidiendo, texto)}
                  disabled={enviando || texto.trim().length === 0}
                  className="btn-brutal inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {enviando ? 'ENVIANDO…' : pidiendo === 'change' ? 'PEDIR EL CAMBIO' : 'ENVIAR LA NOTA'}
                </button>
              </div>
            </div>
          )}

          {cambios > 0 && !pidiendo && (
            <p className="mt-4 border-l-4 border-l-mostaza bg-mostaza-05 px-3 py-2 text-sm leading-6 text-mostaza">
              {cambios === 1
                ? 'Alguien pidió cambiar algo. La idea está en revisión interna hasta que se aplique.'
                : `${cambios} personas pidieron cambios. La idea está en revisión interna hasta que se apliquen.`}
            </p>
          )}
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
