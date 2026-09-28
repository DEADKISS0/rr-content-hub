'use client';

import { useState } from 'react';
import { Icon, type IconName } from './icons';
import { IdeaCover } from './cover';
import { decidirPortada, type IdeaCover as IdeaCoverAsset } from '@/lib/idea-cover';

/**
 * Portada de una idea en la tarjeta.
 *
 * Prioridad, y el orden importa:
 *
 *   1. Hay un asset `reference_brief` que es una imagen con URL pública → se
 *      muestra la imagen real de verdad. Es la portada que se pidió.
 *   2. No hay, o el brief no es una imagen, o la imagen no carga → el marco con
 *      el título y el arte de marca de `IdeaCover`.
 *
 * La decisión de cuál de los dos va está en `@/lib/idea-cover` y tiene test; aquí
 * solo se pinta y se maneja el fallo de red. Si la imagen real no carga (el
 * enlace externo se cayó), se cae al placeholder en caliente, sin dejar el
 * hueco negro del que hablaba el módulo de preview.
 *
 * Móvil: el marco es `w-full` con altura fija por tamaño y la imagen usa
 * `object-cover`, así que nunca estira la tarjeta ni desborda. El placeholder
 * lleva el título en una línea y `line-clamp` para que un título largo no empuje
 * la altura.
 */
const HEIGHTS = { sm: 'h-16', md: 'h-[9.5rem]', lg: 'h-44' } as const;

export function IdeaCoverFrame({
  code,
  title,
  asset,
  size = 'md',
  format,
}: {
  code?: string | null;
  title: string;
  asset?: IdeaCoverAsset;
  size?: 'sm' | 'md' | 'lg';
  format?: IconName;
}) {
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const heightClass = HEIGHTS[size];

  const decision = failed
    ? { kind: 'placeholder' as const }
    : decidirPortada({ title, code }, asset ?? null);

  if (decision.kind === 'placeholder') {
    return <IdeaCover code={code} title={title} size={size} format={format} />;
  }

  return (
    <div className={`cover-frame relative w-full overflow-hidden border border-blanco-20 bg-negro ${heightClass}`}>
      {/* El marco trabaja mientras baja la imagen, igual que en el preview. */}
      {loading && <span className="shimmer absolute inset-0" aria-hidden />}

      {/* eslint-disable-next-line @next/next/no-img-element -- portada externa sin optimizador de Next */}
      <img
        src={decision.url}
        alt={decision.alt}
        loading="lazy"
        referrerPolicy="no-referrer"
        onLoad={() => setLoading(false)}
        onError={() => { setFailed(true); setLoading(false); }}
        className="preview-art h-full w-full object-cover"
      />

      {/* Velo para que el código y el ícono se lean sobre cualquier imagen. */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-negro via-negro/40 to-transparent" />

      <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-2">
        <span className="font-mono text-[10px] font-bold tracking-[0.1em] text-blanco">{code ?? 'IDEA'}</span>
        {format && <span className="border border-blanco-30 bg-negro/80 p-1 text-blanco"><Icon name={format} size={12} /></span>}
      </span>
    </div>
  );
}
