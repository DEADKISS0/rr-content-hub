'use client';

import { useCallback, useState } from 'react';
import { Icon } from './ui/icons';
import { Chip } from './ui/chips';
import { voteIdea, type VotoResultado } from '@/lib/workspace-client';
import { emailElegido } from '@/lib/perfil-votante';
import { useVotosEnVivo } from '@/lib/use-votos-vivo';
import { votosParaDecidir, VOTOS_NECESARIOS, type DecisionVoto } from '@/lib/flow';

/**
 * Votar sin abrir la ficha.
 *
 * MEDIDO 2026-10-01 (auditoría): 19 ideas de Wundeer carrying `voting` con CERO
 * votos, y de las 18 personas con acceso al cliente, 14 nunca han votado. La
 * votación funciona —probada de verdad, `{"aFavor": 1}`—, así que no es un
 * botón roto.
 *
 * El botón de votar vivía DENTRO de la ficha. Contando menciones de "votar" en
 * las pantallas: cero en el tablero, cero en el banco, cero en aprobaciones.
 * Para votar había que abrir el banco, encontrar la pieza, abrirla, y entonces
 * aparecía el botón. Nadie abre 19 fichas para decidir cuál de 19 vale.
 *
 * El sistema funcionaba y nadie lo tocaba. Eso se congela igual que una bandeja
 * de entrada.
 *
 * Este bloque es el mismo `voteIdea()` que usa la ficha, con el mismo token y
 * la misma sesión. No es un voto rápido ni un voto de segunda: es la misma
 * llamada. Lo que cambia es dónde se puede pulsar.
 *
 * Lo que NO hace, a propósito:
 * - No permite cambiar la decisión a "cambios" ni poner nota. Eso sí necesita
 *   texto, y un campo de texto dentro de una tarjeta del tablero es un popup.
 *   Para eso está la ficha. Aquí solo se vota sí o no, que es lo que hace falta
 *   para desbloquear las 19.
 * - No dice "quedan N" sin decir de qué. La cuenta la hace `votosParaDecidir`,
 *   que es la función del dominio, no una resta en el componente.
 */
export function VoteQuick({
  ideaId,
  slug,
  inicial,
  contenedorClase,
}: {
  ideaId: string;
  /** El cliente: hace falta para preguntar por SUS votaciones en vivo. */
  slug: string;
  /** Conteo que llega del servidor, igual que en la ficha. */
  inicial: { aFavor: number; enContra: number };
  /**
   * MEDIDO 2026-10-04: la tarjeta del tablero usa `after:inset-0` en el título
   * para que toda la caja abra la ficha (stretched link). Ese pseudo se estira
   * a TODA la tarjeta y se come estos botones: con el dedo, `elementFromPoint`
   * en «A FAVOR» devuelve el `<a>` del título. El voto se ve y no se puede
   * tocar, en el celular; en escritorio el hover lo disimula.
   *
   * Por eso esta prop existe y no se fija aqui: quien decide la posición es la
   * tarjeta, que es quien tiene el contexto de que hay un pseudo por encima.
   * Encerrarlo en un `<div>` desde fuera rompía el aserto que garantiza que el
   * botón solo sale en ideas en votación.
   */
  contenedorClase?: string;
}) {
  /**
   * MEDIDO 2026-10-03. Este botón se quedaba en el número con el que se pintó la
   * página, mientras la ficha sí se actualizaba sola. MEDIDO: en el tablero, el
   * "FALTAN 2 DE 3" seguía diciendo 2 después de que otro votara.
   *
   * Se conecta al mismo hook, y con el mismo reparto: con 19 ideas en votación
   * hay 19 tarjetas preguntando. Por eso el hook no pregunta con la pestaña
   * oculta y por eso el endpoint responde con `max-age` de 10 s: el navegador
   * sirve la misma respuesta a varias tarjetas sin volver a pedirla.
   */
  const { conteo } = useVotosEnVivo(slug, ideaId, {
    aFavor: inicial.aFavor,
    enContra: inicial.enContra,
    cambios: 0,
    total: inicial.aFavor + inicial.enContra,
    ultimo: null,
  });

  /** El voto propio manda sobre el del servidor, igual que en la ficha. */
  const [propio, setPropio] = useState<{ aFavor: number; enContra: number } | null>(null);
  const aFavor = propio?.aFavor ?? conteo.aFavor;
  const enContra = propio?.enContra ?? conteo.enContra;

  const [enviando, setEnviando] = useState(false);
  const [fallo, setFallo] = useState('');
  const [guardado, setGuardado] = useState<DecisionVoto | null>(null);

  // `votosParaDecidir` devuelve un NÚMERO, no un objeto: cuántos sí (o no)
  // faltan para que la votación se decida. La cuenta la hace el dominio, no
  // esta pantalla. Es la misma función que usa la ficha.
  const faltan = votosParaDecidir(aFavor, enContra);

  const votar = useCallback(
    async (decision: DecisionVoto) => {
      if (enviando) return;
      setEnviando(true);
      setFallo('');
      // MEDIDO 2026-10-03: este botón NO mandaba perfil, así que el servidor
      // caía al correo de la sesión. Y aquí, en el tablero, casi siempre no hay
      // ninguna: quien abre el hub sin puerta recibía «no entra con tu correo»
      // y el botón se quedaba sin efecto. MEDIDO: el clic se registraba y no
      // pasaba nada en la base.
      const resultado: VotoResultado = await voteIdea(ideaId, decision, '', emailElegido());
      setEnviando(false);
      if (resultado.error) {
        setFallo(resultado.error);
        return;
      }
      setPropio({ aFavor: resultado.aFavor ?? 0, enContra: resultado.enContra ?? 0 });
      // El rebote dura poco y se va: es la confirmación de que el servidor
      // guardó, no un estado que se quede puesto y parezca seleccionado.
      setGuardado(decision);
      window.setTimeout(() => setGuardado(null), 900);
      // Si la votación se decidió con este voto, el tablero entero cambia: la
      // pieza sale al cliente. Se recarga para que las columnas cuadren.
      if (resultado.votacion === 'ganada' || resultado.votacion === 'perdida') {
        window.setTimeout(() => window.location.reload(), 1100);
      }
    },
    [enviando, ideaId],
  );

  return (
    <div className={`mt-3 border-t border-blanco-10 pt-3 ${contenedorClase ?? ''}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[9px] text-blanco-40">
          {faltan > 0 ? `FALTAN ${faltan} DE ${VOTOS_NECESARIOS}` : 'DECIDIDA'}
        </span>
        <span className="font-mono text-[9px] text-blanco-40">
          {aFavor} sí · {enContra} no
        </span>
      </div>

      <div className="mt-2 flex gap-1.5">
        <button
          type="button"
          onClick={() => void votar('yes')}
          disabled={enviando}
          aria-label={`Votar a favor. Faltan ${faltan} de ${VOTOS_NECESARIOS} votos`}
          className="inline-flex min-h-[36px] flex-1 items-center justify-center gap-1.5 border border-blanco-25 bg-blanco-05 font-mono text-[10px] uppercase tracking-[0.06em] text-blanco-80 transition-colors hover:border-mostaza hover:text-blanco disabled:opacity-50"
        >
          <Icon name="check" size={12} />
          {guardado === 'yes' ? 'GUARDADO' : 'A FAVOR'}
        </button>
        <button
          type="button"
          onClick={() => void votar('no')}
          disabled={enviando}
          aria-label={`Votar en contra. Faltan ${faltan} de ${VOTOS_NECESARIOS} votos`}
          className="inline-flex min-h-[36px] flex-1 items-center justify-center gap-1.5 border border-blanco-25 bg-blanco-05 font-mono text-[10px] uppercase tracking-[0.06em] text-blanco-80 transition-colors hover:border-fucsia hover:text-blanco disabled:opacity-50"
        >
          <Icon name="close" size={12} />
          {guardado === 'no' ? 'GUARDADO' : 'EN CONTRA'}
        </button>
      </div>

      {fallo && (
        <p className="mt-2 font-mono text-[9px] leading-4 text-fucsia">
          {/* El fallo se dice, no se esconde: si el voto no se guardó, quien
              lo tiene que saber, o cree que sí votó. */}
          {fallo}
        </p>
      )}

      {guardado && !fallo && (
        <p className="mt-2 flex items-center gap-1 font-mono text-[9px] text-mostaza">
          <Icon name="check" size={11} />
          VOTO GUARDADO
        </p>
      )}
    </div>
  );
}
