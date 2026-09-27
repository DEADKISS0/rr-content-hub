'use client';

import { useState } from 'react';
import { Icon, type IconName } from './icons';
import { CoverArt, IdeaCover } from './cover';
import { KIND_ICON, referenceSource, realThumb, type ReferenceSource } from '@/lib/reference';

/**
 * Preview de la publicación.
 *
 * La clasificación de la referencia (qué se puede previsualizar y qué no) vive
 * en `@/lib/reference` y está cubierta por tests; aquí solo se pinta.
 *
 * Prioridad de fuentes REALES, sin inventar nada:
 *   1. Imagen directa por URL (.jpg/.png/.webp) → se muestra tal cual.
 *   2. Google Drive → miniatura real vía /thumbnail?id=...&sz=w480.
 *   3. YouTube → miniatura real del video.
 *   4. Instagram / TikTok / link genérico → NO existe miniatura pública.
 *      En vez de dejar un hueco vacío se compone el post con lo que SÍ sabemos:
 *      el arte de marca determinista de la pieza, su código, su red y su
 *      shortcode. Se avisa en una etiqueta discreta.
 *
 * Regla de diseño: cuando falta la foto, el hueco tiene que seguir pareciendo
 * una pieza de contenido, no un error. Antes 17 de 26 tarjetas pintaban el
 * mismo recuadro punteado y la parrilla se leía como vacía.
 */
const HEIGHTS = { sm: 'h-16', md: 'h-[9.5rem]', lg: 'h-44' } as const;

export function PublicationPreview({
  url,
  code,
  title,
  size = 'md',
  format,
}: {
  url?: string | null;
  code?: string | null;
  title: string;
  size?: 'sm' | 'md' | 'lg';
  format?: IconName;
}) {
  const source = referenceSource(url);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const heightClass = HEIGHTS[size];

  if (!source) {
    return <IdeaCover code={code} title={title} size={size} format={format} />;
  }

  const thumb = realThumb(source);
  const showReal = Boolean(thumb) && !failed;
  const compact = size === 'sm';

  return (
    <div className={`cover-frame relative w-full overflow-hidden border border-blanco-20 bg-negro ${heightClass}`}>
      {showReal ? (
        <>
          {/* Barrido mientras baja la imagen real: el marco trabaja en vez de
              quedarse negro. Se apaga en cuanto la miniatura está lista. */}
          {loading && <span className="shimmer absolute inset-0" aria-hidden />}
          {/* eslint-disable-next-line @next/next/no-img-element -- miniatura externa sin optimizador de Next */}
          <img
            src={thumb as string}
            alt={`Referencia de ${code ?? 'la pieza'}: ${title}`}
            loading="lazy"
            referrerPolicy="no-referrer"
            onLoad={() => setLoading(false)}
            onError={() => { setFailed(true); setLoading(false); }}
            className="preview-art h-full w-full object-cover"
          />
        </>
      ) : (
        <PostMock source={source} code={code} title={title} compact={compact} />
      )}

      {/* Red de origen: siempre visible, dice de dónde viene la referencia. */}
      <span className="absolute left-2 top-2 inline-flex items-center gap-1 border border-blanco-30 bg-negro/85 px-1.5 py-1 font-mono text-[10px] tracking-[0.08em] text-blanco">
        <Icon name={source.icon} size={11} />
        {source.label}
      </span>

      {/* Aviso honesto, pequeño: la miniatura no es pública, se ve al abrir. */}
      {!showReal && !compact && (
        <span className="absolute right-2 top-2 border border-blanco-20 bg-negro/85 px-1.5 py-1 font-mono text-[10px] tracking-[0.06em] text-blanco-50">
          SIN MINIATURA
        </span>
      )}

      <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-negro via-negro/70 to-transparent p-2">
        <span className="font-mono text-[10px] font-bold tracking-[0.1em] text-blanco">{code ?? 'PIEZA'}</span>
        <span className="inline-flex items-center gap-1 font-mono text-[10px] text-blanco-60 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          VER <Icon name="arrow" size={11} />
        </span>
      </span>
    </div>
  );
}

/**
 * El post compuesto cuando no hay miniatura pública.
 *
 * Capa 1: arte de marca determinista de la pieza (mismo código, mismo arte).
 * Capa 2: velo para que el texto se lea sobre cualquier geometría.
 * Capa 3: el marco de la red social —avatar, handle, forma de pieza y acciones—,
 *         para que la tarjeta se lea como contenido y no como un error.
 */
function PostMock({ source, code, title, compact = false }: { source: ReferenceSource; code?: string | null; title: string; compact?: boolean }) {
  const acciones: IconName[] = ['comment', 'upload', 'eye'];

  return (
    <div className="absolute inset-0">
      <CoverArt code={code} title={title} className="absolute inset-0 h-full w-full" />
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-b from-negro/70 via-negro/25 to-negro/85" aria-hidden />

      <div className="relative flex h-full flex-col justify-between p-2">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center border border-blanco-30 bg-blanco-10 font-mono text-[10px] font-bold text-blanco">RR</span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate font-mono text-[10px] text-blanco">
              {source.handle ? `@${source.handle}` : source.label.toLowerCase()}
            </span>
            <span className="block truncate font-mono text-[10px] text-blanco-50">
              {source.shortcode ? `/${source.shortcode}` : 'referencia visual'}
            </span>
          </span>
        </div>

        {!compact && (
          <div className="flex items-center justify-center">
            <span className="flex h-10 w-10 items-center justify-center border-2 border-blanco-30 bg-negro/55 text-blanco">
              <Icon name={KIND_ICON[source.kind]} size={18} />
            </span>
          </div>
        )}

        {!compact && (
          <div className="flex items-center gap-3 text-blanco-70">
            {acciones.map((name) => <Icon key={name} name={name} size={13} />)}
            <span className="ml-auto truncate font-mono text-[10px] text-blanco-50">{title.slice(0, 22)}</span>
          </div>
        )}
      </div>

      {/* Línea de escaneo: solo aparece al pasar el mouse por el marco. */}
      <span className="post-scan" aria-hidden />
    </div>
  );
}
