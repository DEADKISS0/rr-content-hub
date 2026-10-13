'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { Icon } from '@/components/ui/icons';
import {
  aprobarPublicacion,
  moverPublicacion,
  portadaDePublicacion,
  publicacionesOrdenadas,
  reordenarPublicaciones,
  solicitarCambios,
  type EstadoPublicacion,
  type SocialPlanning,
  type SocialPost,
} from '@/lib/social-planning';
import { ESTADO_GUARDADO_TEXTO, useSocialAutosave } from '@/lib/social-autosave';
import { MOTIVO_SIN_PERMISO, type PermisosSociales } from '@/lib/social-permissions';

const estadoLabel: Record<EstadoPublicacion, string> = {
  pendiente: 'Pendiente',
  aprobado: 'Aprobada',
  cambios: 'Cambios solicitados',
};

const estadoClase: Record<EstadoPublicacion, string> = {
  pendiente: 'border-mostaza text-mostaza',
  aprobado: 'border-fucsia text-fucsia',
  cambios: 'border-orquidea text-orquidea',
};

type MediaPreview = { tipo: 'iframe' | 'video' | 'imagen' | 'mock'; src: string };
type Coleccion = 'organico' | 'pauta';

function embedDeMedia(url: string): MediaPreview {
  const limpia = url.trim();
  if (!limpia) return { tipo: 'mock', src: '' };

  let driveId: string | null = null;
  if (limpia.includes('drive.google.com')) {
    driveId = limpia.split('/d/')[1]?.split('/')[0]?.split('?')[0] ?? null;
    if (!driveId) driveId = new URLSearchParams(limpia.split('?')[1] ?? '').get('id');
  }
  if (driveId) return { tipo: 'iframe', src: `https://drive.google.com/file/d/${driveId}/preview` };

  const youtube = limpia.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  if (youtube?.[1]) return { tipo: 'iframe', src: `https://www.youtube.com/embed/${youtube[1]}` };

  const vimeo = limpia.match(/vimeo\.com\/(\d+)/);
  if (vimeo?.[1]) return { tipo: 'iframe', src: `https://player.vimeo.com/video/${vimeo[1]}` };

  if (/\.(mp4|webm|mov)(\?|#|$)/i.test(limpia)) return { tipo: 'video', src: limpia };
  if (/\.(png|jpe?g|webp|gif|svg)(\?|#|$)/i.test(limpia) || limpia.startsWith('/')) return { tipo: 'imagen', src: limpia };

  return { tipo: 'iframe', src: limpia };
}

function MediaFrame({ post, grande = false, contenidoReal = false }: { post: SocialPost; grande?: boolean; contenidoReal?: boolean }) {
  const media = embedDeMedia(contenidoReal ? post.mediaUrl : portadaDePublicacion(post));
  const baseClass = `relative grid overflow-hidden bg-[#090909] ${grande ? 'aspect-[4/5]' : 'aspect-square'}`;

  if (media.tipo === 'iframe') {
    return <div className={baseClass}>
      <iframe
        title={`Contenido de la publicación ${post.slot}`}
        src={media.src}
        className="h-full w-full bg-blanco"
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        sandbox="allow-scripts allow-same-origin allow-presentation"
        allow="autoplay; fullscreen; encrypted-media"
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-negro via-negro/70 to-transparent p-3">
        <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-blanco-80">Contenido enlazado · publicación {post.slot}</p>
      </div>
    </div>;
  }

  if (media.tipo === 'video') {
    return <div className={baseClass}>
      <video src={media.src} className="h-full w-full object-cover" controls={grande} muted playsInline />
      <span className="pointer-events-none absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-negro/75 text-blanco">
        <Icon name="video" size={14} />
      </span>
    </div>;
  }

  return <div
    className={baseClass}
    style={{
      background: media.tipo === 'imagen'
        ? `url(${media.src}) center / cover no-repeat`
        : `linear-gradient(135deg, ${post.color}, #070001 72%)`,
    }}
  >
    {media.tipo === 'mock' && <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(245,230,211,.35),transparent_24%),radial-gradient(circle_at_80%_78%,rgba(7,0,1,.35),transparent_30%)]" />}
    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-negro/65 to-transparent" />
    <div className="relative flex h-full items-start justify-between p-2 text-blanco">
      <span className="rounded-sm bg-negro/65 px-1.5 py-1 font-mono text-[8px] uppercase tracking-[0.1em]">{post.tipo}</span>
      {post.tipo === 'reel' && <span className="grid h-7 w-7 place-items-center rounded-full bg-negro/65"><Icon name="video" size={14} /></span>}
      {post.tipo === 'carrusel' && <span className="grid h-7 w-7 place-items-center rounded-full bg-negro/65"><Icon name="stack" size={14} /></span>}
    </div>
  </div>;
}

function BotonPerfil({ children, primario = false, onClick }: { children: React.ReactNode; primario?: boolean; onClick?: () => void }) {
  return <button
    type="button"
    onClick={onClick}
    className={`min-h-[36px] rounded-lg px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blanco ${primario ? 'bg-[#0095f6] text-white hover:bg-[#1877f2]' : 'bg-[#363636] text-white hover:bg-[#4a4a4a]'}`}
  >
    {children}
  </button>;
}

function InstagramMock({ plan, posts, seleccionadoId, onSeleccionar, onAbrir, onDragStart, onDrop }: {
  plan: SocialPlanning;
  posts: SocialPost[];
  seleccionadoId: string | null;
  onSeleccionar: (id: string) => void;
  onAbrir: (id: string) => void;
  onDragStart: (id: string) => void;
  onDrop: (event: DragEvent<HTMLDivElement>, slot: number) => void;
}) {
  const [siguiendo, setSiguiendo] = useState(false);

  return <article className="min-w-0 self-start border border-blanco-20 bg-blanco-05 p-3 sm:p-5" aria-label="Vista previa del perfil de Instagram">
    <div className="overflow-hidden rounded-[18px] border border-[#262626] bg-black text-white shadow-[0_24px_70px_rgba(0,0,0,.5)]">
      <div className="flex h-12 items-center justify-between border-b border-[#262626] px-4">
        <span className="font-display text-xl font-bold tracking-[-0.04em]">Instagram</span>
        <div className="flex items-center gap-4 text-white">
          <Icon name="plus" size={20} strokeWidth={1.8} />
          <Icon name="comment" size={20} strokeWidth={1.8} />
        </div>
      </div>

      <div className="px-4 pb-4 pt-5">
        <div className="flex items-center gap-5">
          <div className="rounded-full bg-[linear-gradient(135deg,#f9ce34,#ee2a7b,#6228d7)] p-[3px]">
            <div className="rounded-full bg-black p-[3px]">
              <Image src={plan.perfil.logo} alt="Logo Wundeer" width={82} height={82} className="h-[74px] w-[74px] rounded-full object-cover" />
            </div>
          </div>
          <div className="grid min-w-0 flex-1 grid-cols-3 gap-2 text-center">
            <span className="min-w-0"><strong className="block text-base font-semibold">{posts.length}</strong><small className="block whitespace-nowrap text-[9px] text-[#f5f5f5] sm:text-xs">publicaciones</small></span>
            <span className="min-w-0"><strong className="block text-base font-semibold">{plan.perfil.metricas.seguidores}</strong><small className="block whitespace-nowrap text-[9px] text-[#f5f5f5] sm:text-xs">seguidores</small></span>
            <span className="min-w-0"><strong className="block text-base font-semibold">{plan.perfil.metricas.siguiendo}</strong><small className="block whitespace-nowrap text-[9px] text-[#f5f5f5] sm:text-xs">seguidos</small></span>
          </div>
        </div>

        <div className="mt-4 text-sm leading-5">
          <p className="font-semibold">{plan.perfil.nombre}</p>
          <p className="text-[#a8a8a8]">Marca de ropa</p>
          <p className="mt-1 text-[#f5f5f5]">{plan.perfil.bio}</p>
          <p className="mt-1 font-semibold text-[#e0f1ff]">wundeer.co</p>
        </div>

        <div className="mt-4 grid grid-cols-[1fr_1fr_44px] gap-2">
          <BotonPerfil primario={!siguiendo} onClick={() => setSiguiendo((valor) => !valor)}>{siguiendo ? 'Siguiendo' : 'Seguir'}</BotonPerfil>
          <BotonPerfil onClick={() => posts[0] && onAbrir(posts[0].id)}>Mensaje</BotonPerfil>
          <BotonPerfil onClick={() => posts[0] && onAbrir(posts[0].id)}><Icon name="user" size={17} /></BotonPerfil>
        </div>

        <div className="mt-5 flex gap-4 overflow-x-auto pb-1">
          {plan.perfil.highlights.map((nombre, indice) => <button key={nombre} type="button" onClick={() => posts[indice % posts.length] && onAbrir(posts[indice % posts.length].id)} className="w-[62px] shrink-0 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-[#363636] bg-[#121212] p-[3px]">
              <span className="grid h-full w-full place-items-center rounded-full bg-[#1d1d1d] font-semibold text-white">{nombre.slice(0, 1)}</span>
            </span>
            <span className="mt-1 block truncate text-[11px] text-[#f5f5f5]">{nombre}</span>
          </button>)}
        </div>
      </div>

      <div className="grid h-11 grid-cols-3 border-t border-[#262626] text-[#a8a8a8]">
        <span className="grid place-items-center border-b border-white text-white"><Icon name="grid" size={19} strokeWidth={1.6} /></span>
        <span className="grid place-items-center"><Icon name="video" size={19} strokeWidth={1.6} /></span>
        <span className="grid place-items-center"><Icon name="user" size={19} strokeWidth={1.6} /></span>
      </div>

      <div className="grid grid-cols-3 gap-[2px] bg-black" aria-label="Grilla 3x3 de Instagram; arrastre para ordenar">
        {posts.map((post) => <div
          key={post.id}
          role="button"
          tabIndex={0}
          draggable
          onClick={() => onSeleccionar(post.id)}
          onDoubleClick={() => onAbrir(post.id)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onSeleccionar(post.id);
            }
          }}
          onDragStart={() => onDragStart(post.id)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => onDrop(event, post.slot)}
          className={`group relative cursor-pointer outline-none ${seleccionadoId === post.id ? 'ring-2 ring-inset ring-white' : 'hover:opacity-80 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white'}`}
          aria-label={`Abrir publicación ${post.slot}`}
        >
          <MediaFrame post={post} />
          <span className={`absolute bottom-1 left-1 rounded-sm bg-black/80 px-1.5 py-0.5 font-mono text-[7px] uppercase ${estadoClase[post.estado]}`}>{estadoLabel[post.estado]}</span>
        </div>)}
      </div>
    </div>
    <p className="mt-3 text-center font-mono text-[10px] leading-5 text-blanco-50">Vista previa de Instagram · toque para editar · doble toque para ampliar</p>
  </article>;
}

function PautaMock({ plan, posts, seleccionadoId, onSeleccionar, onAbrir }: {
  plan: SocialPlanning;
  posts: SocialPost[];
  seleccionadoId: string | null;
  onSeleccionar: (id: string) => void;
  onAbrir: (id: string) => void;
}) {
  const seleccionado = posts.find((post) => post.id === seleccionadoId) ?? posts[0];
  if (!seleccionado) return null;

  return <article className="min-w-0 self-start border border-blanco-20 bg-blanco-05 p-3 sm:p-5" aria-label="Vista previa de pauta publicitaria">
    <div className="overflow-hidden rounded-[18px] border border-[#262626] bg-black text-white shadow-[0_24px_70px_rgba(0,0,0,.5)]">
      <div className="flex h-12 items-center justify-between border-b border-[#262626] px-4">
        <span className="font-display text-xl font-bold tracking-[-0.04em]">Instagram</span>
        <span className="rounded-md bg-[#262626] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#a8a8a8]">Vista de anuncio</span>
      </div>
      <div className="flex items-center gap-3 px-4 py-3">
        <Image src={plan.perfil.logo} alt="Logo Wundeer" width={42} height={42} className="h-10 w-10 rounded-full border border-[#363636] object-cover" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{plan.perfil.usuario}</p>
          <p className="text-xs text-[#a8a8a8]">Patrocinado</p>
        </div>
        <span className="text-xl tracking-[0.18em] text-[#a8a8a8]">...</span>
      </div>

      <button type="button" onClick={() => onAbrir(seleccionado.id)} className="block w-full text-left">
        <MediaFrame post={seleccionado} grande />
      </button>

      <div className="flex items-center justify-between border-y border-[#262626] bg-[#121212] px-4 py-3">
        <div className="min-w-0 pr-3">
          <p className="text-[10px] uppercase tracking-wide text-[#a8a8a8]">wundeer.co</p>
          <p className="truncate text-sm font-semibold">{seleccionado.caption}</p>
        </div>
        <button type="button" onClick={() => onAbrir(seleccionado.id)} className="shrink-0 rounded-lg bg-[#0095f6] px-4 py-2 text-xs font-semibold text-white">{seleccionado.cta ?? 'Comprar ahora'}</button>
      </div>

      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex gap-5"><Icon name="comment" size={21} /><Icon name="publish" size={21} /></div>
        <Icon name="flag" size={21} />
      </div>
      <p className="px-4 pb-4 text-sm leading-6 text-[#f5f5f5]"><strong>{plan.perfil.usuario}</strong> {seleccionado.caption}</p>

      <div className="grid grid-cols-3 gap-2 border-t border-[#262626] p-3" aria-label="Variantes de pauta publicitaria">
        {posts.map((post) => <button key={post.id} type="button" onClick={() => onSeleccionar(post.id)} className={`relative overflow-hidden rounded-md outline-none ${seleccionado.id === post.id ? 'ring-2 ring-[#0095f6]' : 'opacity-65 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-white'}`} aria-label={`Seleccionar pauta ${post.slot}`}>
          <MediaFrame post={post} />
          <span className="absolute left-1 top-1 rounded bg-black/75 px-1.5 py-0.5 text-[8px] font-semibold">ANUNCIO {post.slot}</span>
        </button>)}
      </div>
    </div>
    <p className="mt-3 text-center font-mono text-[10px] leading-5 text-blanco-50">PAUTA PUBLICITARIA · flujo de aprobación independiente</p>
  </article>;
}

function Campo({ label, ayuda, children }: { label: string; ayuda?: string; children: React.ReactNode }) {
  return <label className="block">
    <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.1em] text-blanco-60">{label}</span>
    {children}
    {ayuda && <span className="mt-2 block text-xs leading-5 text-blanco-50">{ayuda}</span>}
  </label>;
}

const inputClass = 'w-full border border-blanco-25 bg-negro px-3 py-3 text-sm text-blanco outline-none transition placeholder:text-blanco-30 focus:border-mostaza focus:ring-1 focus:ring-mostaza';

function EditorPublicacion({ post, etiqueta, ariaLabel, onActualizar, onMover, onAprobar, onSolicitarCambios, onAbrir, puedeEditar, puedeAprobar }: {
  post: SocialPost;
  etiqueta: string;
  ariaLabel: string;
  onActualizar: (cambios: Partial<SocialPost>) => void;
  onMover: (direccion: 'atras' | 'adelante') => void;
  onAprobar: () => void;
  onSolicitarCambios: (comentario: string) => void;
  onAbrir: () => void;
  /** NX-1028 paso 3: quién edita, ordena y programa (equipo y owner). */
  puedeEditar: boolean;
  /** NX-1028 paso 3: quién aprueba o pide cambios (cliente y owner). */
  puedeAprobar: boolean;
}) {
  const [mostrarFeedback, setMostrarFeedback] = useState(post.estado === 'cambios');
  const [comentario, setComentario] = useState(post.feedbackCambio ?? '');
  const [error, setError] = useState('');

  function confirmarCambios() {
    if (!comentario.trim()) {
      setError('Escribe el cambio que necesita el equipo antes de enviarlo.');
      return;
    }
    onSolicitarCambios(comentario);
    setError('');
    setMostrarFeedback(false);
  }

  return <section aria-label={ariaLabel} className="min-w-0 border border-blanco-20 bg-blanco-05 p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-blanco-50">{etiqueta}</p>
        <h2 className="mt-2 font-display text-3xl font-bold uppercase text-blanco">Publicación {post.slot} · {post.tipo}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-blanco-60">Instagram y Facebook publican la descripción: el nombre interno no sale en la pieza.</p>
      </div>
      <span className={`border px-2 py-1 font-mono text-[10px] uppercase ${estadoClase[post.estado]}`}>{estadoLabel[post.estado]}</span>
    </div>

    <div className="mt-6 grid gap-6 xl:grid-cols-[280px_1fr]">
      <div className="space-y-4">
        <div className="overflow-hidden border border-blanco-20"><MediaFrame post={post} grande /></div>
        <button type="button" onClick={onAbrir} className="btn-brutal min-h-[44px] w-full">Vista final de publicacion</button>
      </div>

      <div className="grid gap-4">
        <Campo label="URL del contenido o carpeta de Drive" ayuda="Primer dato: pega el video, archivo, carpeta de Drive, YouTube, Vimeo o imagen original.">
          <input className={inputClass} type="url" value={post.mediaUrl} readOnly={!puedeEditar} placeholder="https://drive.google.com/..." onInput={(event) => onActualizar({ mediaUrl: event.currentTarget.value })} />
        </Campo>

        <Campo label="URL de portada" ayuda="Usa una imagen vertical o cuadrada. Si queda vacío, la grilla intenta usar el contenido principal.">
          <input className={inputClass} type="url" value={post.portadaUrl} readOnly={!puedeEditar} placeholder="https://.../portada.jpg" onInput={(event) => onActualizar({ portadaUrl: event.currentTarget.value })} />
        </Campo>

        <Campo label="Descripcion editable">
          <textarea className={`${inputClass} min-h-28 resize-y leading-6`} maxLength={2200} value={post.caption} readOnly={!puedeEditar} onInput={(event) => onActualizar({ caption: event.currentTarget.value })} />
        </Campo>

        <div className="grid gap-4 md:grid-cols-2">
          <Campo label="Hashtags editables">
            <input className={inputClass} value={post.hashtags.map((hashtag) => `#${hashtag}`).join(' ')} readOnly={!puedeEditar} onInput={(event) => onActualizar({ hashtags: event.currentTarget.value.split(/[#,\s]+/).map((hashtag) => hashtag.trim()).filter(Boolean) })} />
          </Campo>
          <Campo label="Fecha sugerida editable">
            <input className={inputClass} value={post.fechaSugerida} readOnly={!puedeEditar} onInput={(event) => onActualizar({ fechaSugerida: event.currentTarget.value })} />
          </Campo>
        </div>

        <div className="grid gap-3">
          {puedeEditar ? <>
            <button type="button" onClick={() => onMover('atras')} className="min-h-[44px] border border-blanco-20 px-4 font-mono text-xs uppercase text-blanco-70 hover:border-mostaza hover:text-mostaza">Mover atras</button>
            <button type="button" onClick={() => onMover('adelante')} className="min-h-[44px] border border-blanco-20 px-4 font-mono text-xs uppercase text-blanco-70 hover:border-mostaza hover:text-mostaza">Mover adelante</button>
          </> : <p className="col-span-full font-mono text-[10px] uppercase text-blanco-50">Ordena el equipo: {MOTIVO_SIN_PERMISO.editar}</p>}
          {puedeAprobar ? <>
            <button type="button" onClick={onAprobar} className="btn-brutal min-h-[44px]">Aprobar publicación</button>
            <button type="button" aria-expanded={mostrarFeedback} onClick={() => setMostrarFeedback((visible) => !visible)} className="min-h-[44px] border border-orquidea px-4 font-mono text-xs uppercase text-orquidea hover:bg-orquidea hover:text-blanco">Pedir cambios</button>
          </> : <p className="col-span-full font-mono text-[10px] uppercase text-blanco-50">Aprueba el cliente: {MOTIVO_SIN_PERMISO.aprobar}</p>}
        </div>

        {mostrarFeedback && <div className="border border-orquidea/60 bg-orquidea/5 p-4">
          <Campo label="Comentario del cambio" ayuda="El equipo recibirá este texto junto con la solicitud.">
            <textarea
              autoFocus
              className={`${inputClass} min-h-24 resize-y leading-6`}
              value={comentario}
              maxLength={1000}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? `error-feedback-${post.id}` : undefined}
              placeholder="Ej. Cambiar el primer plano por una toma del producto completo."
              onInput={(event) => setComentario(event.currentTarget.value)}
            />
          </Campo>
          {error && <p id={`error-feedback-${post.id}`} role="alert" className="mt-2 text-sm text-mostaza">{error}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={!comentario.trim()} onClick={confirmarCambios} className="min-h-[44px] bg-orquidea px-4 font-mono text-xs uppercase text-blanco disabled:cursor-not-allowed disabled:opacity-40">Confirmar solicitud</button>
            <button type="button" onClick={() => { setMostrarFeedback(false); setError(''); }} className="min-h-[44px] border border-blanco-20 px-4 font-mono text-xs uppercase text-blanco-60">Cancelar</button>
          </div>
        </div>}

        {post.feedbackCambio && post.estado === 'cambios' && <div className="border border-blanco-20 bg-negro p-4">
          <p className="font-mono text-[10px] uppercase text-orquidea">Cambio solicitado</p>
          <p className="mt-2 text-sm leading-6 text-blanco-70">{post.feedbackCambio}</p>
        </div>}
      </div>
    </div>
  </section>;
}

function ModalPost({ post, pauta, onClose }: { post: SocialPost; pauta: boolean; onClose: () => void }) {
  // Cerrar con Escape y con el clic en el fondo: antes solo había botón X.
  //
  // Hallazgo F5 (NX-1029): el modal cerraba con Escape pero no gestionaba el
  // foco — al abrir no lo enfocaba y al cerrar caía al `body`, dejando a quien
  // navega por teclado perdido en la página. Ahora el foco entra al abrir, queda
  // ATRAPADO dentro del diálogo (Tab/Shift+Tab ciclan por los controles visibles)
  // y se RESTAURA al elemento que lo abrió al cerrar.
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const abridor = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();

    function controlesFocales(): HTMLElement[] {
      if (!dialogRef.current) return [];
      return Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);
    }

    function alPulsar(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const focales = controlesFocales();
      if (focales.length === 0) return;
      const primero = focales[0];
      const ultimo = focales[focales.length - 1];
      const actual = document.activeElement;
      const dentro = !!actual && dialogRef.current?.contains(actual) === true;
      if (event.shiftKey && (!dentro || actual === primero)) {
        event.preventDefault();
        ultimo.focus();
      } else if (!event.shiftKey && (!dentro || actual === ultimo)) {
        event.preventDefault();
        primero.focus();
      }
    }

    window.addEventListener('keydown', alPulsar);
    return () => {
      window.removeEventListener('keydown', alPulsar);
      abridor?.focus();
    };
  }, [onClose]);

  return <div
    ref={dialogRef}
    tabIndex={-1}
    className="fixed inset-0 z-50 grid place-items-center bg-negro/90 p-4 outline-none"
    role="dialog"
    aria-modal="true"
    aria-label="Vista final de publicación"
    onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
  >
    <div className="grid max-h-[92vh] w-full max-w-5xl overflow-hidden border border-blanco-20 bg-negro lg:grid-cols-[1fr_.82fr]">
      <MediaFrame post={post} grande contenidoReal />
      <div className="flex min-h-0 flex-col">
        <div className="flex items-center justify-between border-b border-blanco-20 p-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full border border-mostaza bg-blanco-05 font-display text-xs font-bold text-mostaza">W</div>
            <div>
              <p className="font-display text-sm font-bold text-blanco">wundeer.co</p>
              <p className="text-xs text-blanco-50">{pauta ? 'Patrocinado' : 'Vista final de Instagram'}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar vista final" className="grid min-h-[44px] min-w-[44px] place-items-center border border-blanco-20 text-blanco-60 hover:text-blanco"><Icon name="close" size={18} /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <p className="text-sm leading-7 text-blanco-70"><strong className="text-blanco">wundeer.co</strong> {post.caption}</p>
          <p className="mt-4 font-mono text-xs leading-6 text-mostaza">{post.hashtags.map((hashtag) => `#${hashtag}`).join(' ')}</p>
          {pauta && <button type="button" className="mt-5 min-h-[44px] w-full rounded-lg bg-[#0095f6] px-4 text-sm font-semibold text-white">{post.cta ?? 'Comprar ahora'}</button>}
          <div className="mt-6 grid grid-cols-3 gap-2 border-y border-blanco-20 py-4 font-mono text-[10px] uppercase text-blanco-60">
            <span>Me gusta 1.248</span><span>86 comentarios</span><span>Compartir</span>
          </div>
        </div>
      </div>
    </div>
  </div>;
}

const roadmapSteps = [
  { titulo: 'Enlazar contenido', detalle: 'Primero se pega el video, la carpeta de Drive o la imagen original.', estado: 'Listo para usar' },
  { titulo: 'Elegir portada', detalle: 'Cada video o carpeta puede tener una miniatura distinta para la grilla.', estado: 'Editable aquí' },
  { titulo: 'Editar descripción', detalle: 'Ajustar descripción, hashtags y fecha sugerida sin inventar un título que la red no muestra.', estado: 'Editable aquí' },
  { titulo: 'Aprobar o comentar', detalle: 'Aprobar o pedir cambios con un comentario concreto para el equipo.', estado: 'Cliente decide' },
  { titulo: 'Separar orgánico y pauta', detalle: 'Dos maquetas, el mismo flujo de aprobación y estados independientes.', estado: 'Interactivo' },
];

export function SocialPlanningShell({ initialPlan, permisos }: { initialPlan: SocialPlanning; permisos: PermisosSociales }) {
  // NX-1028 paso 3: los permisos llegan YA resueltos del servidor (la página
  // usa `rolEnProyecto`, el mismo rol que `/api/social-plan`). El cliente no
  // decide nada: solo pinta lo que el servidor va a aceptar.
  const puedeEditar = permisos.puedeEditar;
  const puedeAprobar = permisos.puedeAprobar;
  const [posts, setPosts] = useState(() => publicacionesOrdenadas(initialPlan.publicaciones));
  const [pautas, setPautas] = useState(() => publicacionesOrdenadas(initialPlan.pautas));
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(posts[0]?.id ?? null);
  const [pautaSeleccionadaId, setPautaSeleccionadaId] = useState<string | null>(pautas[0]?.id ?? null);
  const [modal, setModal] = useState<{ id: string; coleccion: Coleccion } | null>(null);
  const [arrastrandoId, setArrastrandoId] = useState<string | null>(null);
  const [presencia, setPresencia] = useState<{ total: number; demo: boolean } | null>(null);
  const [prototipo, setPrototipo] = useState<'cargando' | 'ok' | 'fallo'>('cargando');

  // H2 (paso 2): la decisión del cliente vivía solo en useState y moría en el
  // recargar. Se guarda en el almacenamiento LOCAL del navegador —no remoto,
  // no Supabase— y solo se restaura si la estructura coincide con el plan
  // vigente, para que un plan viejo no pinte publicaciones que ya no existen.
  const almacenKey = `plan-publicacion:${initialPlan.projectSlug}`;
  const leidoRef = useRef(false);
  const listoRef = useRef(false);
  // NX-1028: el autoguardado remoto necesita SABER cuándo la restauración local
  // decidió; un ref no provoca render y el hook se quedaría esperando para
  // siempre. La copia en estado manda el render; el ref sigue mandando el guardado.
  const [restaurado, setRestaurado] = useState(false);
  const marcarListo = () => {
    listoRef.current = true;
    // El estado se asienta diferido (mismo criterio que `aplicar` más abajo):
    // setState sincrónico en el cuerpo del efecto provoca renders en cascada.
    const programa = typeof window.requestAnimationFrame === 'function'
      ? window.requestAnimationFrame
      : window.setTimeout;
    programa(() => setRestaurado(true));
  };

  useEffect(() => {
    if (leidoRef.current) return;
    leidoRef.current = true;
    let pendiente: { posts?: SocialPost[]; pautas?: SocialPost[] } | null = null;
    try {
      const bruto = window.localStorage.getItem(almacenKey);
      if (!bruto) { marcarListo(); return; }
      pendiente = JSON.parse(bruto) as { posts?: SocialPost[]; pautas?: SocialPost[] };
    } catch {
      // Almacenamiento corrupto: se ignora y se pinta el plan base.
      marcarListo();
      return;
    }
    const mismosIds = (lista: SocialPost[] | undefined, base: SocialPost[]) =>
      Array.isArray(lista) && lista.length === base.length &&
      lista.every((post) => base.some((original) => original.id === post.id));
    const postsOk = mismosIds(pendiente.posts, initialPlan.publicaciones);
    const pautasOk = mismosIds(pendiente.pautas, initialPlan.pautas);
    if (!postsOk && !pautasOk) { marcarListo(); return; }
    // Se difiere al siguiente tick para no pisar el primer render ni entrar en
    // conflicto con la regla de no asentar estado en el cuerpo del efecto.
    const aplicar = () => {
      if (postsOk) setPosts(publicacionesOrdenadas(pendiente!.posts as SocialPost[]));
      if (pautasOk) setPautas(publicacionesOrdenadas(pendiente!.pautas as SocialPost[]));
      marcarListo();
    };
    const programa = typeof window.requestAnimationFrame === 'function'
      ? window.requestAnimationFrame
      : window.setTimeout;
    programa(aplicar);
  }, [almacenKey, initialPlan.publicaciones, initialPlan.pautas]);

  useEffect(() => {
    // No se guarda nada hasta que la restauración haya decidido, para que el
    // plan base no pise en el arranque las decisiones guardadas.
    if (!listoRef.current) return;
    try {
      window.localStorage.setItem(almacenKey, JSON.stringify({ posts, pautas }));
    } catch {
      // Sin espacio o en modo privado: el plan sigue funcionando en memoria.
    }
  }, [almacenKey, posts, pautas]);

  // NX-1028: autoguardado remoto con estado visible. `onCargar` aplica lo que
  // el servidor tiene (recuperación tras recargar, mandada por encima de
  // localStorage); `onConflicto` deja el estado en pantalla sin pisar nada.
  const [avisoConflicto, setAvisoConflicto] = useState<string | null>(null);
  const guardado = useSocialAutosave({
    projectSlug: initialPlan.projectSlug,
    // NX-1028 paso 3: quien no puede ni editar ni aprobar no dispara PUT — el
    // servidor respondería 403 y la interfaz pintaría un error que no es suyo.
    puedeEscribir: puedeEditar || puedeAprobar,
    posts,
    pautas,
    listo: restaurado,
    onCargar: useCallback((carga: { posts: SocialPost[]; pautas: SocialPost[] } | null) => {
      if (!carga) return;
      const mismosIds = (lista: SocialPost[], base: SocialPost[]) =>
        lista.length === base.length && lista.every((post) => base.some((original) => original.id === post.id));
      if (mismosIds(carga.posts, initialPlan.publicaciones)) setPosts(publicacionesOrdenadas(carga.posts));
      if (mismosIds(carga.pautas, initialPlan.pautas)) setPautas(publicacionesOrdenadas(carga.pautas));
    }, [initialPlan.publicaciones, initialPlan.pautas]),
    onConflicto: useCallback((versionActual: number) => {
      setAvisoConflicto(
        versionActual >= 0
          ? `Otra persona guardó primero (versión ${versionActual}). Recarga la página antes de seguir.`
          : 'Otra persona guardó primero. Recarga la página antes de seguir.',
      );
    }, []),
  });

  // H4 (paso 2): presencia. SOLO lectura (GET) y degradable: sin sesión la API
  // responde 401 y el indicador simplemente no se pinta. Cero escrituras.
  useEffect(() => {
    let vivo = true;
    void fetch('/api/presencia', { cache: 'no-store' })
      .then((respuesta) => (respuesta.ok ? respuesta.json() : null))
      .then((cuerpo) => {
        if (!vivo || !cuerpo || !Array.isArray(cuerpo.presencia)) return;
        setPresencia({ total: cuerpo.presencia.length, demo: Boolean(cuerpo.demo) });
      })
      .catch(() => { if (vivo) setPresencia(null); });
    return () => { vivo = false; };
  }, []);

  // H6 (paso 2): si el iframe del prototipo es bloqueado (X-Frame-Options/CSP)
  // no carga nunca y antes quedaba un bloque blanco mudo. A los 12 s sin onLoad
  // se pinta el aviso con el enlace externo.
  useEffect(() => {
    if (prototipo !== 'cargando') return;
    const espera = setTimeout(() => setPrototipo('fallo'), 12000);
    return () => clearTimeout(espera);
  }, [prototipo]);

  const seleccionado = useMemo(() => posts.find((post) => post.id === seleccionadoId) ?? posts[0] ?? null, [posts, seleccionadoId]);
  const pautaSeleccionada = useMemo(() => pautas.find((post) => post.id === pautaSeleccionadaId) ?? pautas[0] ?? null, [pautas, pautaSeleccionadaId]);
  const modalPost = useMemo(() => {
    if (!modal) return null;
    return (modal.coleccion === 'organico' ? posts : pautas).find((post) => post.id === modal.id) ?? null;
  }, [modal, pautas, posts]);
  const aprobadas = posts.filter((post) => post.estado === 'aprobado').length;
  const pautasAprobadas = pautas.filter((post) => post.estado === 'aprobado').length;

  function actualizar(coleccion: Coleccion, postId: string, cambios: Partial<SocialPost>) {
    const setter = coleccion === 'organico' ? setPosts : setPautas;
    setter((actuales) => publicacionesOrdenadas(actuales).map((post) => post.id === postId ? { ...post, ...cambios } : post));
  }

  function mover(coleccion: Coleccion, postId: string, direccion: 'atras' | 'adelante') {
    const setter = coleccion === 'organico' ? setPosts : setPautas;
    setter((actuales) => moverPublicacion(actuales, postId, direccion));
  }

  function aprobar(coleccion: Coleccion, postId: string) {
    const setter = coleccion === 'organico' ? setPosts : setPautas;
    setter((actuales) => aprobarPublicacion(actuales, postId, 'aprobado'));
  }

  function pedirCambios(coleccion: Coleccion, postId: string, comentario: string) {
    const setter = coleccion === 'organico' ? setPosts : setPautas;
    setter((actuales) => solicitarCambios(actuales, postId, comentario));
  }

  function onDrop(event: DragEvent<HTMLDivElement>, destinoSlot: number) {
    event.preventDefault();
    // NX-1028 paso 3: sin permiso de edición no se reordena ni arrastrando.
    if (!arrastrandoId || !puedeEditar) return;
    setPosts((actuales) => reordenarPublicaciones(actuales, arrastrandoId, destinoSlot));
    setArrastrandoId(null);
  }

  return <main className="min-h-screen bg-negro pb-24 text-blanco">
    <div className="mx-auto max-w-[1440px] px-5 py-8 md:px-10 md:py-12">
      <header className="grid gap-6 border-b border-blanco-20 pb-8 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-mostaza">Wundeer · planificación de redes</p>
          <h1 className="display-title mt-3">Plan de publicación</h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-blanco-70">Dos flujos locales y separados: la grilla orgánica imita el perfil de Instagram; la pauta muestra el anuncio como lo verá la audiencia. Ambos permiten portada, descripción, orden, aprobación y feedback sin tocar producción.</p>
        </div>
        <div className="grid grid-cols-2 gap-px border border-blanco-20 bg-blanco-10 text-center sm:grid-cols-4">
          <div className="bg-negro px-5 py-4"><p className="font-display text-3xl font-bold">{posts.length}</p><p className="font-mono text-[10px] text-blanco-50">ORGÁNICAS</p></div>
          <div className="bg-negro px-5 py-4"><p className="font-display text-3xl font-bold">{aprobadas}</p><p className="font-mono text-[10px] text-blanco-50">APROBADAS</p></div>
          <div className="bg-negro px-5 py-4"><p className="font-display text-3xl font-bold">{pautas.length}</p><p className="font-mono text-[10px] text-blanco-50">PAUTAS</p></div>
          <div className="bg-negro px-5 py-4"><p className="font-display text-3xl font-bold">{pautasAprobadas}</p><p className="font-mono text-[10px] text-blanco-50">PAUTAS OK</p></div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 lg:col-start-2">
          <p aria-live="polite" className="font-mono text-[10px] uppercase tracking-[0.1em] text-blanco-50">
            {presencia === null
              ? 'Presencia: sin datos (entrá con tu código de cliente)'
              : presencia.demo
                ? 'Presencia: modo demo, nadie reportado'
                : `En línea ahora: ${presencia.total}`}
          </p>
          <p
            data-testid="estado-guardado"
            aria-live="polite"
            className={
              guardado.estado === 'conflicto'
                ? 'border border-fucsia px-3 py-1 font-mono text-[10px] uppercase text-fucsia'
                : guardado.estado === 'guardado'
                  ? 'border border-mostaza px-3 py-1 font-mono text-[10px] uppercase text-mostaza'
                  : 'border border-blanco-20 px-3 py-1 font-mono text-[10px] uppercase text-blanco-50'
            }
          >
            {avisoConflicto && guardado.estado === 'conflicto' ? avisoConflicto : ESTADO_GUARDADO_TEXTO[guardado.estado]}
          </p>
          {puedeEditar && <button
            type="button"
            onClick={() => {
              setPosts(publicacionesOrdenadas(initialPlan.publicaciones));
              setPautas(publicacionesOrdenadas(initialPlan.pautas));
              try { window.localStorage.removeItem(almacenKey); } catch { /* sin almacenamiento */ }
            }}
            className="min-h-[36px] border border-blanco-20 px-3 font-mono text-[10px] uppercase text-blanco-50 hover:border-mostaza hover:text-mostaza"
          >
            Restaurar plan base
          </button>}
        </div>
      </header>

      <section className="mt-10">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-4xl font-bold uppercase text-blanco">Contenido orgánico</h2>
            <p className="mt-2 text-sm leading-6 text-blanco-60">Perfil, historias destacadas y grilla 3x3 con apariencia de Instagram.</p>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-mostaza">Instagram · Facebook</span>
        </div>
        <div className="grid min-w-0 gap-8 xl:grid-cols-[minmax(360px,500px)_1fr]">
          <InstagramMock
            plan={initialPlan}
            posts={posts}
            seleccionadoId={seleccionadoId}
            onSeleccionar={setSeleccionadoId}
            onAbrir={(id) => setModal({ id, coleccion: 'organico' })}
            onDragStart={setArrastrandoId}
            onDrop={onDrop}
          />
          {seleccionado && <EditorPublicacion
            key={`organico-${seleccionado.id}`}
            post={seleccionado}
            etiqueta="Publicación orgánica seleccionada"
            ariaLabel="Editor de contenido organico"
            onActualizar={(cambios) => actualizar('organico', seleccionado.id, cambios)}
            onMover={(direccion) => mover('organico', seleccionado.id, direccion)}
            onAprobar={() => aprobar('organico', seleccionado.id)}
            onSolicitarCambios={(comentario) => pedirCambios('organico', seleccionado.id, comentario)}
            onAbrir={() => setModal({ id: seleccionado.id, coleccion: 'organico' })}
            puedeEditar={puedeEditar}
            puedeAprobar={puedeAprobar}
          />}
        </div>
      </section>

      <section className="mt-16 border-t border-blanco-20 pt-10">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-4xl font-bold uppercase text-blanco">Pauta publicitaria</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-blanco-60">El anuncio conserva el mismo flujo de edición y aprobación, pero muestra patrocinado, llamada a la acción y variantes de campaña.</p>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-orquidea">Meta Ads · maqueta local</span>
        </div>
        <div className="grid min-w-0 gap-8 xl:grid-cols-[minmax(360px,500px)_1fr]">
          <PautaMock
            plan={initialPlan}
            posts={pautas}
            seleccionadoId={pautaSeleccionadaId}
            onSeleccionar={setPautaSeleccionadaId}
            onAbrir={(id) => setModal({ id, coleccion: 'pauta' })}
          />
          {pautaSeleccionada && <EditorPublicacion
            key={`pauta-${pautaSeleccionada.id}`}
            post={pautaSeleccionada}
            etiqueta="Pauta seleccionada"
            ariaLabel="Editor de pauta publicitaria"
            onActualizar={(cambios) => actualizar('pauta', pautaSeleccionada.id, cambios)}
            onMover={(direccion) => mover('pauta', pautaSeleccionada.id, direccion)}
            onAprobar={() => aprobar('pauta', pautaSeleccionada.id)}
            onSolicitarCambios={(comentario) => pedirCambios('pauta', pautaSeleccionada.id, comentario)}
            onAbrir={() => setModal({ id: pautaSeleccionada.id, coleccion: 'pauta' })}
            puedeEditar={puedeEditar}
            puedeAprobar={puedeAprobar}
          />}
        </div>
      </section>

      <section className="mt-16 border border-blanco-20 bg-blanco-05 p-5 sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-4xl font-bold uppercase text-blanco">Flujo de aprobación</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-blanco-60">Del enlace original a la decisión del cliente, sin perder la portada ni el comentario del cambio.</p>
          </div>
          <div className="border border-mostaza px-4 py-3 text-right"><p className="font-display text-3xl font-bold text-mostaza">{aprobadas + pautasAprobadas}/{posts.length + pautas.length}</p><p className="font-mono text-[10px] uppercase text-blanco-50">aprobadas</p></div>
        </div>
        <div className="mt-6 grid gap-px border border-blanco-20 bg-blanco-20 md:grid-cols-5">
          {roadmapSteps.map((paso, indice) => <article key={paso.titulo} className="bg-negro p-4">
            <span className="font-mono text-[10px] text-mostaza">{String(indice + 1).padStart(2, '0')}</span>
            <h3 className="mt-5 font-display text-xl font-bold uppercase text-blanco">{paso.titulo}</h3>
            <p className="mt-3 text-sm leading-6 text-blanco-60">{paso.detalle}</p>
            <p className="mt-5 font-mono text-[9px] uppercase tracking-[0.08em] text-blanco-40">{paso.estado}</p>
          </article>)}
        </div>
      </section>

      <section className="mt-8 overflow-hidden border border-blanco-20 bg-blanco-05">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-blanco-20 p-4">
          <div><p className="font-mono text-[10px] uppercase tracking-[0.1em] text-blanco-50">Prototipo relacionado</p><p className="mt-1 font-display text-xl font-bold text-blanco">{initialPlan.prototipo.label}</p></div>
          <a href={initialPlan.prototipo.url} target="_blank" rel="noreferrer" className="inline-flex min-h-[44px] items-center border border-mostaza px-4 font-mono text-xs uppercase text-mostaza hover:bg-mostaza hover:text-negro">Abrir prototipo completo</a>
        </div>
        <iframe
          title="Prototipo Wundeer"
          src={initialPlan.prototipo.url}
          className="h-[560px] w-full bg-blanco"
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          onLoad={() => setPrototipo('ok')}
        />
        {prototipo === 'fallo' && (
          <div role="alert" className="border-t border-mostaza bg-negro p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-mostaza">El prototipo no se pudo cargar aquí</p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-blanco-70">Puede estar bloqueado para embeber en esta página. Ábrelo en otra pestaña con el botón de arriba para revisarlo igual.</p>
          </div>
        )}
      </section>
    </div>

    {modalPost && modal && <ModalPost post={modalPost} pauta={modal.coleccion === 'pauta'} onClose={() => setModal(null)} />}
  </main>;
}
