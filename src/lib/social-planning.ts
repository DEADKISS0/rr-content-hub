export type EstadoPublicacion = 'pendiente' | 'aprobado' | 'cambios';
export type TipoPublicacion = 'foto' | 'reel' | 'carrusel';

export type SocialPost = {
  id: string;
  slot: number;
  tipo: TipoPublicacion;
  titulo: string;
  caption: string;
  hashtags: string[];
  mediaUrl: string;
  portadaUrl: string;
  color: string;
  estado: EstadoPublicacion;
  fechaSugerida: string;
  feedbackCambio?: string;
  cta?: string;
};

export type SocialProfile = {
  nombre: string;
  usuario: string;
  bio: string;
  logo: string;
  metricas: {
    publicaciones: number;
    seguidores: string;
    siguiendo: number;
  };
  highlights: string[];
};

export type SocialPrototype = {
  label: string;
  url: string;
};

export type SocialPlanning = {
  projectSlug: string;
  nombreVisible: string;
  perfil: SocialProfile;
  prototipo: SocialPrototype;
  publicaciones: SocialPost[];
  pautas: SocialPost[];
};

const postsWundeer: SocialPost[] = [
  {
    id: 'w-post-01',
    slot: 1,
    tipo: 'reel',
    titulo: 'Del boceto a la prenda',
    caption: 'Así nace una colección cuando diseño, confección y venta hablan el mismo idioma.',
    hashtags: ['wundeer', 'modacolombiana', 'confeccion'],
    mediaUrl: '/mock/social/wundeer-01.svg',
    portadaUrl: '/mock/social/wundeer-01.svg',
    color: '#be076d',
    estado: 'pendiente',
    fechaSugerida: 'Lunes 9:00 a. m.',
  },
  {
    id: 'w-post-02',
    slot: 2,
    tipo: 'foto',
    titulo: 'Texturas que venden',
    caption: 'Primer plano de materiales para enseñar calidad antes de hablar de precio.',
    hashtags: ['textiles', 'calidad', 'marca'],
    mediaUrl: '/mock/social/wundeer-02.svg',
    portadaUrl: '/mock/social/wundeer-02.svg',
    color: '#ded116',
    estado: 'pendiente',
    fechaSugerida: 'Martes 11:30 a. m.',
  },
  {
    id: 'w-post-03',
    slot: 3,
    tipo: 'carrusel',
    titulo: 'Tres formas de usarlo',
    caption: 'Un mismo producto, tres ocasiones: vitrina, oficina y salida casual.',
    hashtags: ['outfit', 'styling', 'lookbook'],
    mediaUrl: '/mock/social/wundeer-03.svg',
    portadaUrl: '/mock/social/wundeer-03.svg',
    color: '#973d8f',
    estado: 'pendiente',
    fechaSugerida: 'Miercoles 6:00 p. m.',
  },
  {
    id: 'w-post-04',
    slot: 4,
    tipo: 'reel',
    titulo: 'Directo de fabrica',
    caption: 'Mostramos el proceso real para que la marca se sienta cercana y confiable.',
    hashtags: ['fabricacolombiana', 'proceso', 'hechoencolombia'],
    mediaUrl: '/mock/social/wundeer-04.svg',
    portadaUrl: '/mock/social/wundeer-04.svg',
    color: '#f5e6d3',
    estado: 'pendiente',
    fechaSugerida: 'Jueves 10:00 a. m.',
  },
  {
    id: 'w-post-05',
    slot: 5,
    tipo: 'foto',
    titulo: 'Producto estrella',
    caption: 'Una pieza central para fijar recordación visual y empujar conversion.',
    hashtags: ['productoestrella', 'moda', 'ecommerce'],
    mediaUrl: '/mock/social/wundeer-05.svg',
    portadaUrl: '/mock/social/wundeer-05.svg',
    color: '#be076d',
    estado: 'pendiente',
    fechaSugerida: 'Viernes 12:00 m.',
  },
  {
    id: 'w-post-06',
    slot: 6,
    tipo: 'carrusel',
    titulo: 'Guia de tallas simple',
    caption: 'Menos preguntas repetidas, mas confianza al comprar desde el sitio.',
    hashtags: ['tallas', 'comprasonline', 'confianza'],
    mediaUrl: '/mock/social/wundeer-06.svg',
    portadaUrl: '/mock/social/wundeer-06.svg',
    color: '#ded116',
    estado: 'pendiente',
    fechaSugerida: 'Sabado 9:30 a. m.',
  },
  {
    id: 'w-post-07',
    slot: 7,
    tipo: 'reel',
    titulo: 'Empaque y envio',
    caption: 'La experiencia no termina en la compra: tambien se ve en la entrega.',
    hashtags: ['unboxing', 'envios', 'experiencia'],
    mediaUrl: '/mock/social/wundeer-07.svg',
    portadaUrl: '/mock/social/wundeer-07.svg',
    color: '#973d8f',
    estado: 'pendiente',
    fechaSugerida: 'Domingo 5:00 p. m.',
  },
  {
    id: 'w-post-08',
    slot: 8,
    tipo: 'foto',
    titulo: 'Cliente ideal',
    caption: 'Contenido aspiracional para que la audiencia se vea usando la marca.',
    hashtags: ['comunidad', 'estilo', 'clienteideal'],
    mediaUrl: '/mock/social/wundeer-08.svg',
    portadaUrl: '/mock/social/wundeer-08.svg',
    color: '#f5e6d3',
    estado: 'pendiente',
    fechaSugerida: 'Lunes 7:00 p. m.',
  },
  {
    id: 'w-post-09',
    slot: 9,
    tipo: 'carrusel',
    titulo: 'Del feed a la tienda',
    caption: 'Cierre de parrilla conectando contenido, producto y compra en la web.',
    hashtags: ['tiendaonline', 'conversion', 'wundeer'],
    mediaUrl: '/mock/social/wundeer-09.svg',
    portadaUrl: '/mock/social/wundeer-09.svg',
    color: '#be076d',
    estado: 'pendiente',
    fechaSugerida: 'Martes 8:30 a. m.',
  },
];

const pautasWundeer: SocialPost[] = [
  {
    id: 'w-ad-01',
    slot: 1,
    tipo: 'reel',
    titulo: 'Coleccion lista para vender',
    caption: 'Conoce prendas colombianas listas para impulsar tu vitrina y vender mejor desde la primera colección.',
    hashtags: ['wundeer', 'modacolombiana', 'comprar'],
    mediaUrl: '/mock/social/wundeer-05.svg',
    portadaUrl: '/mock/social/wundeer-05.svg',
    color: '#be076d',
    estado: 'pendiente',
    fechaSugerida: 'Campaña · Semana 1',
    cta: 'Comprar ahora',
  },
  {
    id: 'w-ad-02',
    slot: 2,
    tipo: 'carrusel',
    titulo: 'Calidad directa de fabrica',
    caption: 'Mira texturas, terminaciones y referencias disponibles para tu próxima colección.',
    hashtags: ['textiles', 'fabricacolombiana', 'mayoristas'],
    mediaUrl: '/mock/social/wundeer-02.svg',
    portadaUrl: '/mock/social/wundeer-02.svg',
    color: '#ded116',
    estado: 'pendiente',
    fechaSugerida: 'Campaña · Semana 2',
    cta: 'Ver colección',
  },
  {
    id: 'w-ad-03',
    slot: 3,
    tipo: 'foto',
    titulo: 'Visita la tienda Wundeer',
    caption: 'Encuentra la prenda que completa tu vitrina y recibe acompañamiento para elegir referencias.',
    hashtags: ['wundeer', 'tiendaonline', 'coleccion'],
    mediaUrl: '/mock/social/wundeer-08.svg',
    portadaUrl: '/mock/social/wundeer-08.svg',
    color: '#973d8f',
    estado: 'pendiente',
    fechaSugerida: 'Campaña · Siempre activa',
    cta: 'Más información',
  },
];

const wundeerPlan: SocialPlanning = {
  projectSlug: 'wundeer',
  nombreVisible: 'Plan de publicación',
  perfil: {
    nombre: 'Wundeer',
    usuario: 'wundeer.co',
    bio: 'Confección colombiana directa de fábrica. Prendas listas para vender mejor.',
    logo: '/mock/social/wundeer-logo.svg',
    metricas: {
      publicaciones: 9,
      seguidores: '12.4K',
      siguiendo: 138,
    },
    highlights: ['Catalogo', 'Proceso', 'Tallas', 'Envios', 'Clientes'],
  },
  prototipo: {
    label: 'Prototipo ecommerce Wundeer',
    url: 'https://commerce-wundeer-beta.up.railway.app/',
  },
  publicaciones: postsWundeer,
  pautas: pautasWundeer,
};

export function planPublicacionDe(slug?: string | null): SocialPlanning | null {
  if (slug !== 'wundeer') return null;
  return {
    ...wundeerPlan,
    publicaciones: wundeerPlan.publicaciones.map((post) => ({ ...post, hashtags: [...post.hashtags] })),
    pautas: wundeerPlan.pautas.map((post) => ({ ...post, hashtags: [...post.hashtags] })),
    perfil: {
      ...wundeerPlan.perfil,
      metricas: { ...wundeerPlan.perfil.metricas },
      highlights: [...wundeerPlan.perfil.highlights],
    },
    prototipo: { ...wundeerPlan.prototipo },
  };
}

export function publicacionesOrdenadas(publicaciones: SocialPost[]): SocialPost[] {
  return [...publicaciones].sort((a, b) => a.slot - b.slot);
}

export function reordenarPublicaciones(publicaciones: SocialPost[], postId: string, destinoSlot: number): SocialPost[] {
  const ordenadas = publicacionesOrdenadas(publicaciones);
  const origen = ordenadas.findIndex((post) => post.id === postId);
  const destino = Math.max(0, Math.min(ordenadas.length - 1, destinoSlot - 1));
  if (origen < 0) return ordenadas;

  const [movida] = ordenadas.splice(origen, 1);
  ordenadas.splice(destino, 0, movida);

  return ordenadas.map((post, index) => ({ ...post, slot: index + 1 }));
}

export function moverPublicacion(publicaciones: SocialPost[], postId: string, direccion: 'atras' | 'adelante'): SocialPost[] {
  const actual = publicaciones.find((post) => post.id === postId);
  if (!actual) return publicacionesOrdenadas(publicaciones);
  const destino = actual.slot + (direccion === 'adelante' ? 1 : -1);
  return reordenarPublicaciones(publicaciones, postId, destino);
}

export function aprobarPublicacion(publicaciones: SocialPost[], postId: string, estado: EstadoPublicacion): SocialPost[] {
  return publicacionesOrdenadas(publicaciones).map((post) => (
    post.id === postId ? { ...post, estado } : { ...post }
  ));
}

export function portadaDePublicacion(post: SocialPost): string {
  return post.portadaUrl.trim() || post.mediaUrl.trim();
}

export function solicitarCambios(publicaciones: SocialPost[], postId: string, comentario: string): SocialPost[] {
  const feedbackCambio = comentario.trim();
  if (!feedbackCambio) throw new Error('Escribe un comentario con el cambio solicitado.');
  return publicacionesOrdenadas(publicaciones).map((post) => (
    post.id === postId ? { ...post, estado: 'cambios', feedbackCambio } : { ...post }
  ));
}
