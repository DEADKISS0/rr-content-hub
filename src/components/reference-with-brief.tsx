import Image from 'next/image';
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

function aPintar0(lista: string[]): string {
  return lista[0] ?? '';
}

/** Un anuncio de la biblioteca de Facebook se anuncia como anuncio, no como post. */
function esAnuncioDeFacebook(url: string): boolean {
  return /facebook\.com\/ads\/library/i.test(url);
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
 * Si una URL se puede embeber de verdad.
 *
 * MEDIDO 2026-10-01: una referencia de Facebook Ads Library con `?id=` NO es
 * embebible. `embedSource` devuelve el `plugins/post.php` y Meta responde con un
 * marco vacío, porque ese endpoint es para POSTS de Facebook, no para anuncios
 * de la biblioteca de anuncios. Con la referencia principal así, la ficha queda
 * en negro aunque tenga una segunda referencia buena guardada al lado.
 *
 * Es la razón de que `ReferenceWithBrief` recorra la lista y no se quede en
 * `refs[0]`: el dato ya guarda las dos, el render las estaba desperdiciando.
 */
function esEmbebible(url: string): boolean {
  return motivoDeNoEmbebir(url) === null;
}

/**
 * Por qué una referencia NO se puede mostrar aquí, o `null` si sí se puede.
 *
 * MEDIDO 2026-10-01, abriendo la URL real en el navegador:
 *
 *   https://www.facebook.com/plugins/post.php?href=<Ads Library>
 *   → title "Facebook", contenido: `- feed` + link "Servicio de ayuda"
 *
 * Eso es un marco VACÍO. No es un video que tarda: es el documento que Meta
 * devuelve cuando no reconoce lo que le pidieron. Y como `onLoad` se dispara
 * igual —una respuesta de error también es una respuesta—, la pantalla dice
 * "viendo la referencia" sobre un rectángulo en gris. El fallo se lee como
 * "Facebook no deja ver el anuncio", y no es eso: ese endpoint es para POSTS de
 * Facebook, no para anuncios de la biblioteca, y no hay endpoint público que
 * los sirva embebidos.
 *
 * MEDIDO también en la base, y son dos fichas que caen en negro:
 *
 *   P19  1 referencia, solo Facebook Ads Library
 *   P25  1 referencia, solo Facebook Ads Library
 *
 * (P28 y P29 tienen Ads Y un post de Instagram: esas se ven porque el filtro
 * las separa y queda la buena.)
 *
 * Antes esta función devolvía `boolean` y el "no" se comía el motivo. Quien
 * tenía que explicar por qué la ficha estaba vacía no tenía con qué: el filtro
 * devolvía `false`, el render veía `source` no nulo —porque `embedSource` SÍ
 * devuelve una URL para Facebook— y pintaba el iframe vacío sin decir nada.
 * Por eso la razón se devuelve aquí, y quien pinta la decide.
 */
function motivoDeNoEmbebir(url: string): string | null {
  if (/facebook\.com\/ads\/library/i.test(url)) {
    return 'La biblioteca de anuncios de Facebook no se puede embeber: Meta no tiene un endpoint publico que la sirva. El anuncio se ve abriendo el link.';
  }
  if (/facebook\.com/i.test(url)) {
    return 'Facebook no siempre sirve este contenido embebido. Si el marco queda vacio, abre el link.';
  }
  return embedSource(url) === null ? 'Este origen no se puede embeber.' : null;
}

/**
 * Reference + brief side by side. The iframe alone says "what"; the brief says
 * "why". Keeping them together is what turns a link into an approved direction.
 *
 * `refs` es la LISTA de referencias de la idea, no una sola: una idea de pauta
 * suele traer el anuncio de Facebook y el post de Instagram que lo inspiring, y
 * con una sola no se ve la otra. Las embebibles van primero, para que si la
 * referencia principal no se puede mostrar la ficha no quede en negro.
 */
export function ReferenceWithBrief({ url, refs, title, brief, coverUrl }: { url?: string; refs?: string[]; title: string; brief: VisualBrief; coverUrl?: string | null }) {
  const todas = (refs?.length ? refs : url ? [url] : []).filter(Boolean);
  if (!todas.length) {
    return <section className="border border-dashed border-blanco-20 p-8 text-center">
      <p className="mono-label text-blanco-50">[REFERENCIA PENDIENTE]</p>
      <p className="mt-3 text-sm leading-6 text-blanco-60">Esta idea no tiene un referente visual todavía. El owner debe agregarlo antes de enviarla al cliente.</p>
    </section>;
  }

  // Las que se pueden ver van primero; el resto se conserva detrás.
  const embebibles = todas.filter(esEmbebible);
  const elResto = todas.filter((u) => !embebibles.includes(u));

  // MEDIDO 2026-10-01: P19 y P25 tienen UNA sola referencia y es una Ads
  // Library. Sin esta rama, `embebibles` llegaba vacío, `aPintar` tenía solo la
  // no embebible y la ficha pintaba el iframe vacío sin decir nada — negro con
  // un "ABRIR ORIGINAL" que al menos funcionaba pero enterrado en el header.
  //
  // Con esta rama, la ficha dice la verdad: esto no se puede mostrar aquí, y
  // el anuncio se ve con un toque. Un marco vacío no informa; un aviso con un
  // enlace es una salida.
  if (!embebibles.length) {
    return <section className="overflow-hidden border border-blanco-20 anim-fade">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-blanco-10 bg-blanco-05 px-5 py-3">
        <p className="eyebrow text-blanco-50">[REFERENCIA VISUAL · {platform(aPintar0(todas))}]</p>
      </header>
      <div className="bg-negro p-8 text-center">
        {/*
          MEDIDO 2026-10-01, Santiago: "sigue siendo muy plano, al menos con
          una imagen o algo así en las referencias de Facebook porque se ve raro".

          MEDIDO también por qué no se puede embeber ni capturar al vuelo:
          Facebook devuelve un marco vacío por `plugins/post.php` (probado en el
          navegador: `- feed` + link "Servicio de ayuda") Y la biblioteca exige
          sesión para ver el anuncio, así que tampoco se puede hacer una captura
          desde la app: sería meterse con la cuenta de otra persona.

          Lo que sí es honesto y funciona es la MINIATURA del anuncio, que ya
          está guardada en `rr_hub_ad_library.cover_url`. Un marco vacío con
          texto encima se ve como un error; una miniatura del anuncio con el
          aviso al lado se ve como lo que es: una referencia que se ve en otro
          sitio y que aquí está su límite.
        */}
        {coverUrl && <Image
          src={coverUrl}
          alt="Miniatura del anuncio de referencia"
          width={1200}
          height={800}
          unoptimized
          className="mx-auto mb-6 max-h-[420px] w-auto max-w-full border border-blanco-20 object-contain"
        />}
        <p className="font-mono text-xs text-mostaza">[PREVIEW NO DISPONIBLE PARA ESTE ORIGEN]</p>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-blanco-60">{motivoDeNoEmbebir(todas[0])}</p>
        <div className="mt-6 flex flex-col items-center gap-3">
          {todas.map((u, indice) => <Link
            key={`${indice}-${u}`}
            href={u}
            target="_blank"
            rel="noreferrer"
            className="inline-block border border-blanco-25 px-5 py-3 font-mono text-xs text-blanco underline decoration-dotted underline-offset-4"
          >
            {esAnuncioDeFacebook(u) ? 'VER ANUNCIO EN FACEBOOK' : 'VER REFERENCIA ORIGINAL'} ↗
          </Link>)}
        </div>
      </div>
    </section>;
  }

  const aPintar = [...embebibles, ...elResto];

  const sourcePrincipal = aPintar.map((u) => ({ url: u, source: embedSource(u) })).find((r) => r.source);
  const marcoPrincipal = encuadre(sourcePrincipal?.url ?? aPintar[0]);
  const rows: Array<{ label: string; value?: string; tone?: string }> = [
    { label: 'INTENCIÓN', value: brief.intention },
    { label: 'CÁMERA', value: brief.camera },
    { label: 'TALENTO', value: brief.talent },
    { label: 'EDICIÓN', value: brief.edit },
    { label: 'QUÉ NO HACER', value: brief.avoid, tone: 'text-blanco-60' },
  ].filter((row) => row.value);

  return <section className="overflow-hidden border border-blanco-20 anim-fade">
    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-blanco-10 bg-blanco-05 px-5 py-3">
      <p className="eyebrow text-blanco-50">[REFERENCIA VISUAL · {platform(sourcePrincipal?.url ?? aPintar[0])}]</p>
      {/* MEDIDO 2026-10-01: esto era la PRIMERA de la lista,
          Con una idea que tiene Ads de Facebook + un post de Instagram, la
          primera es el anuncio y el flash es el post: el rótulo decía "abrir
          original" sobre un link que no era lo que se estaba viendo. Dos
          fuentes distintas bajo un mismo nombre.

          Ahora apunta a la misma referencia que se está embebiendo. Si no hay
          ninguna embebible, cae a la primera disponible, que al menos es una
          referencia real de la idea y no un link que no se ve. */}
      <Link
        href={sourcePrincipal?.url ?? aPintar[0]}
        target="_blank"
        rel="noreferrer"
        className="font-mono text-[10px] text-blanco-50 underline"
      >
        ABRIR ORIGINAL ↗
      </Link>
    </header>
    <div className="grid gap-px bg-blanco-10 lg:grid-cols-2">
      <div className="flex flex-col items-center gap-4 bg-negro p-3 sm:p-5">
        {/* Todas las referencias, no solo la primera: si la principal no se
            puede embeber, la que sí se ve queda en su lugar. */}
        {aPintar.map((cadaUrl, indice) => {
          const source = embedSource(cadaUrl);
          const marco = encuadre(cadaUrl);
          const clave = `${indice}-${cadaUrl}`;
          return <div key={clave} className="flex w-full flex-col items-center gap-2">
            {/* MEDIDO 2026-10-01, Santiago: "que tengan la label de Instagram
                porque hay muchas que no tienen". Esto estaba detrás de
                `todas.length > 1 &&`, así que con UNA sola referencia no se
                pintaba. Y las ideas con una sola referencia son P19, P25, P30 y
                O13: exactamente las que más necesitan decir de dónde viene el
                link eran las que callaban.

                Además dice si es un anuncio, porque un anuncio de Facebook y un
                post de Instagram son cosas distintas: uno no se puede embeber y
                el otro sí. La etiqueta es la que explica por qué. */}
            <p className="font-mono text-[10px] tracking-[0.15em] text-blanco-40">
              {todas.length > 1 ? `REFERENCIA ${indice + 1} DE ${todas.length}` : 'REFERENCIA'}
              {' · '}{platform(cadaUrl)}
              {esAnuncioDeFacebook(cadaUrl) ? ' · ANUNCIO' : ''}
            </p>
            {source ? <ReferenceEmbed
              key={source}
              src={source}
              title={`Referencia visual ${indice + 1} de ${title}`}
              plataforma={platform(cadaUrl)}
              className={`bg-white ${marco.ratio} ${marco.ancho} ${marco.alto}`}
            /> : <div className="grid w-full place-items-center p-8 text-center"><div><p className="font-mono text-xs text-blanco-60">PREVIEW NO DISPONIBLE PARA ESTE ORIGEN.</p><Link href={cadaUrl} target="_blank" rel="noreferrer" className="mt-4 inline-block font-mono text-xs text-blanco-50 underline">VER REFERENCIA ORIGINAL ↗</Link></div></div>}
            {/* Con el embed cargando o sin señal, el enlace es la salida. Sin él,
                quien ve "no pintó" se queda sin manera de llegar al post. */}
            {source && <Link
              href={cadaUrl}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 font-mono text-[10px] text-blanco-50 underline decoration-dotted underline-offset-4"
            >
              ABRIR EL POST EN {platform(cadaUrl)} ↗
            </Link>}
          </div>;
        })}
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
