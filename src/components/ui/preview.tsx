'use client';

import { useState } from 'react';
import { Icon, type IconName } from './icons';
import { IdeaCover } from './cover';

/**
 * Preview de la publicación.
 *
 * Prioridad de fuentes REALES, sin inventar nada:
 *   1. Archivo/imagen directa que la pieza tenga subida (si algún día existe).
 *   2. Google Drive → miniatura real vía /thumbnail?id=...&sz=w480.
 *   3. Imagen directa por URL (.jpg/.png/.webp) → se muestra tal cual.
 *   4. Instagram / TikTok / link genérico → se dibuja la tarjeta del post con
 *      los datos que SÍ tenemos (código, título, shortcode, red) y se avisa que
 *      la miniatura se ve al abrir. Instagram no expone miniatura sin API
 *      (verificado 2026-09-26: sirve muro de login, 0 og:image, y el endpoint
 *      /media/ ya no redirige al CDN). No se simula una foto que no existe.
 *   5. Si la imagen falla al cargar → cae a la portada procedural.
 */
export type ReferenceSource = {
  kind: 'drive' | 'image' | 'instagram' | 'tiktok' | 'youtube' | 'link';
  url: string;
  /** id del archivo (Drive, YouTube) */
  id?: string;
  /** shortcode del post (Instagram) */
  shortcode?: string;
  handle?: string;
  label: string;
  icon: IconName;
};

const clean = (url: string) => url.trim();

export function referenceSource(raw?: string | null): ReferenceSource | null {
  if (!raw) return null;
  const url = clean(raw);
  if (!/^https?:\/\//i.test(url)) return null;
  const lower = url.toLowerCase();

  if (lower.includes('drive.google.com')) {
    const byPath = url.match(/\/file\/d\/([^/?#]+)/)?.[1];
    const byQuery = url.match(/[?&]id=([^&]+)/)?.[1];
    const id = byPath ?? byQuery;
    return { kind: 'drive', url, id, label: 'DRIVE', icon: 'file' };
  }

  if (/\.(jpe?g|png|webp|avif|gif)(\?|$)/i.test(lower)) {
    return { kind: 'image', url, label: 'IMAGEN', icon: 'image' };
  }

  if (lower.includes('instagram.com')) {
    const shortcode = url.match(/\/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/)?.[1];
    const handle = url.match(/instagram\.com\/([A-Za-z0-9_.]+)/)?.[1];
    const isHandle = handle && !['reel', 'reels', 'p', 'tv', 'stories'].includes(handle);
    return { kind: 'instagram', url, shortcode, handle: isHandle ? handle : undefined, label: 'INSTAGRAM', icon: 'video' };
  }

  if (lower.includes('tiktok.com')) {
    const shortcode = url.match(/\/video\/(\d+)/)?.[1];
    return { kind: 'tiktok', url, shortcode, label: 'TIKTOK', icon: 'video' };
  }

  if (lower.includes('youtube.com') || lower.includes('youtu.be')) {
    const id = url.match(/[?&]v=([A-Za-z0-9_-]{6,})/)?.[1] ?? url.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/)?.[1];
    return { kind: 'youtube', url, id, label: 'YOUTUBE', icon: 'video' };
  }

  return { kind: 'link', url, label: 'REFERENCIA', icon: 'link' };
}

/** Miniatura real cuando el proveedor la expone (Drive y YouTube sí). */
function realThumb(source: ReferenceSource): string | null {
  if (source.kind === 'image') return source.url;
  if (source.kind === 'drive' && source.id) return `https://drive.google.com/thumbnail?id=${source.id}&sz=w480`;
  if (source.kind === 'youtube' && source.id) return `https://img.youtube.com/vi/${source.id}/hqdefault.jpg`;
  return null;
}

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
  const thumb = source ? realThumb(source) : null;
  const heightClass = HEIGHTS[size];

  if (!source) {
    return <IdeaCover code={code} title={title} size={size} format={format} />;
  }

  return (
    <div className={`cover-frame relative w-full overflow-hidden border border-blanco-20 bg-negro ${heightClass}`}>
      {thumb && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- miniatura externa sin optimizador de Next
        <img
          src={thumb}
          alt={`Referencia de ${code ?? 'la pieza'}: ${title}`}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="preview-art h-full w-full object-cover"
        />
      ) : (
        <PostFrame source={source} code={code} title={title} noPreview={Boolean(thumb) && failed} />
      )}

      <span className="absolute left-2 top-2 inline-flex items-center gap-1 border border-blanco-30 bg-negro/85 px-1.5 py-1 font-mono text-[10px] tracking-[0.08em] text-blanco">
        <Icon name={source.icon} size={11} />
        {source.label}
      </span>
      <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-negro via-negro/60 to-transparent p-2">
        <span className="font-mono text-[10px] font-bold tracking-[0.1em] text-blanco">{code ?? 'PIEZA'}</span>
        <span className="inline-flex items-center gap-1 font-mono text-[10px] text-mostaza opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          VER <Icon name="arrow" size={11} />
        </span>
      </span>
    </div>
  );
}

/** Tarjeta fiel del post cuando no hay miniatura disponible: datos reales, cero foto falsa. */
function PostFrame({ source, code, title, noPreview = false }: { source: ReferenceSource; code?: string | null; title: string; noPreview?: boolean }) {
  return (
    <div className="post-frame relative flex h-full w-full flex-col justify-between p-3">
      <span className="pointer-events-none absolute inset-0 grid-bg opacity-70" aria-hidden />
      <div className="relative flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center border border-fucsia bg-fucsia/15 font-mono text-[10px] text-fucsia">RR</span>
        <span className="min-w-0">
          <span className="block truncate font-mono text-[10px] text-blanco">{source.handle ? `@${source.handle}` : 'REFERENCIA VISUAL'}</span>
          <span className="block font-mono text-[10px] text-blanco-50">{source.shortcode ? `/${source.shortcode}` : source.label.toLowerCase()}</span>
        </span>
      </div>

      <div className="relative mx-auto flex flex-col items-center gap-1">
        <span className="flex h-12 w-12 items-center justify-center border-2 border-dashed border-mostaza/70 bg-negro/60 text-mostaza">
          <Icon name={source.kind === 'instagram' ? 'video' : 'eye'} size={20} />
        </span>
        <span className="font-mono text-[10px] tracking-[0.08em] text-mostaza">SIN MINIATURA · ABRIR</span>
      </div>

      <p className="relative line-clamp-2 font-mono text-[10px] leading-4 text-blanco-60">
        {code ? `${code} · ` : ''}{title}
      </p>

      {noPreview && (
        <p className="relative mt-1 border-t border-blanco-20 pt-1 font-mono text-[10px] leading-4 text-mostaza">
          SIN VISTA PREVIA PÚBLICA · ABRE PARA VERLA
        </p>
      )}
    </div>
  );
}
