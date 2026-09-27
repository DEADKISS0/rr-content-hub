'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Vista previa real del post, en un iframe.
 *
 * Por qué cambió (2026-09-27): antes embebía `ddinstagram.com`, un proxy de
 * terceros. **Hoy ese servicio no responde** — curl da 000 (sin conexión), y
 * Ya no devuelve la miniatura por `/media/`. Como el `onLoad` de un iframe se
 * dispara igual aunque el contenido sea un error, la vista previa "funcionaba"
 * y no mostraba nada: 17 de 25 piezas tienen referencia de Instagram, así que
 * prácticamente todo el tablero caía en el mockup.
 *
 * Ahora usa el embed oficial de Instagram (`/embed/captioned/`), que sí carga
 * el post real, y se apoya en `embeds.js` para el alto dinámico. El CSP del
 * proyecto ya permite `frame-src` de Instagram (ver `next.config.ts`).
 *
 * La comprobación es real: el script de Meta avisa por postMessage cuando el
 * post se pintó, y se mide el alto del iframe. Si en 6 s no llega nada, se cae
 * al post compuesto de marca, que es honesto y sigue pareciendo contenido.
 */
export function InstagramEmbed({ url, title }: { url: string; title: string }) {
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'fallo'>('cargando');
  const [alto, setAlto] = useState(480);
  const marco = useRef<HTMLDivElement>(null);

  const shortcode = url.match(/\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/)?.[1];

  useEffect(() => {
    let vivo = true;

    // Sin shortcode no hay embed posible: se resuelve igual, pero dentro del
    // temporizador. El linter de React 19 rechaza (con razón) que un efecto
    // cambie estado en su propio cuerpo; el trabajo va en el callback.
    if (!shortcode) {
      const t = window.setTimeout(() => { if (vivo) setEstado('fallo'); }, 0);
      return () => { vivo = false; window.clearTimeout(t); };
    }

    // Meta mide el embed y avisa por postMessage. Es la única señal honesta de
    // "el post se pintó": el `load` del iframe ocurre también con un error.
    const alMensaje = (event: MessageEvent) => {
      if (!vivo || !marco.current) return;
      const tipo = event.data?.type;
      if (tipo !== 'embedResize' && tipo !== 'onRender') return;
      if (event.data?.height) setAlto(Math.max(320, Number(event.data.height)));
      if (tipo === 'onRender') setEstado('listo');
    };
    window.addEventListener('message', alMensaje);

    // Si el script no está o la red falla, no esperamos indefinidamente.
    const t = window.setTimeout(() => { if (vivo) setEstado('fallo'); }, 6000);

    // El script de embeds.js se carga una vez y rehidrata todos los iframes.
    if (!document.querySelector('script[data-instagram-embed]')) {
      const script = document.createElement('script');
      script.async = true;
      script.defer = true;
      script.src = 'https://platform.instagram.com/en_US/embeds.js';
      script.dataset.instagramEmbed = '1';
      script.onload = () => {
        try {
          (window as unknown as { instgrm?: { Embeds?: { process: () => void } } })
            .instgrm?.Embeds?.process();
        } catch { /* el postmessage de arriba es la señal real */ }
      };
      document.body.appendChild(script);
    }

    return () => { vivo = false; window.clearTimeout(t); window.removeEventListener('message', alMensaje); };
  }, [shortcode]);

  if (!shortcode) return <InstagramMock title={title} />;

  const esReel = /\/reels?\/|\/tv\//.test(url);

  if (estado === 'fallo') return <InstagramMock title={title} shortcode={shortcode} />;

  return (
    <div className="relative w-full overflow-hidden border border-blanco-20 bg-negro">
      {estado === 'cargando' && (
        <div className="flex h-64 items-center justify-center">
          <span className="shimmer absolute inset-0" aria-hidden />
          <span className="font-mono text-xs text-blanco-50">Cargando el post real…</span>
        </div>
      )}
      <div
        ref={marco}
        className={`transition-opacity duration-200 ${estado === 'listo' ? 'opacity-100' : 'invisible absolute'}`}
        style={estado === 'listo' ? undefined : { top: 0, left: 0, width: '100%' }}
      >
        <blockquote
          className="instagram-media"
          data-instgrm-captioned
          data-instgrm-permalink={`https://www.instagram.com/p/${shortcode}/`}
          data-instgrm-version="14"
          style={{ background: '#000', border: 0, margin: 0, width: '100%' }}
        />
        <iframe
          src={`https://www.instagram.com/p/${shortcode}${esReel ? '/embed' : '/embed/captioned/'}`}
          title={`Post de Instagram de ${title}`}
          className="w-full border-0"
          style={{ height: esReel ? alto : Math.max(alto, 560) }}
          loading="lazy"
          allow="autoplay; encrypted-media; picture-in-picture"
          scrolling="no"
        />
      </div>
      <p className="border-t border-blanco-20 px-3 py-2 font-mono text-[10px] text-blanco-50">
        Vista previa real del post. Si no carga, el enlace sigue funcionando:{' '}
        <a href={url} target="_blank" rel="noreferrer" className="text-blanco underline hover:text-blanco-80">
          ábrelo en Instagram ↗
        </a>
      </p>
    </div>
  );
}

/** Post compuesto cuando el embed real no carga. Nunca inventa la foto. */
function InstagramMock({ title, shortcode }: { title: string; shortcode?: string }) {
  return (
    <div className="relative w-full border border-blanco-20 bg-negro p-4">
      <div className="mb-3 flex items-center gap-3">
        <div className="h-8 w-8 border border-mostaza/60 bg-mostaza/20" />
        <div>
          <p className="font-mono text-xs text-blanco">wundeer</p>
          <p className="font-mono text-[10px] text-blanco-50">{shortcode ? `/${shortcode}` : 'Instagram'}</p>
        </div>
      </div>

      <div className="flex aspect-square w-full items-center justify-center border border-blanco-20 bg-blanco-05">
        <div className="text-center">
          <p className="mb-1 font-display text-lg text-blanco-60">{title.slice(0, 30)}</p>
          <p className="font-mono text-[10px] text-blanco-50">Instagram no deja mostrar la vista previa aquí</p>
        </div>
      </div>

      <p className="mt-2 font-mono text-[10px] leading-relaxed text-blanco-50">
        <b className="text-blanco">wundeer</b> {title}
      </p>
    </div>
  );
}
