'use client';

import { useCallback, useState } from 'react';
import { Icon } from './ui/icons';
import { Chip } from './ui/chips';
import { voteIdea, type VotoResultado } from '@/lib/workspace-client';
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
  inicial,
}: {
  ideaId: string;
  /** Conteo que llega del servidor, igual que en la ficha. */
  inicial: { aFavor: number; enContra: number };
}) {
  const [aFavor, setAFavor] = useState(inicial.aFavor);
  const [enContra, setEnContra] = useState(inicial.enContra);
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
      const resultado: VotoResultado = await voteIdea(ideaId, decision);
      setEnviando(false);
      if (resultado.error) {
        setFallo(resultado.error);
        return;
      }
      setAFavor(resultado.aFavor ?? 0);
      setEnContra(resultado.enContra ?? 0);
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
    <div className="mt-3 border-t border-blanco-10 pt-3">
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
             .try lo tiene que saber, o Cree que sí votó. */}
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
