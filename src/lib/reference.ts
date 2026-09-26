import type { IconName } from '@/components/ui/icons';

/**
 * Clasificación de la referencia de una pieza.
 *
 * Vive en `lib/` y no dentro del componente porque es la regla que decide qué
 * se puede previsualizar de verdad y qué no. Estar aquí la hace testeable sin
 * renderizar nada (ver `reference.test.ts`), y el componente solo pinta.
 *
 * Verificado 2026-09-26: Instagram y TikTok NO exponen miniatura pública sin
 * API (sirven muro de login y `/media/` ya no redirige al CDN). Drive, YouTube
 * e imágenes directas SÍ. Cuando no hay miniatura no se inventa una foto: se
 * compone el post con el arte de marca de la pieza.
 */
export type ReferenceSource = {
  kind: 'drive' | 'image' | 'instagram' | 'tiktok' | 'youtube' | 'link';
  url: string;
  /** id del archivo (Drive, YouTube) */
  id?: string;
  /** shortcode del post (Instagram, TikTok) */
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

/** Miniatura real cuando el proveedor la expone (Drive, YouTube e imágenes sí). */
export function realThumb(source: ReferenceSource): string | null {
  if (source.kind === 'image') return source.url;
  if (source.kind === 'drive' && source.id) return `https://drive.google.com/thumbnail?id=${source.id}&sz=w480`;
  if (source.kind === 'youtube' && source.id) return `https://img.youtube.com/vi/${source.id}/hqdefault.jpg`;
  return null;
}

/** El ícono que anuncia qué clase de pieza se va a ver. */
export const KIND_ICON: Record<ReferenceSource['kind'], IconName> = {
  drive: 'file',
  image: 'image',
  instagram: 'video',
  tiktok: 'video',
  youtube: 'video',
  link: 'link',
};
