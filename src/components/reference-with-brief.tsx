import Link from 'next/link';
import { ReferenceEmbed } from './reference-embed';

export type VisualBrief = { intention?: string; camera?: string; talent?: string; edit?: string; avoid?: string };

/** Detects the source platform from a URL, for the header label. */
function platform(url: string) {
  if (url.includes('instagram')) return 'INSTAGRAM';
  if (url.includes('facebook')) return 'FACEBOOK';
  if (url.includes('tiktok')) return 'TIKTOK';
  if (url.includes('youtube') || url.includes('youtu.be')) return 'YOUTUBE';
  if (url.includes('drive.google.com')) return 'GOOGLE DRIVE';
  return 'EXTERNA';
}

/**
 * URL del embed de Instagram.
 *
 * Un reel y un post NO se embeben igual: el reel necesita `/embed` a secas,
 * mientras que el post con caption necesita `/embed/captioned/`. Con una sola
 * regla (la de `captioned` para todo) el reel devuelve un marco vacío: el
 * iframe carga, `onLoad` se dispara igual porque el error también es una
 * respuesta, y la pantalla dice "viendo la referencia" sobre un rectángulo gris.
 * Medido el 2026-09-29 con las dos piezas de Candilejas.
 *
 * Además, Instagram sirve el reel en dos formas —`/reel/ABC` y `/reels/ABC`— y
 * el shortcode solo puede ser de `[A-Za-z0-9_-]`: un guion bajo cambia de
 * shortcode si el regex no lo admite.
 */
function instagramEmbed(url: string) {
  // `?stkn=...` TIENE que irse, y no por limpieza.
  //
  // Ese parámetro es el token de "compartir" que Instagram añade a los enlaces
  // que copiar de la app. Pegado a la URL del embed, Meta responde con un marco
  // de 0 px de contenido: el iframe existe, mide 200x340, y no hay NADA dentro.
  // Medido el 2026-09-29, mismo post, misma página, misma medida de color:
  //   /reel/<id>/embed/            -> 22,6 % de color (el post se ve)
  //   /reel/<id>/?stkn=.../embed/   ->  0,0 % (marco vacío)
  //
  // El fallo se lee como "Instagram no deja ver el post", y no es eso: es una
  // query que nosotros no tenemos que pasarle. Instagram recibe el shortcode y
  // ya sabe qué es.
  const clean = url.split('?')[0].replace(/\/$/, '');
  const esReel = /\/(?:reels?|tv)\//.test(clean);
  // El permalink del embed debe llevar `/reel/`, no `/p/`: con `/p/` Meta
  // responde 200 pero sin post y sin `onRender`.
  const base = esReel
    ? `https://www.instagram.com/reel/${clean.match(/\/(?:reels?|tv)\/([A-Za-z0-9_-]+)/)?.[1] ?? ''}`
    : clean.replace(/\/reels?\//, '/p/');
  return `${base}/embed${esReel ? '' : '/captioned'}/`;
}
function youtubeEmbed(url: string) { const match = url.match(/(?:youtu\.be\/|v=|embed\/)([\w-]{6,})/); return match ? `https://www.youtube.com/embed/${match[1]}` : null; }
function tiktokEmbed(url: string) { const match = url.match(/video\/(\d+)/); return match ? `https://www.tiktok.com/embed/v2/${match[1]}` : null; }
function driveEmbed(url: string) { const match = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|file\/d\/e\/)([\w-]+)/); if (!match) return null; const id = match[1]; return `https://drive.google.com/file/d/${id}/preview`; }

function embedSource(url: string) {
  if (url.includes('instagram.com')) return instagramEmbed(url);
  if (url.includes('youtube.com') || url.includes('youtu.be')) return youtubeEmbed(url);
  if (url.includes('tiktok.com')) return tiktokEmbed(url);
  if (url.includes('facebook.com')) return `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(url)}&show_text=false&width=500`;
  if (url.includes('drive.google.com')) return driveEmbed(url);
  return null;
}

/**
 * Encuadre del embed, según lo que la plataforma publica de verdad.
 *
 * Un iframe NO se puede hacer responsivo: el alto y el ancho los fija el embed.
 * Lo único que se controla es el tamaño del marco, y un video vertical dentro
 * de un marco ancho deja la mitad del ancho en negro. En la ficha auditada
 * (390 px) eran 160 px de franja negra a cada lado: el video ocupaba un tercio
 * de lo que se veía.
 *
 * Así que el marco se ESTRECHA cuando el contenido es vertical: el flanco negro
 * se come el ancho del marco, no el de la tarjeta, y el fondo de la tarjeta
 * (neutro) queda en su lugar.
 *
 * El formato se infiere de la plataforma, no del archivo: es la única señal
 * honesta disponible sin metadatos. Si la plataforma no dice nada, se usa un
 * marco cuadrado, que es el peor caso tolerable.
 */
type Encuadre = { ratio: string; ancho: string; alto: string };

function encuadre(url: string): Encuadre {
  const vertical = { ratio: 'aspect-[9/16]', ancho: 'mx-auto max-w-[200px] sm:max-w-[260px]', alto: 'max-h-[340px] sm:max-h-[480px]' };
  if (url.includes('tiktok')) return vertical;

  if (url.includes('instagram.com')) {
    // Un reel es vertical; un post es cuadrado. No hay forma de saberlo desde la
    // URL, así que se muestra estrecho y alto: en el peor caso (un post) el
    // marco queda angosto, que se ve mejor que medio negro a los lados.
    return vertical;
  }

  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    return { ratio: 'aspect-video', ancho: 'w-full', alto: 'max-h-[320px] sm:max-h-[420px]' };
  }

  if (url.includes('drive.google.com')) {
    // Drive guarda el video en un reproductor con sus propios controles, y ese
    // reproductor sale 16:9 SIEMPRE, aunque el archivo sea vertical. Aun
    // angostando el marco, el video queda con flanco negro a los lados: medido
    // en móvil, el archivo ocupa 174 px de un marco de 368.
    //
    // Un iframe no se puede recortar desde fuera, así que aquí no hay arreglo
    // limpio. Lo que sí se hace es achicar el marco al máximo permitido y
    // bajar el alto, para que el flanco sea la menor parte posible y el bloque
    // no coma pantalla. El contenido se ve completo, con negro a los lados:
    // recortar la mitad del video para llenar el marco sería peor.
    return { ratio: 'aspect-[16/10]', ancho: 'mx-auto max-w-[240px] sm:max-w-[320px]', alto: 'max-h-[260px] sm:max-h-[340px]' };
  }

  if (url.includes('facebook.com')) {
    return { ratio: 'aspect-square', ancho: 'mx-auto max-w-[300px]', alto: 'max-h-[340px]' };
  }

  return { ratio: 'aspect-square', ancho: 'w-full', alto: 'max-h-[320px]' };
}

/**
 * Reference + brief side by side. The iframe alone says "what"; the brief says
 * "why". Keeping them together is what turns a link into an approved direction.
 */
export function ReferenceWithBrief({ url, title, brief }: { url?: string; title: string; brief: VisualBrief }) {
  if (!url) {
    return <section className="border border-dashed border-blanco-20 p-8 text-center">
      <p className="mono-label text-blanco-50">[REFERENCIA PENDIENTE]</p>
      <p className="mt-3 text-sm leading-6 text-blanco-60">Esta idea no tiene un referente visual todavía. El owner debe agregarlo antes de enviarla al cliente.</p>
    </section>;
  }

  const source = embedSource(url);
  const marco = encuadre(url);
  const rows: Array<{ label: string; value?: string; tone?: string }> = [
    { label: 'INTENCIÓN', value: brief.intention },
    { label: 'CÁMARA', value: brief.camera },
    { label: 'TALENTO', value: brief.talent },
    { label: 'EDICIÓN', value: brief.edit },
    { label: 'QUÉ NO HACER', value: brief.avoid, tone: 'text-blanco-60' },
  ].filter((row) => row.value);

  return <section className="overflow-hidden border border-blanco-20 anim-fade">
    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-blanco-10 bg-blanco-05 px-5 py-3">
      <p className="eyebrow text-blanco-50">[REFERENCIA VISUAL · {platform(url)}]</p>
      <Link href={url} target="_blank" rel="noreferrer" className="font-mono text-[10px] text-blanco-50 underline">ABRIR ORIGINAL ↗</Link>
    </header>
    <div className="grid gap-px bg-blanco-10 lg:grid-cols-2">
      <div className="flex flex-col items-center gap-2 bg-negro p-3 sm:p-5">
        {source ? <ReferenceEmbed
          key={source}
          src={source}
          title={`Referencia visual de ${title}`}
          plataforma={platform(url)}
          className={`bg-white ${marco.ratio} ${marco.ancho} ${marco.alto}`}
        /> : <div className="grid w-full place-items-center p-8 text-center"><div><p className="font-mono text-xs text-blanco-60">PREVIEW NO DISPONIBLE PARA ESTE ORIGEN.</p><Link href={url} target="_blank" rel="noreferrer" className="mt-4 inline-block font-mono text-xs text-blanco-50 underline">VER REFERENCIA ORIGINAL ↗</Link></div></div>}
        {/* Con el embed cargando o sin señal, el enlace es la salida. Sin él,
            quien ve "no pintó" se queda sin manera de llegar al post. */}
        {source && <Link
          href={url}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 font-mono text-[10px] text-blanco-50 underline decoration-dotted underline-offset-4"
        >
          ABRIR EL POST EN {platform(url)} ↗
        </Link>}
      </div>
      <div className="bg-negro p-6">
        <h3 className="font-display text-2xl font-bold text-blanco">¿Por qué<br /><em className="text-blanco-80">esta referencia?</em></h3>
        {rows.length ? <dl className="mt-6 space-y-5">
          {rows.map((row) => <div key={row.label}>
            <dt className="mono-label text-blanco-50">// {row.label}</dt>
            <dd className={`mt-2 text-sm leading-7 ${row.tone ?? 'text-blanco-60'}`}>{row.value}</dd>
          </div>)}
        </dl> : <p className="mt-6 text-sm leading-7 text-blanco-40">El brief visual aún no se ha completado. El equipo debe documentar la dirección (intención, cámara, talento y edición) para que la referencia comunique una decisión y no solo un enlace.</p>}
      </div>
    </div>
  </section>;
}
