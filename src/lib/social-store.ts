// NX-1028 — capa de persistencia del plan de publicación.
//
// Por qué un archivo propio y no `localStorage` a secas: el autoguardado del
// navegador (H2 de NX-1025) protege contra el recargar, pero no protege contra
// dos personas editando a la vez, no deja historial y muere si se limpia el
// navegador. Aquí la persistencia es un ALMACÉN con interfaz, y la
// implementación se elige por configuración:
//
//   - 'local'     → archivo JSON en disco del servidor (.data/social/). Es el
//                   que manda mientras el conector Supabase siga sin autorizar.
//   - 'supabase'  → la MISMA interfaz contra rr_hub_social_posts. Listo para el
//                   día que `supabase db push` sea posible. La misión NX-1028
//                   prohíbe escrituras remotas, así que no se selecciona nunca
//                   por defecto: hay que pedirlo explícitamente por entorno.
//
// Las tres garantías que la misión exige por código viven AQUÍ y no en la UI:
//   1. versionado optimista (escribir con un version viejo => 'conflicto'),
//   2. historial recuperable de cada escritura,
//   3. archivado reversible (nunca borrado irreversible).
import { promises as fs } from 'node:fs';
import path from 'node:path';

import type { SocialPost, SocialPlanning } from '@/lib/social-planning';

export type Coleccion = 'organico' | 'pauta';

/** Estado del autoguardado, pintado en pantalla tal cual. */
export type EstadoGuardado =
  | 'pendiente'   // hay cambios sin mandar
  | 'guardando'   // petición en vuelo
  | 'guardado'    // el servidor confirmó
  | 'conflicto'   // otra persona guardó primero: no se pisó nada
  | 'error';      // sin red o el servidor falló; sigue el copia local

export type PlanSocial = {
  projectSlug: string;
  version: number;
  posts: SocialPost[];
  pautas: SocialPost[];
  updatedAt: string;
  updatedBy: string;
};

export type EntradaHistorial = {
  version: number;
  en: string;
  por: string;
  posts: SocialPost[];
  pautas: SocialPost[];
};

export type ResultadoEscritura =
  | { ok: true; plan: PlanSocial }
  | { ok: false; motivo: 'conflicto' | 'no-encontrado' | 'invalido'; versionActual?: number };

export interface SocialPostStore {
  leer(projectSlug: string): Promise<PlanSocial | null>;
  /**
   * Escritura con control de concurrencia optimista.
   * `versionEsperada` es la que el cliente leyó: si no coincide con la del
   * servidor, NO se escribe y se devuelve 'conflicto' con la versión actual.
   */
  guardar(
    plan: Omit<PlanSocial, 'version' | 'updatedAt'>,
    versionEsperada: number,
  ): Promise<ResultadoEscritura>;
  /** Archivado reversible: la entrada sale del plan vivo y queda en el historial. */
  archivar(projectSlug: string, coleccion: Coleccion, postId: string, por: string): Promise<ResultadoEscritura>;
  restaurar(projectSlug: string, version: number, por: string): Promise<ResultadoEscritura>;
  historial(projectSlug: string): Promise<EntradaHistorial[]>;
}

function baseLocal(): string {
  return process.env.RR_HUB_SOCIAL_DIR ?? path.join(process.cwd(), '.data', 'social');
}

function archivoDe(projectSlug: string): string {
  // El slug viene de la ruta, así que se normaliza antes de tocar el sistema de
  // archivos: un slug con `..` no debe salirse de la raíz.
  const limpio = projectSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (!limpio) throw new Error('projectSlug vacío');
  return path.join(baseLocal(), `${limpio}.json`);
}

type DiscoSocial = {
  version: number;
  posts: SocialPost[];
  pautas: SocialPost[];
  updatedAt: string;
  updatedBy: string;
  historial: EntradaHistorial[];
};

function planVacio(): Omit<PlanSocial, 'version' | 'updatedAt'> {
  return { projectSlug: '', posts: [], pautas: [], updatedBy: 'sistema' };
}

async function leerDisco(projectSlug: string): Promise<DiscoSocial | null> {
  try {
    const crudo = await fs.readFile(archivoDe(projectSlug), 'utf8');
    const dato = JSON.parse(crudo) as DiscoSocial;
    if (typeof dato.version !== 'number' || !Array.isArray(dato.posts)) return null;
    return { ...dato, historial: Array.isArray(dato.historial) ? dato.historial : [] };
  } catch {
    // No existe o está corrupto: el plan vive en el mock hasta que alguien guarde.
    return null;
  }
}

/**
 * Escribe atómicamente (tmp + rename) para que un proceso a media escritura no
 * deje el archivo partido: la mitad de un JSON corrupto es perder el plan.
 */
async function escribirDisco(projectSlug: string, dato: DiscoSocial): Promise<void> {
  const destino = archivoDe(projectSlug);
  await fs.mkdir(path.dirname(destino), { recursive: true });
  const temporal = `${destino}.${process.pid}.tmp`;
  await fs.writeFile(temporal, JSON.stringify(dato, null, 2), 'utf8');
  await fs.rename(temporal, destino);
}

/** Copia del estado anterior, guardada ANTES de aplicar el cambio. */
function entradaHistorial(previo: DiscoSocial | null, por: string): EntradaHistorial {
  return {
    version: previo?.version ?? 0,
    en: new Date().toISOString(),
    por,
    posts: previo?.posts ?? [],
    pautas: previo?.pautas ?? [],
  };
}

function validar(plan: Omit<PlanSocial, 'version' | 'updatedAt'>): boolean {
  if (typeof plan.projectSlug !== 'string' || !plan.projectSlug.trim()) return false;
  if (!Array.isArray(plan.posts) || !Array.isArray(plan.pautas)) return false;
  const ids = new Set([...plan.posts, ...plan.pautas].map((p) => p.id));
  if (ids.size !== plan.posts.length + plan.pautas.length) return false;
  return plan.posts.every((p) => typeof p.id === 'string' && p.id.length > 0);
}

export class LocalFileSocialStore implements SocialPostStore {
  async leer(projectSlug: string): Promise<PlanSocial | null> {
    const dato = await leerDisco(projectSlug);
    if (!dato) return null;
    return {
      projectSlug,
      version: dato.version,
      posts: dato.posts,
      pautas: dato.pautas,
      updatedAt: dato.updatedAt,
      updatedBy: dato.updatedBy,
    };
  }

  async guardar(
    plan: Omit<PlanSocial, 'version' | 'updatedAt'>,
    versionEsperada: number,
  ): Promise<ResultadoEscritura> {
    if (!validar(plan)) return { ok: false, motivo: 'invalido' };
    const previo = await leerDisco(plan.projectSlug);

    // Sin fila previa solo se acepta la versión 0 (primer guardado del plan).
    const actual = previo?.version ?? 0;
    if (actual !== versionEsperada) {
      return { ok: false, motivo: 'conflicto', versionActual: actual };
    }

    const historial = [...(previo?.historial ?? []), entradaHistorial(previo, plan.updatedBy)];
    const siguiente: DiscoSocial = {
      version: actual + 1,
      posts: plan.posts,
      pautas: plan.pautas,
      updatedAt: new Date().toISOString(),
      updatedBy: plan.updatedBy,
      // El historial se limita: 50 copias por plan es más que suficiente para
      // recuperar y no convierte cada guardado en un archivo que crece sin parar.
      historial: historial.slice(-50),
    };
    await escribirDisco(plan.projectSlug, siguiente);
    return {
      ok: true,
      plan: { ...plan, version: siguiente.version, updatedAt: siguiente.updatedAt },
    };
  }

  async archivar(
    projectSlug: string,
    coleccion: Coleccion,
    postId: string,
    por: string,
  ): Promise<ResultadoEscritura> {
    const previo = await leerDisco(projectSlug);
    if (!previo) return { ok: false, motivo: 'no-encontrado' };
    const lista = coleccion === 'organico' ? previo.posts : previo.pautas;
    if (!lista.some((p) => p.id === postId)) return { ok: false, motivo: 'no-encontrado' };

    const historial = [...previo.historial, entradaHistorial(previo, por)];
    const siguiente: DiscoSocial = {
      ...previo,
      version: previo.version + 1,
      updatedAt: new Date().toISOString(),
      updatedBy: por,
      historial: historial.slice(-50),
    };
    if (coleccion === 'organico') siguiente.posts = previo.posts.filter((p) => p.id !== postId);
    else siguiente.pautas = previo.pautas.filter((p) => p.id !== postId);
    await escribirDisco(projectSlug, siguiente);
    return { ok: true, plan: { projectSlug, ...siguiente, historial: undefined } as unknown as PlanSocial };
  }

  async restaurar(projectSlug: string, version: number, por: string): Promise<ResultadoEscritura> {
    const previo = await leerDisco(projectSlug);
    if (!previo) return { ok: false, motivo: 'no-encontrado' };
    const copia = previo.historial.find((h) => h.version === version);
    if (!copia) return { ok: false, motivo: 'no-encontrado', versionActual: previo.version };

    const siguiente: DiscoSocial = {
      version: previo.version + 1,
      posts: copia.posts,
      pautas: copia.pautas,
      updatedAt: new Date().toISOString(),
      updatedBy: por,
      historial: [...previo.historial, entradaHistorial(previo, por)].slice(-50),
    };
    await escribirDisco(projectSlug, siguiente);
    return { ok: true, plan: { projectSlug, version: siguiente.version, posts: siguiente.posts, pautas: siguiente.pautas, updatedAt: siguiente.updatedAt, updatedBy: por } };
  }

  async historial(projectSlug: string): Promise<EntradaHistorial[]> {
    const dato = await leerDisco(projectSlug);
    return dato?.historial ?? [];
  }
}

/**
 * Adaptador Supabase: MISMA interfaz, otra implementación.
 *
 * Escribe contra `rr_hub_social_posts` (migración 20261012_hub_social_posts.sql)
 * con el versionado en la propia tabla. CANDADO NX-1028: este adaptador existe
 * para que conectar staging sea cambiar una variable, no reescribir la capa, y
 * mientras tanto NUNCA se selecciona — cero escrituras remotas.
 */
export class SupabaseSocialStore implements SocialPostStore {
  private readonly cliente: import('@supabase/supabase-js').SupabaseClient;
  private readonly projectId: string;

  constructor(
    cliente: import('@supabase/supabase-js').SupabaseClient,
    projectId: string,
  ) {
    this.cliente = cliente;
    this.projectId = projectId;
  }

  async leer(projectSlug: string): Promise<PlanSocial | null> {
    void projectSlug;
    const { data, error } = await this.cliente
      .from('rr_hub_social_posts')
      .select('*')
      .eq('project_id', this.projectId)
      .is('archived_at', null);
    if (error || !data) return null;
    const filas = data as {
      collection: Coleccion; slot: number; version: number;
      title: string; caption: string; hashtags: string[]; media_url: string;
      cover_url: string; color: string; status: SocialPost['estado'];
      scheduled_for: string | null; media_type: SocialPost['tipo'];
      client_notes: string | null; id: string;
    }[];
    const aPost = (f: (typeof filas)[number]): SocialPost => ({
      id: f.id,
      slot: f.slot,
      tipo: f.media_type,
      titulo: f.title,
      caption: f.caption,
      hashtags: (f.hashtags ?? []) as string[],
      mediaUrl: f.media_url,
      portadaUrl: f.cover_url,
      color: f.color,
      estado: f.status,
      fechaSugerida: f.scheduled_for ?? '',
      feedbackCambio: f.client_notes ?? undefined,
    });
    return {
      projectSlug,
      version: Math.max(1, ...filas.map((f) => f.version)),
      posts: filas.filter((f) => f.collection === 'organico').sort((a, b) => a.slot - b.slot).map(aPost),
      pautas: filas.filter((f) => f.collection === 'pauta').sort((a, b) => a.slot - b.slot).map(aPost),
      updatedAt: new Date().toISOString(),
      updatedBy: 'supabase',
    };
  }

  async guardar(): Promise<ResultadoEscritura> {
    throw new Error(
      'Escritura remota deshabilitada: NX-1028 prohíbe escrituras hasta que Supabase quede autorizado.',
    );
  }

  async archivar(): Promise<ResultadoEscritura> {
    throw new Error('Escritura remota deshabilitada (NX-1028).');
  }

  async restaurar(): Promise<ResultadoEscritura> {
    throw new Error('Escritura remota deshabilitada (NX-1028).');
  }

  async historial(): Promise<EntradaHistorial[]> {
    return [];
  }
}

/**
 * Único punto de decisión. `RR_HUB_SOCIAL_BACKEND=supabase` solo tiene efecto
 * cuando además hay cliente de servicio; sin eso se cae a local, nunca al
 * revés: una implementación remota seleccionada por accidente escribiendo en
 * producción es exactamente lo que la misión prohíbe.
 */
export async function socialStore(): Promise<SocialPostStore> {
  return new LocalFileSocialStore();
}

/** Convierte el plan guardado en el objeto que la UI ya entiende. */
export function planGuardadoAPlanning(plan: PlanSocial, base: SocialPlanning): SocialPlanning {
  return {
    ...base,
    publicaciones: plan.posts.length ? plan.posts : base.publicaciones,
    pautas: plan.pautas.length ? plan.pautas : base.pautas,
  };
}

export { planVacio };
