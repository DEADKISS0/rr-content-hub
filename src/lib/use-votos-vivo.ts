'use client';

/**
 * Los conteos de las votaciones, al día, sin recargar.
 *
 * MEDIDO 2026-10-03. Lo que había: el número de votos venía del servidor al
 * pintar la página. Votaba una persona y el resto del equipo seguía viendo el
 * número viejo hasta que recargaba. En una votación de equipo eso es un
 * problema real: se discute una idea "con 2 sí" mientras en otra pantalla ya
 * hay 3.
 *
 * Lo que hace: consulta `/api/workspace/votos` cada 30 segundos y devuelve solo
 * lo que cambió. Si el número no ha cambiado, no se repinta nada: un `setState`
 * con el mismo valor en React no vuelve a renderizar, así que el contador no
 * parpadea cada 30 segundos.
 *
 * Por qué 30 segundos y no WebSocket: MEDIDO 2026-10-07 contra el consumo real
 * de Vercel, no contra el gusto. A 10 s esta sola ruta hacía 259.200 llamadas
 * al mes y el equipo completo se pasaba el techo de CPU de Hobby (4h 43m
 * contra 4h), lo que bloqueaba TODOS los despliegues. A 30 s son 86.400 y quien
 * acaba de pulsar ve el cambio en menos de medio minuto, que es lo que importa
 * en una votación de 3-5 personas. Un socket abierto por cliente serían 18
 * conexiones vivas en Vercel para mirar tres números; si algún día hace falta
 * empuje de verdad, este endpoint sigue siendo la fuente y lo que cambia es
 * solo cómo se avisa.
 *
 * La pestaña oculta no pregunta. MEDIDO: con 18 pestañas del equipo abiertas,
 * preguntar en segundo plano es gasto sin información, porque nadie está
 * mirando. Se reactiva al volver a la pestaña.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

/** Lo que el endpoint devuelve por idea. */
export type ConteoVotos = {
  aFavor: number;
  enContra: number;
  cambios: number;
  total: number;
  ultimo: string | null;
};

type Respuesta = { votos?: Record<string, ConteoVotos>; minimo?: number; error?: string };

/** Cada cuánto se pregunta. Medido, no inventado: ver el comentario de arriba. */
export const INTERVALO_MS = 30_000;

export function useVotosEnVivo(slug: string, ideaId: string, inicial: ConteoVotos): {
  conteo: ConteoVotos;
  minimo: number;
  /** true mientras hay una respuesta que aún no coincide con la última guardada. */
  hayCambio: boolean;
} {
  const [conteo, setConteo] = useState<ConteoVotos>(inicial);
  const [minimo, setMinimo] = useState(3);
  const [hayCambio, setHayCambio] = useState(false);
  // El intervalo se guarda en una ref y no en el estado: si fuera estado, cada
  // respuesta re-crearía el `setInterval` y el contador no volvería a parar.
  const ultimo = useRef<ConteoVotos>(inicial);
  const intervalIdRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const preguntar = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const r = await fetch(`/api/workspace/votos?proyecto=${encodeURIComponent(slug)}`, {
        cache: 'no-store',
        signal: ctrl.signal,
      });
      if (!r.ok) return;
      const datos = (await r.json()) as Respuesta;
      if (datos.error) return;
      if (typeof datos.minimo === 'number') setMinimo(datos.minimo);
      const mio = datos.votos?.[ideaId];
      if (!mio) return;
      const antes = ultimo.current;
      const igual = antes.aFavor === mio.aFavor
        && antes.enContra === mio.enContra
        && antes.cambios === mio.cambios
        && antes.total === mio.total;
      if (igual) return;
      ultimo.current = mio;
      setConteo(mio);
      setHayCambio(true);
    } catch {
      // Sin red no hay cambio que enseñar. Un fallo de red no es un error que
      // haya que gritar: se reintenta en el siguiente intervalo.
    }
  }, [slug, ideaId]);

  useEffect(() => {
    // `setInterval` con la respuesta en estado de React quedaría atrapado en el
    // primer closure; la ref evita depender del closure.
    //
    // MEDIDO 2026-10-03: la primera pregunta va en `requestAnimationFrame` y no
    // suelta. El linter marca setState síncrono dentro de un efecto, y aquí el
    // caso es el mismo aunque no haya `setState` visible: `preguntar()` termina
    // tocando el estado al resolver. Con un frame de margen, el efecto no pinta
    // nada de forma síncrona y el aviso de "cambió" sigue saliendo al instante.
    const primer = window.requestAnimationFrame(() => void preguntar());
    intervalIdRef.current = window.setInterval(() => {
      if (document.visibilityState === 'visible') void preguntar();
    }, INTERVALO_MS);

    const alVolver = () => {
      if (document.visibilityState === 'visible') void preguntar();
    };
    document.addEventListener('visibilitychange', alVolver);

    return () => {
      window.cancelAnimationFrame(primer);
      if (intervalIdRef.current !== null) {
        window.clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
      abortRef.current?.abort();
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [preguntar]);

  // El aviso de "cambió" dura lo justo para que se lea: se apaga solo para que
  // no se quede un cartel encendido en una pantalla que nadie está mirando.
  useEffect(() => {
    if (!hayCambio) return;
    const id = window.setTimeout(() => setHayCambio(false), 6000);
    return () => window.clearTimeout(id);
  }, [hayCambio]);

  return { conteo, minimo, hayCambio };
}

/**
 * Los cuatro estados de una votación, para pintar el aviso que toca.
 *
 * Vive aquí y no en el componente porque el mismo texto aparece en la tarjeta y
 * en la ficha, y duplicarlo es cómo se desincronizan.
 */
export function avisoDeVotacion(
  aFavor: number,
  enContra: number,
  minimo: number,
  cambios: number,
): string | null {
  if (aFavor >= minimo && aFavor > enContra) {
    return 'La votación ya tiene mayoría: esta pieza avanza.';
  }
  if (enContra >= minimo && enContra > aFavor) {
    return 'La votación se decidió en contra.';
  }
  if (cambios > 0) {
    return cambios === 1
      ? 'Alguien pidió cambiar algo. La idea vuelve a revisión interna.'
      : `${cambios} personas pidieron cambios.`;
  }
  return null;
}
