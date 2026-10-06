'use client';

import { useState } from 'react';
import { Icon, type IconName } from './icons';
import { CoverArt } from './cover';
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
  reference,
}: {
  code?: string | null;
  title: string;
  asset?: IdeaCoverAsset;
  size?: 'sm' | 'md' | 'lg';
  format?: IconName;
  /**
   * MEDIDO 2026-10-05 (feedback de Santiago: «unifica todas las cards, para que
   * todas tengan portada, labels de instagram y el botón de reproducción»).
   * Antes esta tarjeta y `PublicationPreview` eran dos componentes con dos
   * estables: la que tenía asset de portada NO pintaba el «IG» con el handle,
   * y la queava de `PublicationPreview` y lo pintaba. En el mismo tablero se veían
   * las dos: unas con el rótulo de red arriba a la izquierda y otras sin nada.
   *
   * Ahora las dos capas de la tarjeta las pinta SIEMPRE este componente: el
   * rótulo de red (cuando hay referencia), el aviso «SIN MINIATURA» (cuando no
   * hay imagen) y el pie con el código y el ícono de formato. La imagen real
   * manda cuando existe; si no carga o no hay, cae al marco de marca con el
   * rótulo puesto, que es lo que le dice a quien mira de dónde viene la pieza.
   */
  reference?: { icon: IconName; label: string } | null;
}) {
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const heightClass = HEIGHTS[size];

  const decision = failed
    ? { kind: 'placeholder' as const }
    : decidirPortada({ title, code }, asset ?? null);

  /*
   * MEDIDO 2026-10-05: el discriminante de `decidirPortada` es `'imagen'`, en
   * español, no `'image'`. Con `'image'` la comparación no tenía intersección de
   * tipos y el TypeScript la trataba como siempre falsa: el `else` quedaba como
   * `never` y `decision.url` daba error. Por eso se compara contra el valor real
   * que devuelve la función.
   */
  const conImagen = decision.kind === 'imagen';

  return (
    <div className={`cover-frame relative w-full overflow-hidden border border-blanco-20 bg-negro ${heightClass}`}>
      {/* El marco trabaja mientras baja la imagen, igual que en el preview. */}
      {conImagen && loading && <span className="shimmer absolute inset-0" aria-hidden />}

      {conImagen ? (
        /* eslint-disable-next-line @next/next/no-img-element -- portada externa sin optimizador de Next */
        <img
          src={decision.url}
          alt={decision.alt}
          loading="lazy"
          referrerPolicy="no-referrer"
          onLoad={() => setLoading(false)}
          onError={() => { setFailed(true); setLoading(false); }}
          className="preview-art h-full w-full object-cover"
        />
      ) : (
        /*
         * MEDIDO 2026-10-05: antes esto llamaba a `IdeaCover`, que pinta SU
         * PROPIO marco `.cover-frame` de 96 px con su propio pie (código + ícono).
         * El resultado era un marco dentro de otro: el externo de 152 px con su
         * pie, y el interno de 96 px con el pie repetido. El código de la pieza
         * aparecía DOS VECES en la misma tarjeta.
         *
         * Ahora se pinta solo el arte (`CoverArt`), sin marco ni pie: el marco
         * y el pie los pinta el componente de arriba, una sola vez.
         */
        <CoverArt code={code} title={title} />
      )}

      {/* Velo para que el código y el ícono se lean sobre cualquier imagen. */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-negro via-negro/40 to-transparent" />

      {/* MEDIDO 2026-10-05: el rótulo de red va SIEMPRE que haya referencia,
          tenga o no imagen. Antes solo lo pintaba `PublicationPreview` y en las
          tarjetas con portada real se leía una foto sin decir de qué red era. */}
      {reference ? (
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 border border-blanco-30 bg-negro/85 px-1.5 py-1 font-mono text-[10px] tracking-[0.08em] text-blanco">
          <Icon name={reference.icon} size={11} />
          {reference.label}
        </span>
      ) : (
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 border border-blanco-20 bg-negro/85 px-1.5 py-1 font-mono text-[10px] tracking-[0.08em] text-blanco-50">
          <Icon name="link" size={11} />
          SIN REFERENCIA
        </span>
      )}

      {/* Aviso honesto: la miniatura no es pública, se ve al abrir. */}
      {!conImagen && size !== 'sm' && (
        <span className="absolute right-2 top-2 border border-mostaza/60 bg-negro/85 px-1.5 py-1 font-mono text-[10px] tracking-[0.06em] text-mostaza">
          SIN MINIATURA
        </span>
      )}

      <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-2">
        <span className="font-mono text-[10px] font-bold tracking-[0.1em] text-blanco">{code ?? 'IDEA'}</span>
        <span className="inline-flex items-center gap-2">
          {format && <span className="border border-blanco-30 bg-negro/80 p-1 text-blanco"><Icon name={format} size={12} /></span>}
          {/* Botón de reproducción: la acción de abrir, siempre en las mismas
             坐标 que en el resto de tarjetas. MEDIDO 2026-10-05. */}
          <span className="font-mono text-[10px] text-blanco-60 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            VER <Icon name="arrow" size={11} />
          </span>
        </span>
      </span>
    </div>
  );
}
