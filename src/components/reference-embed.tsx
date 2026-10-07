'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * El embed tiene que decir SI SE VE O SI NO.
 *
 * Santiago, 2026-09-29: "no se entiende si tiene previsualización o no, a
 * pesar de que sí la tenga". El iframe de Instagram es un rectángulo: cuando
 * carga pinta el post, cuando no pinta queda un hueco del mismo tamaño. Desde
 * fuera las dos cosas son la misma imagen, y el equipo no sabe si el enlace
 * está bueno o hay que abrirlo.
 *
 * La señal honesta de "cargó" NO es el `load` del iframe: ese evento dispara
 * igual cuando lo que llegó fue una página de error de Meta, y durante un rato
 * fue exactamente lo que hacía que un embed roto pareciera sano. La señal es el
 * `postMessage` que Instagram manda cuando el post ya está pintado
 * (`onRender` / `embedResize`).
 *
 * Y hay un segundo hecho medido que obliga a tener paciencia: Instagram puede
 * tardar **diez segundos** en pintar. O1 de Candilejas estaba vacía a los 5 s y
 * a los 10 s tenía 22 % de color. Un aviso de "no carga" a los 3 s habría
 * mentido, y ese aviso falso es el que hace que la gente deje de mirar.
 */

export type EstadoEmbed = 'cargando' | 'vivo' | 'tardando' | 'sin-senal';

const MS_PINTADO = 1_500;
const MS_ULTIMO_INTENTO = 12_000;

/**
 * Los mensajes que Instagram manda de verdad, medidos el 2026-09-29:
 *
 *   https://www.instagram.com :: {"details":{},"type":"LOADING"}
 *   https://www.instagram.com :: {"details":{"height":533},"type":"MEASURE"}
 *
 * La primera versión de esta lista decía `onRender` y `embedResize`, que son
 * los nombres de la documentación antigua. Esos **no llegan nunca**: con ellos
 * el indicador caía siempre en "no pintó" y pintaba un aviso en mostaza sobre
 * siete embeds que sí estaban mostrando el post. Un indicador que se contradice
 * con lo que se ve es peor que no tenerlo: entrena al equipo a desconfiar del
 * aviso, y entonces el aviso real deja deservir para nada.
 *
 * `MEASURE` es la buena: trae la ALTURA final del post. Si manda altura, hay
 * contenido dentro. Y hay que pedirla: el embed solo responde a un `resize`
 * enviado desde la página anfitriona, así que sin ese `postMessage` la
 * respuesta no llega nunca.
 */
// `MOUNTED` llega después de `MEASURE` y también significa que ya está montado.
const SENALES_DE_PLATAFORMA = new Set(['MEASURE', 'MOUNTED', 'onRender', 'embedResize']);

/** Lo que se considera "rotura de verdad", para no contarlo como señal. */
const SENALES_ROTAS = new Set(['LOADING', 'ERROR', 'error']);

/**
 * Meta manda el mensaje como STRING JSON, no como objeto. Medido el 2026-09-29
 * con un espía en la página real:
 *
 *   typeof event.data === "string"  ->  '{"details":{"height":458},"type":"MEASURE"}'
 *
 * La versión anterior leía `evento.data?.type`, que en un string es
 * `undefined` siempre, y por eso el indicador caía en "no pintó" sobre embeds
 * que sí estaban pintados. El fallo era de la FORMA del mensaje, no de su
 * contenido: el `MEASURE` con su altura estaba llegando desde el primer intento.
 */
function tipoDelMensaje(datos: unknown): string | null {
  if (typeof datos === 'string') {
    try {
      const objeto = JSON.parse(datos) as { type?: unknown };
      return typeof objeto.type === 'string' ? objeto.type : null;
    } catch {
      return null;
    }
  }
  if (datos && typeof datos === 'object' && 'type' in datos) {
    const tipo = (datos as { type: unknown }).type;
    return typeof tipo === 'string' ? tipo : null;
  }
  return null;
}

export function ReferenceEmbed({
  src,
  title,
  className,
  plataforma = 'la plataforma',
}: {
  src: string;
  title: string;
  className?: string;
  plataforma?: string;
}) {
  const iframe = useRef<HTMLIFrameElement | null>(null);
  // Nace en 'cargando' y NO se reinicia dentro del efecto: al cambiar de
  // referencia el padre cambia la `key` y React remonta el componente, que es
  // el reinicio limpio. Poner `setEstado('cargando')` al principio del efecto
  // dispara `react-hooks/set-state-in-effect` en React 19.
  const [estado, setEstado] = useState<EstadoEmbed>('cargando');

  useEffect(() => {
    let vivo = true;

    // La señal de Meta: el post ya está pintado dentro del marco.
    const alMensaje = (evento: MessageEvent) => {
      if (!vivo) return;
      if (evento.origin.includes('facebook.com')) return;
      if (!evento.origin.includes('instagram.com') && !evento.origin.includes('tiktok.com')) return;
      const tipo = tipoDelMensaje(evento.data);
      if (!tipo) return;
      // `LOADING` significa "todavía no": si se contara como señal, bastaría con
      // que el embed empiece a cargar para declarar la previsualización viva.
      if (SENALES_ROTAS.has(tipo)) return;
      if (SENALES_DE_PLATAFORMA.has(tipo)) setEstado('vivo');
    };
    window.addEventListener('message', alMensaje);

    // El embed de Instagram **solo responde si se le pregunta**. Sin este
    // `postMessage('resize')` desde la página anfitriona, Meta no manda nada:
    // se queda en silencio y no hay forma de saber si pintó. Con un solo intento
    // al montar se pierde la respuesta, porque el embed todavía no ha montado
    // su listener; por eso se repite unas pocas veces.
    const preguntar = () => iframe.current?.contentWindow?.postMessage('resize', '*');
    preguntar();
    const marco = iframe.current;
    marco?.addEventListener('load', preguntar);

    let intentos = 0;
    const reintento = window.setInterval(() => {
      intentos += 1;
      preguntar();
      if (intentos >= 4) window.clearInterval(reintento);
    }, 1_200);

    // Escalón de "tardando": todavía no pintó, pero no se declara roto.
    const t1 = window.setTimeout(() => {
      if (vivo) setEstado((actual) => (actual === 'vivo' ? actual : 'tardando'));
    }, MS_PINTADO);

    // Último intento: si a los 12 s no hubo señal, se dice con todas las letras.
    const t2 = window.setTimeout(() => {
      if (vivo) setEstado((actual) => (actual === 'vivo' ? actual : 'sin-senal'));
    }, MS_ULTIMO_INTENTO);

    return () => {
      vivo = false;
      window.removeEventListener('message', alMensaje);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearInterval(reintento);
      marco?.removeEventListener('load', preguntar);
    };
  }, [src]);

  const texto = {
    cargando: 'PIDIENDO LA PREVISUALIZACIÓN…',
    tardando: 'INSTAGRAM ESTÁ CARGANDO EL POST…',
    vivo: 'PREVISUALIZACIÓN ACTIVA',
    'sin-senal': `${plataforma.toUpperCase()} NO PINTÓ ESTA PREVISUALIZACIÓN`,
  }[estado];

  return (
    <div className="relative w-full">
      <iframe
        ref={iframe}
        title={title}
        src={src}
        data-estado={estado}
        className={`w-full border-0 ${className ?? ''}`}
        allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
        sandbox="allow-scripts allow-same-origin"
        referrerPolicy="strict-origin-when-cross-origin"
        loading="lazy"
      />

      {estado !== 'vivo' && (
        <p
          data-aviso-embed={estado}
          className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 px-3 py-2 text-center"
        >
          <span
            className={`font-mono text-[10px] leading-tight tracking-wide ${
              estado === 'sin-senal' ? 'text-mostaza' : 'text-blanco-50'
            }`}
          >
            {estado === 'sin-senal' ? '⚠ ' : ''}
            {texto}
          </span>
        </p>
      )}
    </div>
  );
}
