/**
 * Roadmap de Wundeer: desarrollo, diseño y creación de contenido.
 *
 * CAMBIO DE FECHAS (Santiago, 2026-09-29): "estaría iniciando el 15 de octubre
 * no, la gracia sería iniciar ahora el primero de octubre, es un borde".
 * `ROADMAP_START_ISO` pasa a `2026-10-01` y TODAS las ventanas de los tres
 * tracks se recalculan desde ahí. Antes arrancaban el 8 de septiembre, que ya
 * estaba vencido: el plan se mostraba entero en rojo y no servía para decidir
 * nada. Ahora el go-live y el arranque coinciden, que es lo que se pidió.
 *
 * Y un cambio de fondo en la cadencia: **una sola sesión de graduación al mes,
 * no una por semana**. Antes el planGenerating 22 semanas con cinco piezas
 * cada una, 110 piezas, y ninguna sesion tenia fecha de cierre real. Ahora cada
 * mes tiene UNA sesión y un cierre, y el emphasis de octubre es la pauta
 * publicitaria, que es lo que hay que producir.
 *
 * Las fechas se calculan, no se escriben: los helpers de abajo son puros para
 * que el test las pueda comprobar, y ninguna fecha se calcula dentro de un
 * componente (el ESLint de React 19 marca `Date.now()` como impuro).
 */

/* ─────────────────────────── TIPOS ─────────────────────────── */

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

export type Pillar = 'TEXTIL' | 'CORTE' | 'TALLAS' | 'GRWM' | 'COMUNIDAD' | 'PACKS' | 'CUIDADO' | 'PAUTA';

export type ContentPiece = { pillar: Pillar; topic: string };

/**
 * Una sesión de graduación MENSUAL. Antes esto era una semana con cinco entregas
 * (lun/mar/mié/mié/jue): sonaba a commitments que nadie puede sostener y
 * escondía el hecho de que lo que importa es un corte al mes.
 */
export type ContentSession = {
  month: number;
  sessionIso: string;
  sessionLabel: string;
  monthLabel: string;
  theme: string;
  focus: string;
  closeIso: string;
  pieces: ContentPiece[];
  pauta: number;
};

export type TrackWindow = { title: string; startIso: string; endIso: string };

export type WindowState = 'cerrado' | 'en-curso' | 'pendiente';

/* ─────────────────────────── CALENDARIO ─────────────────────────── */

const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const WEEK_DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/**
 * Arranque del plan. Es un parámetro, no un `new Date(...)` dentro de la
 * generica: un literal de fecha en un modulo se evalua en build y cada deploy
 * re-databa el plan entero sin que nadie lo notara.
 */
export const ROADMAP_START_ISO = '2026-10-01';

function addDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setDate(result.getDate() + days);
  return result;
}

function toIso(date: Date): string {
  // `toISOString()` devuelve UTC: en una zona con offset negativo el día local
  // se va al anterior. Se arma la cadena a mano con la fecha local.
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatEs(date: Date): string {
  return `${WEEK_DAY_NAMES[date.getDay()]} ${date.getDate()} ${MONTH_NAMES[date.getMonth()]}`;
}

function fromIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const GO_LIVE_ISO = ROADMAP_START_ISO;
export const TRACK_START_ISO = ROADMAP_START_ISO;

/* ─────────────────────────── DESARROLLO ─────────────────────────── */

export const devMeta = {
  start: '1 OCT',
  goLive: '1 OCT',
  sprints: '3',
  architecture: 'NESTJS (monolito modular)',
  principle: 'Cada sprint deja el sistema desplegable. Se construye sobre la misma base y se amplía sin una reescritura masiva.',
};

export const devRoadmap: Sprint[] = [
  {
    title: 'S1 · LANDING BÁSICA',
    dates: '01–09 OCT',
    focus: 'Landing normalita: se ve bien, carga inventario y permite que el admin cree. Nada más.',
    objective: 'Tener una landing presentable conectada a datos reales. El visitante ve productos e inventario; el administrador los crea y edita.',
    modules: [
      'Config + Prisma: PrismaService global, PostgreSQL 16 y ConfigModule mínimo',
      'Catalog: Product, filtros, detalle por slug y creación/edición administrativa',
      'Inventory: variantes por color/talla, actualización bulk y alerta de stock < 20',
      'Frontend: hero, catálogo, filtros, ficha con galería, precio dual y stock informativo',
    ],
    deliverable: 'Landing navegable con 12 productos reales, filtros activos y demostración de creación de producto y ajuste de stock persistido en PostgreSQL.',
    note: 'Fuera de alcance: JWT, checkout, pedidos, usuarios y métricas.',
  },
  {
    title: 'S2 · ADMIN ROBUSTO + RETAIL SIN LOGIN',
    dates: '12–23 OCT',
    focus: 'Cerrar la operación retail: comprar sin fricción y administrar con control, métricas y validaciones.',
    objective: 'Terminar un admin confiable con métricas y permitir que cualquier visitante cree una orden sin iniciar sesión.',
    modules: [
      'Auth + Users: login JWT 8h, bcrypt, JwtStrategy, RolesGuard y rol ADMIN',
      'Hardening: validación estricta, filtro global, Helmet, throttling y healthcheck',
      'Orders: pedido público, precios recalculados, mínimos, estado y validación 1:1',
      'Customers: CRUD, búsqueda e historial de pedidos',
      'Reporting: KPIs de pedidos, estados y stock bajo',
      'Frontend: carrito local, checkout guest, agradecimiento y panel administrativo',
    ],
    deliverable: 'Un visitante compra sin login; el admin ve el pedido nuevo, lo aprueba y consulta métricas. El flujo retail queda cerrado.',
  },
  {
    title: 'S3 · CIERRE Y GO-LIVE',
    dates: '26 OCT – 06 NOV',
    focus: 'Agregar identidad y canal mayorista sin sacrificar el flujo guest ni convertir wholesale en una tienda completa.',
    objective: 'Añadir cuentas opcionales, exponer el canal mayorista por URL privada con WhatsApp y dejar el sistema listo para producción.',
    modules: [
      'Cuentas: registro buyer, login y perfil; guest se conserva y Bearer vincula customer_id',
      'Wholesale informativo: URL privada/no indexada, mínimos, precios y CTA a WhatsApp',
      'Media: carga a S3/R2 para sustituir imágenes temporales',
      'Producción: paginación, CORS allowlist, migraciones y Procfile',
      'Calidad: cobertura en módulos críticos, e2e y documentación de decisiones',
    ],
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
    dates: '01–09 OCT',
    focus: 'Congelar la identidad y dejar las bases físicas listas para imprenta.',
    days: [
      { label: 'Día 1', date: '01 OCT', items: ["Brandkit congelado: paleta cromática oficial (neutros/concreto), jerarquía tipográfica web/redes y Do's & Don'ts.", '⚠️ Prohibida la estética callejera/grafitera.'] },
      { label: 'Día 2', date: '02–05 OCT', items: ['Ficha técnica vectorial en centímetros (ancho de pecho, largo, caída de hombro) sobre silueta vectorial con badge de la tela real.'] },
      { label: 'Día 3', date: '06–08 OCT', urgent: true, items: ['Artes finales vectoriales en curvas para imprenta: sticker SKU/talla para bolsa Ziploc, tarjeta de agradecimiento + guía de cuidado, y etiqueta tejida de cuello.'] },
      { label: 'Día 4', date: '09 OCT', items: ['Plantillas maestras para contenido: layout de carrusel (textura/costuras), guía de tallas e infografías, y paquete de overlays.'] },
    ],
  },
  {
    title: 'S2 · CREATIVOS DE PAUTA (TOFU/MOFU) & CONTENIDO ORGÁNICO BASE',
    dates: '12–23 OCT',
    focus: 'Producir la pauta y la base orgánica del feed.',
    days: [
      { label: 'Día 5', date: '12–15 OCT', items: ['4 variaciones gráficas de pauta: calidad/densidad del textil, comparativa Boxy/Drop-shoulder vs camiseta, Packs x3 + envío gratis, y pruebas de durabilidad/GRWM.'] },
      { label: 'Día 6', date: '16–20 OCT', items: ['5 piezas piloto (2 videos + 3 publicaciones) sobre la grilla base para estructurar el feed inicial (Manifiesto, Tallas, Packs).'] },
      { label: 'Día 7', date: '21–23 OCT', items: ['Tratamiento de color (color grading) en fotos/videos manteniendo estética de concreto/neutros, y entrega de carpeta final de creativos.'] },
    ],
  },
  {
    title: 'S3 · ASSETS WEB B2C, TESTEO DE PAUTA & RETARGETING',
    dates: '26 OCT – 06 NOV',
    focus: 'Assets de la tienda y artes de retargeting.',
    days: [
      { label: 'Día 8', date: '26–29 OCT', items: ['Hero banner principal, banner de oferta Pack x3 y acceso/card B2B discreto ("¿Compras al por mayor? Cotiza aquí") que desvía a WhatsApp.'] },
      { label: 'Día 9', date: '30 OCT – 03 NOV', items: ['Corrección gráfica en vivo sobre la web en móvil: fuentes, márgenes de fotos y legibilidad de la tabla de tallas.'] },
      { label: 'Día 10', date: '04–06 NOV', items: ['Ad retargeting cuadrado (producto + copy de carrito abandonado) y ad vertical para Stories/Reels con badge "Pago contra entrega".'] },
    ],
  },
];

/* ─────────────────── CREACIÓN DE CONTENIDO: UNA SESIÓN AL MES ─────────────────── */

export const contentMeta = {
  cadence: 'Una sesión de graduación al mes',
  perSession: 'Cierre de pieza del mes: guion, rodaje, edición y publicación en el mismo mes',
  start: '1 OCT',
  emphasis: 'Octubre es el mes de la pauta publicitaria',
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
  PAUTA: 'Pauta',
};

/**
 * El pilar PAUTA es nuevo y es el emphasis de octubre. No estaba en la lista
 * porque las ideas de pauta vivían mezcladas con las orgánicas; separarlas hace
 * que el mes se lea solo: "este mes el trabajo es pauta".
 */
const CONTENT_PLAN: Array<{ theme: string; focus: string; pieces: Array<[Pillar, string]> }> = [
  {
    theme: 'PAUTA: campaña de lanzamiento',
    focus: 'Octubre arranca con lo que se vende: cuatro avisos y el catálogo. El orgánico acompaña, no manda.',
    pieces: [
      ['PAUTA', 'Aviso 1 · Anuncio de catálogo DPA con las prendas que más rotan'],
      ['PAUTA', 'Aviso 2 · Animated GIF del encuadre de catálogo (portada ↔ detalle)'],
      ['PAUTA', 'Aviso 3 · Carousel deAdvantage+ con tallas, tejido y precio'],
      ['PAUTA', 'Aviso 4 · Copy de venta directa: una prenda, tres Homeless, un precio'],
      ['COMUNIDAD', 'Manifiesto Wundeer: por qué hacemos ropa que se siente'],
      ['TEXTIL', 'La densidad del textil explicada en 15 segundos'],
    ],
  },
  {
    theme: 'PAUTA: prueba y objection handling',
    focus: 'El mes que la gente pregunta: talla, envío y si la prenda dura. La pauta responde, el orgánico enseña.',
    pieces: [
      ['PAUTA', 'Anuncio de video contra las 3 objeciones: no tengo talla, no llega, no es como la foto'],
      ['PAUTA', 'Retargeting de carrito abandonado: una prenda, un postal, una fecha'],
      ['TALLAS', 'Guía de tallas en 20 segundos, con la tabla en pantalla'],
      ['CORTE', 'Qué es el corte Boxy y por qué cambia todo'],
      ['CUIDADO', 'Guía rápida de cuidado para que dure años'],
      ['TEXTIL', 'Costura plana explicada en un primer plano'],
    ],
  },
  {
    theme: 'PAUTA: escala y retargeting',
    focus: 'Ya hay datos de septiembre: se sube presupuesto a lo que convierte y se retira lo que no.',
    pieces: [
      ['PAUTA', 'Escala del mejor creativo de octubre con el mismo copy'],
      ['PAUTA', 'Retargeting de video con la prenda puesta, no en maniquí'],
      ['GRWM', 'GRWM: cómo se ve la prenda puesta'],
      ['PACKS', 'Packs x3 + envío gratis, con el ahorro a la vista'],
      ['COMUNIDAD', 'Las primeras reseñas reales, sin editar el texto'],
      ['TALLAS', 'FAQ de tallas: lo que más preguntan'],
    ],
  },
  {
    theme: 'Pauta: temporada y reposición',
    focus: 'Toca reponer lo que se agotó en octubre y bajar la pauta de lo que lleva 3 semanas sin vender.',
    pieces: [
      ['PAUTA', 'Anuncio de reposición: lo que volvió de la talla agotada'],
      ['PAUTA', 'Campaña de fin de mes con el inventario real, sin prometer stock falso'],
      ['CORTE', 'Comparativa: Boxy vs camiseta convencional'],
      ['TEXTIL', 'Gramaje y caída: cómo se siente al tacto'],
      ['COMUNIDAD', '7 días, 7 looks con la misma prenda'],
      ['PACKS', 'Guía de regalo: para quién es cada pack'],
    ],
  },
  {
    theme: 'Cierre de ciclo y siguiente pauta',
    focus: 'Se cierra el trimestre: qué creative/entregó, qué se retira y qué entra en el plan del mes siguiente.',
    pieces: [
      ['PAUTA', 'Resumen de pauta del trimestre: qué se creó y por qué se cayó'],
      ['PAUTA', 'Guion de los tres avisos nuevos del mes que viene'],
      ['TALLAS', 'Lo más visto del trimestre'],
      ['GRWM', 'Styling de fin de año'],
      ['COMUNIDAD', 'Gracias comunidad'],
      ['COMUNIDAD', 'Testimonio del trimestre'],
    ],
  },
];

/**
 * Genera las sesiones mensuales desde `ROADMAP_START_ISO`.
 *
 * La sesión cae el PRIMER JUEVES de cada mes, que es el día del arranque: el 1
 * de octubre de 2026 es jueves, y el 5 de noviembre también. El cierre es el
 * último día del mes. Todo se deriva de la fecha, no está escrito a mano: por eso
 * cambiar `ROADMAP_START_ISO` mueve el plan entero sin tocar nada más.
 */
export const contentRoadmap: ContentSession[] = (() => {
  const inicio = fromIso(ROADMAP_START_ISO);
  return CONTENT_PLAN.map((plan, i) => {
    const mes = new Date(inicio.getFullYear(), inicio.getMonth() + i, 1);
    // Primer jueves del mes: `getDay()` de jueves es 4.
    const dia = mes.getDay() <= 4 ? 1 + (4 - mes.getDay()) : 1 + (11 - mes.getDay());
    const sesion = new Date(mes.getFullYear(), mes.getMonth(), dia);
    const ultimo = new Date(mes.getFullYear(), mes.getMonth() + 1, 0);
    return {
      month: i + 1,
      sessionIso: toIso(sesion),
      sessionLabel: formatEs(sesion),
      monthLabel: `${MONTH_NAMES[mes.getMonth()]} ${mes.getFullYear()}`,
      theme: plan.theme,
      focus: plan.focus,
      closeIso: toIso(ultimo),
      pieces: plan.pieces.map(([pillar, topic]) => ({ pillar, topic })),
      pauta: plan.pieces.filter(([pillar]) => pillar === 'PAUTA').length,
    };
  });
})();

/** Los meses del plan, agrupados para una línea de tiempo compacta. */
export const contentMonths = contentRoadmap.map((session) => ({
  monthLabel: session.monthLabel,
  sessions: [session],
}));

/* ─────────────────── ANCLAS ISO: DÓNDE ESTAMOS HOY ─────────────────── */

export const devWindows: TrackWindow[] = [
  { title: 'S1 · LANDING BÁSICA', startIso: '2026-10-01', endIso: '2026-10-09' },
  { title: 'S2 · ADMIN ROBUSTO + RETAIL SIN LOGIN', startIso: '2026-10-12', endIso: '2026-10-23' },
  { title: 'S3 · CIERRE Y GO-LIVE', startIso: '2026-10-26', endIso: '2026-11-06' },
];

export const designWindows: TrackWindow[] = [
  { title: 'S1 · CIMIENTOS VISUALES, FICHA TÉCNICA Y PREPRENSA', startIso: '2026-10-01', endIso: '2026-10-09' },
  { title: 'S2 · CREATIVOS DE PAUTA Y CONTENIDO ORGÁNICO BASE', startIso: '2026-10-12', endIso: '2026-10-23' },
  { title: 'S3 · ASSETS WEB B2C, TESTEO DE PAUTA Y RETARGETING', startIso: '2026-10-26', endIso: '2026-11-06' },
];

/** La sesión de graduación de cada mes, para pintar el calendario. */
export const sessionWindows: TrackWindow[] = contentRoadmap.map((session) => ({
  title: `SESIÓN ${session.month} · ${session.theme}`,
  startIso: session.sessionIso,
  endIso: session.closeIso,
}));

/* ─────────────────────────── CÁLCULO ─────────────────────────── */

/** La fecha de hoy en ISO, en módulo y no dentro de un componente (React 19). */
export function todayIso(): string {
  const now = new Date();
  return toIso(now);
}

export function daysBetween(fromIsoValue: string, toIsoValue: string): number {
  return Math.round((Date.parse(`${toIsoValue}T00:00:00Z`) - Date.parse(`${fromIsoValue}T00:00:00Z`)) / 86_400_000);
}

export function daysUntil(targetIso: string, today: string): number {
  return daysBetween(today, targetIso);
}

/** Cuánto lleva avanzado un tramo, de 0 a 100. Sirve para las barras. */
export function progressPct(startIsoValue: string, endIsoValue: string, today: string): number {
  const total = daysBetween(startIsoValue, endIsoValue);
  if (total <= 0) return 100;
  return Math.max(0, Math.min(100, Math.round((daysBetween(startIsoValue, today) / total) * 100)));
}

export function windowState(window: TrackWindow, today: string): WindowState {
  if (today > window.endIso) return 'cerrado';
  if (today < window.startIso) return 'pendiente';
  return 'en-curso';
}

/** Cuántos días lleva un tramo abierto, o cuántos faltan para que empiece. */
export function windowGap(window: TrackWindow, today: string): string {
  const state = windowState(window, today);
  if (state === 'en-curso') return `DÍA ${daysBetween(window.startIso, today) + 1} DE ${daysBetween(window.startIso, window.endIso) + 1}`;
  if (state === 'pendiente') return `ABRE EN ${daysBetween(today, window.startIso)} DÍAS`;
  return `CERRADO HACE ${daysBetween(window.endIso, today)} DÍAS`;
}

/** Estado de una sesión mensual: viva desde su sesión, cerrada tras el cierre. */
export function sessionState(session: ContentSession, today: string): WindowState {
  if (today > session.closeIso) return 'cerrado';
  if (today < session.sessionIso) return 'pendiente';
  return 'en-curso';
}

export function daysToClose(session: ContentSession, today: string): number {
  return daysBetween(today, session.closeIso);
}

export function piecesUntilClose(session: ContentSession, today: string): number {
  return session.pieces.length;
}

/** La sesión que toca: la abierta, o la próxima, o la última. */
export function currentSession(today: string): ContentSession | null {
  const activa = contentRoadmap.find((session) => sessionState(session, today) === 'en-curso');
  if (activa) return activa;
  const futuras = contentRoadmap.filter((session) => sessionState(session, today) === 'pendiente');
  if (futuras.length) return futuras[0];
  return contentRoadmap[contentRoadmap.length - 1] ?? null;
}

export function contentProgress(today: string): { done: number; active: number; total: number } {
  const done = contentRoadmap.filter((session) => sessionState(session, today) === 'cerrado').length;
  const active = contentRoadmap.filter((session) => sessionState(session, today) === 'en-curso').length;
  return { done, active, total: contentRoadmap.length };
}

/** Cuántas piezas de pauta tiene cada mes, para ver el emphasis de octubre. */
export function pautaCount(session: ContentSession): number {
  return session.pieces.filter((piece) => piece.pillar === 'PAUTA').length;
}

/* ───────────────── EL PLAN ES DE UN CLIENTE, NO DE TODOS ─────────────────
 *
 * MEDIDO 2026-10-01 (auditoría de experiencia de uso): `/candilejas/roadmap`
 * servía el plan de WUNDEER. La página recibía `params.projectSlug` y no lo
 * usaba, y todo el plan estaba clavado con `designMeta.client = 'WUNDEER'`. El
 * menú muestra la entrada a los dos clientes, así que el equipo de Candilejas
 * veía el plan del otro como si fuera suyo: otras fechas, otra marca, otros
 * entregables.
 *
 * Es la misma clase de fallo que las otras dos: una verdad escrita a mano al
 * lado de la autoridad. Ya pasó con BOARD_COLUMNS, WAITING_STATUSES y la lista
 * PUEDE del perfil.
 *
 * DECISIÓN QUE IMPONE ESTE ARCHIVO: el plan de Candilejas NO se inventa. No hay
 * un plan real suyo en la base, y duplicar el de Wundeer con otro nombre sería
 * fabricar fechas y entregables de alguien. `planDe()` devuelve `null` y la
 * pantalla lo dice. Cuando exista el plan de Candilejas, se agrega aquí y ya.
 */

export type ClienteRoadmap = {
  slug: string;
  nombre: string;
  designMeta: typeof designMeta;
  designRoadmap: Sprint[];
  devMeta: typeof devMeta;
  devRoadmap: Sprint[];
  contentMeta: typeof contentMeta;
  contentRoadmap: ContentSession[];
};

/**
 * El plan de un cliente, o `null` si no tiene.
 *
 * Se busca por slug y el nombre se toma del propio plan, no de la URL: el
 * nombre del cliente lo pone quien escribió el plan.
 */
const PLANES_POR_CLIENTE: Record<string, ClienteRoadmap> = {
  wundeer: {
    slug: 'wundeer',
    nombre: 'WUNDEER',
    designMeta,
    designRoadmap,
    devMeta,
    devRoadmap,
    contentMeta,
    contentRoadmap,
  },
};

export function planDe(slug: string | undefined | null): ClienteRoadmap | null {
  if (!slug) return null;
  return PLANES_POR_CLIENTE[slug] ?? null;
}

/** Los clientes que sí tienen plan escrito. */
export function clientesConPlan(): string[] {
  return Object.keys(PLANES_POR_CLIENTE);
}
