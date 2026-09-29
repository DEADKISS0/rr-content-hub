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

/** Origenes de los que vale la pena creerle una señal de "ya pinté". */
const SENALES_DE_PLATAFORMA = new Set([
  'onRender',
  'embedResize',
  'onLoad',
  'measure',
  'updateHeight',
]);

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
  const [estado, setEstado] = useState<EstadoEmbed>('cargando');

  useEffect(() => {
    let vivo = true;
    setEstado('cargando');

    // La señal de Meta: el post ya está pintado dentro del marco.
    const alMensaje = (evento: MessageEvent) => {
      if (!vivo) return;
      if (!evento.origin.includes('instagram.com') && !evento.origin.includes('tiktok.com')) return;
      if (evento.origin.includes('facebook.com')) return;
      const tipo = evento.data?.type;
      if (typeof tipo === 'string' && SENALES_DE_PLATAFORMA.has(tipo)) setEstado('vivo');
    };
    window.addEventListener('message', alMensaje);

    // El iframe podría haber pintado antes de que nos montáramos: se pregunta
    // una vez al principio y otra vez al terminar de cargar el propio marco.
    const preguntar = () => iframe.current?.contentWindow?.postMessage('resize', '*');
    preguntar();
    const marco = iframe.current;
    marco?.addEventListener('load', preguntar);

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
