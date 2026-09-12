/**
 * Roadmap data for Wundeer, split into three tracks: Development, Design and
 * Content creation. The first two come from the executive documents; the third
 * is generated from the production cadence (Saturday sessions, five finished
 * pieces per session, delivered Monday–Thursday the following week).
 */

export type RoadmapDay = { label: string; date: string; urgent?: boolean; items: string[] };

export type Sprint = {
  title: string;
  dates: string;
  focus: string;
  objective?: string;
  modules?: string[];
  days?: RoadmapDay[];
  deliverable?: string;
  note?: string;
};

export type Pillar = 'TEXTIL' | 'CORTE' | 'TALLAS' | 'GRWM' | 'COMUNIDAD' | 'PACKS' | 'CUIDADO';

export type ContentDelivery = { n: number; day: string; iso: string };
export type ContentPiece = { pillar: Pillar; topic: string };

export type ContentWeek = {
  week: number;
  sessionIso: string;
  sessionLabel: string;
  monthLabel: string;
  theme: string;
  pieces: ContentPiece[];
  deliveries: ContentDelivery[];
};

/* ─────────────────────────── DESARROLLO ─────────────────────────── */

export const devMeta = {
  start: '8 SEP',
  goLive: '1 OCT',
  sprints: '3',
  architecture: 'NESTJS (monolito modular)',
  principle: 'Cada sprint deja el sistema desplegable. Se construye sobre la misma base y se amplía sin una reescritura masiva.',
};

export const devRoadmap: Sprint[] = [
  {
    title: 'S1 · LANDING BÁSICA',
    dates: '08–12 SEP',
    focus: 'Landing normalita: se ve bien, carga inventario y permite que el admin cree. Nada más.',
    objective: 'Tener una landing presentable conectada a datos reales. El visitante ve productos e inventario; el administrador los crea y edita.',
    modules: ['Config + Prisma: PrismaService global, PostgreSQL 16 y ConfigModule mínimo', 'Catalog: Product, filtros, detalle por slug y creación/edición administrativa', 'Inventory: variantes por color/talla, actualización bulk y alerta de stock < 20', 'Frontend: hero, catálogo, filtros, ficha con galería, precio dual y stock informativo'],
    deliverable: 'Landing navegable con 12 productos reales, filtros activos y demostración de creación de producto y ajuste de stock persistido en PostgreSQL.',
    note: 'Fuera de alcance: JWT, checkout, pedidos, usuarios y métricas.',
  },
  {
    title: 'S2 · ADMIN ROBUSTO + RETAIL SIN LOGIN',
    dates: '15–26 SEP',
    focus: 'Cerrar la operación retail: comprar sin fricción y administrar con control, métricas y validaciones.',
    objective: 'Terminar un admin confiable con métricas y permitir que cualquier visitante cree una orden sin iniciar sesión.',
    modules: ['Auth + Users: login JWT 8h, bcrypt, JwtStrategy, RolesGuard y rol ADMIN', 'Hardening: validación estricta, filtro global, Helmet, throttling y healthcheck', 'Orders: pedido público, precios recalculados, mínimos, estado y validación 1:1', 'Customers: CRUD, búsqueda e historial de pedidos', 'Reporting: KPIs de pedidos, estados y stock bajo', 'Frontend: carrito local, checkout guest, agradecimiento y panel administrativo'],
    deliverable: 'Un visitante compra sin login; el admin ve el pedido nuevo, lo aprueba y consulta métricas. El flujo retail queda cerrado.',
  },
  {
    title: 'S3 · CIERRE Y GO-LIVE',
    dates: '22 SEP – 01 OCT',
    focus: 'Agregar identidad y canal mayorista sin sacrificar el flujo guest ni convertir wholesale en una tienda completa.',
    objective: 'Añadir cuentas opcionales, exponer el canal mayorista por URL privada con WhatsApp y dejar el sistema listo para producción.',
    modules: ['Cuentas: registro buyer, login y perfil; guest se conserva y Bearer vincula customer_id', 'Wholesale informativo: URL privada/no indexada, mínimos, precios y CTA a WhatsApp', 'Media: carga a S3/R2 para sustituir imágenes temporales', 'Producción: paginación, CORS allowlist, migraciones y Procfile', 'Calidad: cobertura en módulos críticos, e2e y documentación de decisiones'],
    deliverable: 'Producción en wunder.com con landing, catálogo, admin robusto, pedidos guest, cuentas opcionales y URL mayorista informativa.',
  },
];

/* ─────────────────────────── DISEÑO ─────────────────────────── */

export const designMeta = {
  client: 'WUNDEER',
  director: 'Samuel Zuluaga',
  launch: '1 de Octubre',
  objective: 'MVP funcional y primera venta B2C. Enfoque 100% entregables de UI/UX, dirección de arte y branding físico.',
};

export const designRoadmap: Sprint[] = [
  {
    title: 'S1 · CIMIENTOS VISUALES, FICHA TÉCNICA Y PREPRENSA',
    dates: '10–14 SEP',
    focus: 'Congelar la identidad y dejar las bases físicas listas para imprenta.',
    days: [
      { label: 'Día 1', date: '10 SEP', items: ['Brandkit congelado: paleta cromática oficial (neutros/concreto), jerarquía tipográfica web/redes y Do\'s & Don\'ts.', '⚠️ Prohibida la estética callejera/grafitera.'] },
      { label: 'Día 2', date: '11 SEP', items: ['Ficha técnica vectorial en centímetros (ancho de pecho, largo, caída de hombro) sobre silueta vectorial con badge de la tela real.'] },
      { label: 'Día 3', date: '12 SEP', urgent: true, items: ['Artes finales vectoriales en curvas para imprenta: sticker adhesivo SKU/talla para bolsa Ziploc, tarjeta de agradecimiento + guía de cuidado, y etiqueta tejida de cuello.'] },
      { label: 'Día 4', date: '13–14 SEP', items: ['Plantillas maestras para contenido: layout de carrusel (textura/costuras), layout de guía de tallas e infografías, y paquete de overlays (badges de textil, lower thirds, cierre CTA).'] },
    ],
  },
  {
    title: 'S2 · CREATIVOS DE PAUTA (TOFU/MOFU) & CONTENIDO ORGÁNICO BASE',
    dates: '15–21 SEP',
    focus: 'Producir la pauta y la base orgánica del feed.',
    days: [
      { label: 'Día 5', date: '15–16 SEP', items: ['4 variaciones gráficas de pauta: calidad/densidad del textil, comparativa Boxy/Drop-shoulder vs camiseta, Packs x3 + envío gratis (>$220.000 COP), y pruebas de durabilidad/GRWM.'] },
      { label: 'Día 6', date: '17–18 SEP', items: ['5 piezas piloto (2 videos + 3 publicaciones) sobre la grilla base para estructurar el feed inicial (Manifiesto, Tallas, Packs).'] },
      { label: 'Día 7', date: '19–21 SEP', items: ['Tratamiento de color (color grading) en fotos/videos manteniendo estética de concreto/neutros, y entrega de carpeta final de creativos.'] },
    ],
  },
  {
    title: 'S3 · ASSETS WEB B2C, TESTEO DE PAUTA & RETARGETING',
    dates: '22–27 SEP',
    focus: 'Assets de la tienda y artes de retargeting.',
    days: [
      { label: 'Día 8', date: '22 SEP', items: ['Hero banner principal, banner de oferta Pack x3/Bundles para el feed, y acceso/card B2B discreto ("¿Compras al por mayor? Cotiza aquí") que desvía a WhatsApp.'] },
      { label: 'Día 9', date: '23–24 SEP', items: ['Corrección gráfica en vivo sobre la web en móvil: fuentes, márgenes de fotos y legibilidad de la tabla de tallas.'] },
      { label: 'Día 10', date: '25–27 SEP', items: ['Ad retargeting cuadrado (producto + copy de carrito abandonado) y ad vertical para Stories/Reels con badge "Pago contra entrega".'] },
    ],
  },
  {
    title: 'S4 · AJUSTES DE SALIDA & ENCENDIDO COMERCIAL',
    dates: '28 SEP – 30 SEP',
    focus: 'Optimización final y encendido.',
    days: [
      { label: 'Optimización', date: '28 SEP', items: ['Optimización visual rápida basada en los anuncios con mejor CTR/conversión (filtro tela blanca).'] },
      { label: 'Lanzamiento', date: '1 OCT', items: ['Apertura comercial, encendido total del ecosistema digital y búsqueda de la primera venta B2C.'] },
    ],
  },
];

/* ───────────────────── CREACIÓN DE CONTENIDO ───────────────────── */

/**
 * Production cadence: one Saturday session per week, five pieces recorded and
 * finished per session, delivered Monday–Thursday of the following week.
 * Delivery slots: C1 = lunes, C2 = martes, C3 = miércoles, C4 = miércoles,
 * C5 = jueves. The plan runs five months from the first Saturday session.
 */

const WEEK_DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// Delivery offsets in days from the Saturday session (Monday +2 … Thursday +5).
const DELIVERY_OFFSETS: Array<{ n: number; offset: number }> = [
  { n: 1, offset: 2 }, // lunes
  { n: 2, offset: 3 }, // martes
  { n: 3, offset: 4 }, // miércoles
  { n: 4, offset: 4 }, // miércoles
  { n: 5, offset: 5 }, // jueves
];

function addDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setDate(result.getDate() + days);
  return result;
}

function formatEs(date: Date): string {
  return `${date.getDate()} ${MONTH_NAMES[date.getMonth()]}`;
}

export const contentMeta = {
  cadence: 'Sesión de grabación todos los sábados',
  perSession: '5 contenidos grabados y terminados por sesión',
  delivery: 'C1 lunes · C2 martes · C3 y C4 miércoles · C5 jueves',
  horizon: '5 meses de producción continua',
};

export const PILLAR_LABEL: Record<Pillar, string> = {
  TEXTIL: 'Textil',
  CORTE: 'Corte',
  TALLAS: 'Tallas',
  GRWM: 'GRWM',
  COMUNIDAD: 'Comunidad',
  PACKS: 'Packs',
  CUIDADO: 'Cuidado',
};

/**
 * Weekly theme + the five pieces recorded that Saturday. Each piece maps to a
 * content pillar so the plan stays aligned to the brand's organic system
 * (textile, fit, sizing, styling, community, packs and care).
 */
const CONTENT_PLAN: Array<{ theme: string; pieces: Array<[Pillar, string]> }> = [
  // Fase pre-lanzamiento — construcción de expectativa y educación
  { theme: 'Manifiesto y calidad', pieces: [
    ['COMUNIDAD', 'Manifiesto Wundeer: por qué hacemos ropa que se siente'],
    ['TEXTIL', 'La densidad del textil explicada en 15 segundos'],
    ['CORTE', 'Qué es el corte Boxy y por qué cambia todo'],
    ['TALLAS', 'Cómo elegir tu talla sin equivocarte'],
    ['CUIDADO', 'Guía rápida de cuidado para que dure años'],
  ]},
  { theme: 'El producto en detalle', pieces: [
    ['TEXTIL', 'Macro de textura: la costura que no se ve'],
    ['CORTE', 'Drop-shoulder vs camiseta convencional'],
    ['TEXTIL', 'Gramaje y caída: cómo se siente al tacto'],
    ['GRWM', 'GRWM: cómo se ve la prenda puesta'],
    ['CUIDADO', 'Prueba de durabilidad después de varios lavados'],
  ]},
  { theme: 'Cuenta regresiva al lanzamiento', pieces: [
    ['COMUNIDAD', 'Teaser del lanzamiento del 1 de octubre'],
    ['PACKS', 'Packs x3 + envío gratis'],
    ['TEXTIL', 'Lo que nadie te cuenta sobre la tela'],
    ['CORTE', 'El fit que llevabas buscando'],
    ['COMUNIDAD', 'Cuenta regresiva: esto es lo que viene'],
  ]},
  // Fase de lanzamiento — primera venta B2C
  { theme: 'Lanzamiento oficial', pieces: [
    ['COMUNIDAD', 'Ya estamos en vivo'],
    ['TEXTIL', 'Hero de producto: la prenda en su mejor versión'],
    ['TALLAS', 'Guía de tallas completa'],
    ['GRWM', 'GRWM real con el producto'],
    ['PACKS', 'Packs de lanzamiento'],
  ]},
  { theme: 'Primera semana en calle', pieces: [
    ['GRWM', 'Styling: cómo combinarla'],
    ['TEXTIL', 'Textura en movimiento'],
    ['CUIDADO', 'Cuidado real: lavado y secado'],
    ['TALLAS', 'FAQ de tallas'],
    ['COMUNIDAD', 'Primeras reseñas'],
  ]},
  { theme: '¿Por qué Boxy?', pieces: [
    ['CORTE', 'Comparativa: Boxy vs convencional'],
    ['CORTE', 'Proporciones y caída de hombro'],
    ['COMUNIDAD', '¿Para quién es el corte Boxy?'],
    ['GRWM', 'Antes/después con otra camiseta'],
    ['CORTE', 'Review honesto del corte'],
  ]},
  { theme: 'Rutina de uso', pieces: [
    ['GRWM', 'Un día con la prenda'],
    ['CUIDADO', 'Cómo se ve tras una semana de uso'],
    ['COMUNIDAD', '7 días, 7 looks'],
    ['TEXTIL', 'Durabilidad en uso diario'],
    ['COMUNIDAD', 'La gente ya la usa así'],
  ]},
  { theme: 'Cierre de mes', pieces: [
    ['COMUNIDAD', 'Resumen del primer mes'],
    ['TALLAS', 'Top preguntas del mes'],
    ['PACKS', 'Packs recomendados'],
    ['GRWM', 'GRWM de noche'],
    ['COMUNIDAD', 'Testimonio del mes'],
  ]},
  // Fase de consolidación — comunidad y confianza
  { theme: 'Comunidad', pieces: [
    ['COMUNIDAD', 'UGC: cómo la estilizan ustedes'],
    ['COMUNIDAD', 'Cliente real, historia real'],
    ['GRWM', 'Reta: 3 looks con una prenda'],
    ['COMUNIDAD', 'Las mejores combinaciones'],
    ['COMUNIDAD', 'Testimonio en video'],
  ]},
  { theme: 'Detalles que importan', pieces: [
    ['TEXTIL', 'Etiqueta y acabados'],
    ['TEXTIL', 'Costura plana explicada'],
    ['TEXTIL', 'Nuestra tela vs otras'],
    ['TEXTIL', 'Zoom a la textura'],
    ['TEXTIL', 'Por qué pagas por calidad'],
  ]},
  { theme: 'Regalos y packs', pieces: [
    ['PACKS', 'Guía de regalo'],
    ['PACKS', 'Packs x3 en detalle'],
    ['COMUNIDAD', 'Unboxing'],
    ['PACKS', 'Para él y para ella'],
    ['TEXTIL', 'Precio vs valor'],
  ]},
  { theme: 'Confianza', pieces: [
    ['COMUNIDAD', 'Garantía y devoluciones'],
    ['COMUNIDAD', 'Pago contra entrega'],
    ['COMUNIDAD', 'Reseñas verificadas'],
    ['TEXTIL', 'Comparativa de precio honesta'],
    ['COMUNIDAD', 'Preguntas difíciles, respuestas claras'],
  ]},
  // Fase de crecimiento — temporada y cápsula
  { theme: 'Cápsula esencial', pieces: [
    ['CORTE', 'Nuevas variantes de corte'],
    ['GRWM', 'Cómo combinar la cápsula'],
    ['TALLAS', 'Esenciales para empezar'],
    ['GRWM', 'Styling de la cápsula'],
    ['GRWM', 'GRWM de la semana'],
  ]},
  { theme: 'Temporada fin de año', pieces: [
    ['COMUNIDAD', 'Looks de fin de año'],
    ['PACKS', 'Packs para regalar'],
    ['GRWM', 'Estilismo festivo'],
    ['COMUNIDAD', 'Agradecimiento a la comunidad'],
    ['TEXTIL', 'La prenda que se siente bien en diciembre'],
  ]},
  { theme: 'Navidad', pieces: [
    ['COMUNIDAD', 'Gift guide navideño'],
    ['PACKS', 'Empaque y presentación'],
    ['COMUNIDAD', 'Mensaje de marca'],
    ['COMUNIDAD', 'Testimonio navideño'],
    ['COMUNIDAD', 'Countdown a navidad'],
  ]},
  { theme: 'Cierre de año', pieces: [
    ['COMUNIDAD', 'Recap del año'],
    ['TEXTIL', 'Lo más visto del año'],
    ['COMUNIDAD', 'Gracias comunidad'],
    ['COMUNIDAD', 'Propósitos con la marca'],
    ['GRWM', 'Último GRWM del año'],
  ]},
  // Fase de escala — autoridad e iteración
  { theme: 'Año nuevo, básicos', pieces: [
    ['TALLAS', 'Esenciales 2027'],
    ['TEXTIL', 'Re-inventario de básicos'],
    ['GRWM', 'Cómo empezar tu cápsula'],
    ['GRWM', 'GRWM de año nuevo'],
    ['COMUNIDAD', 'Lo que viene este año'],
  ]},
  { theme: 'Educación textil', pieces: [
    ['TEXTIL', 'Tipos de algodón'],
    ['TEXTIL', 'Densidad y gramaje'],
    ['TEXTIL', 'Cómo identificar calidad'],
    ['CUIDADO', 'Cuidado que alarga la vida'],
    ['TEXTIL', 'Mitos sobre la tela'],
  ]},
  { theme: 'Autoridad de marca', pieces: [
    ['COMUNIDAD', 'Nuestra historia'],
    ['COMUNIDAD', 'Detrás de cámaras del proceso'],
    ['COMUNIDAD', 'Nuestros valores'],
    ['TEXTIL', 'Cómo elegimos la tela'],
    ['COMUNIDAD', 'Por qué hacemos esto'],
  ]},
  { theme: 'Formato recurrente', pieces: [
    ['COMUNIDAD', 'Nueva serie semanal'],
    ['COMUNIDAD', 'Q&A con la comunidad'],
    ['COMUNIDAD', 'Reto de comunidad'],
    ['GRWM', 'Antes/después de styling'],
    ['COMUNIDAD', 'Testimonio de la semana'],
  ]},
  { theme: 'Iteración y optimización', pieces: [
    ['COMUNIDAD', 'Lo que más convirtió'],
    ['GRWM', 'Prueba de hooks'],
    ['TEXTIL', 'Re-cut de los top performers'],
    ['GRWM', 'GRWM con nuevo enfoque'],
    ['COMUNIDAD', 'UGC de la semana'],
  ]},
  { theme: 'Cierre de ciclo', pieces: [
    ['COMUNIDAD', 'Resumen de 5 meses'],
    ['COMUNIDAD', 'El roadmap que sigue'],
    ['COMUNIDAD', 'Gracias comunidad'],
    ['COMUNIDAD', 'Testimonio final'],
    ['GRWM', 'GRWM de cierre'],
  ]},
];

export const contentRoadmap: ContentWeek[] = (() => {
  const start = new Date(2026, 8, 12); // sábado 12 de septiembre de 2026
  const weeks: ContentWeek[] = [];
  for (let i = 0; i < CONTENT_PLAN.length; i += 1) {
    const session = addDays(start, i * 7);
    const deliveries: ContentDelivery[] = DELIVERY_OFFSETS.map(({ n, offset }) => {
      const day = addDays(session, offset);
      return { n, day: `${WEEK_DAY_NAMES[day.getDay()]} ${day.getDate()}`, iso: day.toISOString().slice(0, 10) };
    });
    weeks.push({
      week: i + 1,
      sessionIso: session.toISOString().slice(0, 10),
      sessionLabel: `Sábado ${formatEs(session)}`,
      monthLabel: `${MONTH_NAMES[session.getMonth()]} ${session.getFullYear()}`,
      theme: CONTENT_PLAN[i].theme,
      pieces: CONTENT_PLAN[i].pieces.map(([pillar, topic]) => ({ pillar, topic })),
      deliveries,
    });
  }
  return weeks;
})();

/** Group the content weeks by month for a compact timeline. */
export const contentMonths = (() => {
  const groups: Array<{ monthLabel: string; weeks: ContentWeek[] }> = [];
  for (const week of contentRoadmap) {
    const last = groups[groups.length - 1];
    if (last && last.monthLabel === week.monthLabel) last.weeks.push(week);
    else groups.push({ monthLabel: week.monthLabel, weeks: [week] });
  }
  return groups;
})();
