'use client';

import { useEffect, useState } from 'react';
import { Icon } from './ui/icons';

/**
 * Quién del equipo está conectado, y qué estado tiene cada uno.
 *
 * Los tres estados que pidió Dirección, con su sentido:
 *
 *   DESCONECTADO  — nunca ha entrado, o su sesión caducó.
 *   ACTIVO        — entró al menos una vez, pero ahora mismo no está.
 *   CONECTADO     — está en línea; su latido llega cada 30 segundos.
 *
 * Por qué "activo" y no "desconocido": la diferencia importa. "Nunca ha
 * entrado" dice que hay que perseguir a alguien; "estuvo pero no está" dice que
 * solo hay que esperar. Sin esa distinction el equipo no sabe a quién
 * escribirse.
 *
 * El latido lo manda este componente, no la página: así funciona en todas las
 * pantallas sin que cada una se acuerde de hacerlo.
 */

const VENTANA_ONLINE_MS = 5 * 60 * 1000;
/**
 * Cada cuánto se manda el latido. MEDIDO 2026-10-07: estaba en 30 s, y como
 * `Latido` vive en el layout raíz eso era un latido en TODA página abierta del
 * hub — 86.400 llamadas al mes por pestaña, cada una con un `upsert` en
 * `rr_hub_presencia`. Con `VENTANA_ONLINE_MS` de 5 minutos, un latido de 120 s
 * deja el estado "conectado" exactamente igual de cierto por cuarta parte del
 * gasto, y son 64.800 escrituras menos al mes.
 */
const CADA_CUANTO_MS = 120_000;

/**
 * Tope de renglones por bloque.
 *
 * MEDIDO 2026-10-04: sin tope, `rr_hub_presencia` con 247 filas hacia que la
 * ficha midiera 10.720 px en un movil de 390 y la votacion quedara inalcanzable.
 * Este numero es un seguro, no una regla: con el equipo real (21 perfiles) nunca
 * se llega, y si manana hay 60 personas conectadas a la vez el bloque sigue
 * siendo usable porque el resto queda plegado.
 */
const MAX_RENGLONES = 20;

export type Presencia = {
  email: string;
  nombre: string | null;
  /** Último latido, en ISO. `null` = nunca ha entrado. */
  lastSeenAt: string | null;
};

export type Estado = 'desconectado' | 'activo' | 'conectado';

export function estadoDe(presencia: Presencia, ahora: number = Date.now()): Estado {
  if (!presencia.lastSeenAt) return 'desconectado';
  const visto = Date.parse(presencia.lastSeenAt);
  if (Number.isNaN(visto)) return 'desconectado';
  return ahora - visto <= VENTANA_ONLINE_MS ? 'conectado' : 'activo';
}

/** "hace 4 min" / "hace 2 h" / "nunca". Sin librería: son tres casos. */
function desdeCuando(iso: string | null, ahora: number = Date.now()): string {
  if (!iso) return 'nunca ha entrado';
  const ms = ahora - Date.parse(iso);
  if (Number.isNaN(ms)) return 'nunca ha entrado';
  if (ms < 60_000) return 'ahora mismo';
  if (ms < 3_600_000) return `hace ${Math.floor(ms / 60_000)} min`;
  if (ms < 86_400_000) return `hace ${Math.floor(ms / 3_600_000)} h`;
  return `hace ${Math.floor(ms / 86_400_000)} d`;
}

const TONO: Record<Estado, { clase: string; texto: string }> = {
  conectado: { clase: 'text-orquidea border-orquidea', texto: 'CONECTADO' },
  activo: { clase: 'text-mostaza border-mostaza', texto: 'ACTIVO' },
  desconectado: { clase: 'text-blanco-40 border-blanco-20', texto: 'DESCONECTADO' },
};

/**
 * El que manda el latido. Se monta una vez, en el layout, y no pinta nada:
 * existe para que "estar conectado" sea un hecho y no una suposición de la
 * interfaz. Si este componente falta, todo el mundo sale "activo" para siempre.
 */
export function Latido() {
  useEffect(() => {
    const sesionId = (() => {
      const clave = 'rr-hub-sesion-v1';
      const previa = window.localStorage.getItem(clave);
      if (previa) return previa;
      const nueva = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      window.localStorage.setItem(clave, nueva);
      return nueva;
    })();

    const marcar = () => {
      // `keepalive` para que el último latido salga aunque se cierre la pestaña.
      void fetch('/api/presencia', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sesionId }),
        keepalive: true,
      }).catch(() => {
        // Un latido fallido no puede romper la página: la presencia es un extra.
      });
    };

    marcar();
    const reloj = window.setInterval(marcar, CADA_CUANTO_MS);
    // Al volver a la pestaña se manda al instante: alguien que estaba en pausa
    // no debería esperar medio minuto para que le digan "ya estás".
    const alVolver = () => { if (document.visibilityState === 'visible') marcar(); };
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      window.clearInterval(reloj);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, []);
  return null;
}

/** La lista del equipo con su estado. Va en la ficha, donde se decide votar. */
export function PanelPresencia({ equipo }: { equipo: Presencia[] }) {
  // `ahora` arranca en el momento de montar, así que el primer render ya trae la
  // hora correcta: no hace falta un efecto para "ponerla al día". El efecto solo
  // mantiene el reloj, que es un sistema externo.
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    const reloj = window.setInterval(() => setAhora(Date.now()), 15_000);
    return () => window.clearInterval(reloj);
  }, []);

  if (!equipo.length) return null;

  const conectados = equipo.filter((p) => estadoDe(p, ahora) === 'conectado').length;

  // MEDIDO 2026-10-04 en produccion: este panel pintaba UN renglon por fila y
  // `rr_hub_presencia` tenia 247 filas —236 de ellas visitantes de pruebas—,
  // asi que el bloque media **10.720 px de alto** en un movil de 390. La votacion
  // de la ficha quedava 11.000 px por encima de la pantalla: abrir una idea
  // «no mostraba nada», porque habia que scrollear un tunel de nombres para
  // llegar a ella.
  //
  // Ahora el panel no crece con la lista: quien esta CONECTADO sale entero, y el
  // resto queda en un `<details>` que esta CERRADO. Es la misma informacion con
  // un techo, y lo que se quiere ver («¿a quién le pregunto?») queda arriba sin
  // scrollear.
  //
  // `MAX_RENGLONES` es un tope de seguridad, no una regla de negocio: si mañana
  // hay 60 personas conectadas a la vez, el bloque sigue siendo usable.
  const ordenados = [
    ...equipo.filter((p) => estadoDe(p, ahora) === 'conectado'),
    ...equipo.filter((p) => estadoDe(p, ahora) !== 'conectado'),
  ];
  const enLinea = ordenados.filter((p) => estadoDe(p, ahora) === 'conectado');
  const elResto = ordenados.slice(enLinea.length);
  const aMostrar = (lista: Presencia[], tope: number) => lista.slice(0, tope);

  const renglon = (persona: Presencia) => {
    const estado = estadoDe(persona, ahora);
    const tono = TONO[estado];
    return (
      <li
        key={persona.email}
        className="flex flex-wrap items-baseline justify-between gap-2 border-b border-blanco-10 px-4 py-2 last:border-b-0"
      >
        <span className="flex items-baseline gap-2">
          <Icon
            name={estado === 'conectado' ? 'pin' : 'user'}
            className={estado === 'conectado' ? 'text-orquidea' : 'text-blanco-30'}
          />
          <span className="font-display text-sm text-blanco">
            {persona.nombre ?? persona.email}
          </span>
        </span>
        <span className="flex items-baseline gap-2">
          <span className="font-mono text-[10px] text-blanco-40">
            {desdeCuando(persona.lastSeenAt, ahora)}
          </span>
          <span
            className={`border px-1.5 py-0.5 font-mono text-[10px] tracking-[0.1em] ${tono.clase}`}
          >
            {tono.texto}
          </span>
        </span>
      </li>
    );
  };

  return (
    <section className="border-2 border-blanco-20" aria-label="Quién está del equipo">
      <header className="flex items-center justify-between border-b-2 border-blanco-20 px-4 py-2">
        <span className="font-mono text-[10px] tracking-[0.15em] text-blanco-60">
          // EL EQUIPO AHORA
        </span>
        <span className="font-mono text-[10px] text-orquidea">
          {conectados} de {equipo.length} en línea
        </span>
      </header>

      <ul className="flex flex-col">
        {aMostrar(enLinea, MAX_RENGLONES).map(renglon)}
      </ul>

      {elResto.length > 0 && (
        <details className="border-t-2 border-blanco-20">
          <summary className="flex min-h-[44px] cursor-pointer items-center justify-between px-4 font-mono text-[10px] text-blanco-50">
            <span>// LOS DEMAS ({elResto.length})</span>
            <Icon name="chevron" size={11} />
          </summary>
          <ul className="flex flex-col">
            {aMostrar(elResto, MAX_RENGLONES).map(renglon)}
          </ul>
        </details>
      )}
    </section>
  );
}
