'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Embed real de Instagram usando ddinstagram.com (frontend sin JS de Meta).
 *
 * Muestra el post real: foto, caption, likes, comentarios.
 * Fallback a un mockup estilizado si el embed falla.
 */
export function InstagramEmbed({ url, title }: { url: string; title: string }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Extraer el shortcode de la URL de Instagram
  const shortcode = url.match(/\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/)?.[1];

  if (!shortcode) {
    return <InstagramMock title={title} />;
  }

  // ddinstagram.com sirve una versión embeddable limpia
  const embedUrl = `https://ddinstagram.com/p/${shortcode}/embed`;

  return (
    <div className="relative w-full overflow-hidden border border-blanco-20 bg-negro">
      {!loaded && !failed && (
        <div className="flex h-64 items-center justify-center">
          <span className="shimmer absolute inset-0" aria-hidden />
          <span className="font-mono text-xs text-blanco-40">Cargando preview...</span>
        </div>
      )}
      {failed ? (
        <InstagramMock title={title} shortcode={shortcode} />
      ) : (
        <iframe
          ref={iframeRef}
          src={embedUrl}
          title={`Instagram: ${title}`}
          className={`w-full h-96 border-0 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          loading="lazy"
          sandbox="allow-scripts allow-same-origin"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

/** Mockup estilizado de un post de Instagram cuando no se puede embed. */
function InstagramMock({ title, shortcode }: { title: string; shortcode?: string }) {
  return (
    <div className="relative w-full overflow-hidden border border-blanco-20 bg-negro p-4">
      {/* Header tipo Instagram */}
      <div className="flex items-center gap-3 mb-3">
        <div className="h-8 w-8 rounded-full border border-blanco-30 bg-gradient-to-br from-fucsia/30 to-orquidea/30" />
        <div>
          <p className="font-mono text-xs text-blanco">rraliados</p>
          <p className="font-mono text-[10px] text-blanco-40">{shortcode ? `/${shortcode}` : 'Instagram'}</p>
        </div>
      </div>

      {/* Imagen placeholder con arte de marca */}
      <div className="aspect-square w-full bg-blanco-05 border border-blanco-10 flex items-center justify-center">
        <div className="text-center">
          <p className="font-display text-lg text-blanco-30 mb-1">{title.slice(0, 30)}</p>
          <p className="font-mono text-[10px] text-blanco-20">Preview no disponible</p>
        </div>
      </div>

      {/* Acciones tipo Instagram */}
      <div className="flex items-center gap-4 mt-3 text-blanco-60">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
      </div>

      {/* Caption */}
      <p className="mt-2 font-mono text-[10px] text-blanco-50 leading-relaxed">
        <span className="text-blanco font-bold">rraliados</span> {title}
      </p>
    </div>
  );
}
