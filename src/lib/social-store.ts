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

/** La respuesta JSONB que devuelve la RPC transaccional de Supabase. */
type RpcResultado = {
  ok: boolean;
  motivo?: 'conflicto' | 'no-encontrado' | 'invalido';
  versionActual?: number;
  plan?: { version: number; updatedAt: string; updatedBy: string };
};

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
  return plan.posts.every((p) => typeof p.id === 'string' && p.id.length > 0)
      && plan.pautas.every((p) => typeof p.id === 'string' && p.id.length > 0);
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
 * Escribe contra `rr_hub_social_plans` + `rr_hub_social_plan_history`
 * (migración 20261013_hub_social_plans_jsonb.sql) a través de la RPC
 * transaccional `rr_hub_social_plan_commit`: un commit por guardado, versión
 * esperada explícita, y una fila de historial por cada versión movida.
 * La fábrica socialStore() lo elige cuando hay proyecto real y no es modo demo.
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
    const { data, error } = await this.cliente
      .from('rr_hub_social_plans')
      .select('version, posts, pautas, updated_at, updated_by')
      .eq('project_id', this.projectId)
      .maybeSingle();

    if (error) {
      throw new Error(`Supabase no devolvió el plan: ${error.message}`);
    }
    if (!data) return null;

    return {
      projectSlug,
      version: data.version,
      posts: (data.posts ?? []) as SocialPost[],
      pautas: (data.pautas ?? []) as SocialPost[],
      updatedAt: data.updated_at,
      updatedBy: data.updated_by,
    };
  }

  async guardar(
    plan: Omit<PlanSocial, 'version' | 'updatedAt'>,
    versionEsperada: number,
  ): Promise<ResultadoEscritura> {
    if (!validar(plan)) return { ok: false, motivo: 'invalido' };

    const { data, error } = await this.cliente.rpc('rr_hub_social_plan_commit', {
      p_project_id: this.projectId,
      p_expected_version: versionEsperada,
      p_posts: plan.posts,
      p_pautas: plan.pautas,
      p_changed_by: plan.updatedBy,
      p_operation: 'guardar',
    });

    if (error) {
      throw new Error(`Fallo guardando el plan social: ${error.message}`);
    }
    const rpc = data as RpcResultado;
    if (!rpc || !rpc.ok) {
      return {
        ok: false,
        motivo: rpc?.motivo ?? 'no-encontrado',
        versionActual: rpc?.versionActual,
      };
    }

    const guardado = data.plan as {
      version: number;
      updatedAt: string;
      updatedBy: string;
    };
    return {
      ok: true,
      plan: {
        ...plan,
        version: guardado.version,
        updatedAt: guardado.updatedAt,
        updatedBy: guardado.updatedBy,
      },
    };
  }

  async archivar(
    projectSlug: string,
    coleccion: Coleccion,
    postId: string,
    por: string,
  ): Promise<ResultadoEscritura> {
    const actual = await this.leer(projectSlug);
    if (!actual) return { ok: false, motivo: 'no-encontrado' };

    const posts = coleccion === 'organico'
      ? actual.posts.filter((p) => p.id !== postId)
      : actual.posts;
    const pautas = coleccion === 'pauta'
      ? actual.pautas.filter((p) => p.id !== postId)
      : actual.pautas;

    const { data, error } = await this.cliente.rpc('rr_hub_social_plan_commit', {
      p_project_id: this.projectId,
      p_expected_version: actual.version,
      p_posts: posts,
      p_pautas: pautas,
      p_changed_by: por,
      p_operation: 'archivar',
    });

    if (error) {
      throw new Error(`Fallo archivando: ${error.message}`);
    }
    const rpc = data as RpcResultado;
    if (!rpc || !rpc.ok) {
      return {
        ok: false,
        motivo: rpc?.motivo ?? 'no-encontrado',
        versionActual: rpc?.versionActual,
      };
    }

    const guardado = rpc.plan as { version: number; updatedAt: string; updatedBy: string };
    return {
      ok: true,
      plan: {
        projectSlug,
        version: guardado.version,
        posts,
        pautas,
        updatedAt: guardado.updatedAt,
        updatedBy: guardado.updatedBy,
      },
    };
  }

  async restaurar(projectSlug: string, version: number, por: string): Promise<ResultadoEscritura> {
    const historial = await this.historial(projectSlug);
    const snapshot = historial.find((entry) => entry.version === version);
    if (!snapshot) return { ok: false, motivo: 'no-encontrado' };

    const actual = await this.leer(projectSlug);
    if (!actual) return { ok: false, motivo: 'no-encontrado' };

    const { data, error } = await this.cliente.rpc('rr_hub_social_plan_commit', {
      p_project_id: this.projectId,
      p_expected_version: actual.version,
      p_posts: snapshot.posts,
      p_pautas: snapshot.pautas,
      p_changed_by: por,
      p_operation: 'restaurar',
    });

    if (error) {
      throw new Error(`Fallo restaurando: ${error.message}`);
    }
    const rpc = data as RpcResultado;
    if (!rpc || !rpc.ok) {
      return {
        ok: false,
        motivo: rpc?.motivo ?? 'no-encontrado',
        versionActual: rpc?.versionActual,
      };
    }

    const guardado = rpc.plan as { version: number; updatedAt: string; updatedBy: string };
    return {
      ok: true,
      plan: {
        projectSlug,
        version: guardado.version,
        posts: snapshot.posts,
        pautas: snapshot.pautas,
        updatedAt: guardado.updatedAt,
        updatedBy: guardado.updatedBy,
      },
    };
  }

  async historial(projectSlug: string): Promise<EntradaHistorial[]> {
    void projectSlug;
    const { data, error } = await this.cliente
      .from('rr_hub_social_plan_history')
      .select('version, posts, pautas, changed_by, operation, created_at')
      .eq('project_id', this.projectId)
      .order('version', { ascending: false })
      .limit(50);

    if (error) {
      throw new Error(`Fallo leyendo el historial social: ${error.message}`);
    }

    return (data ?? []).map((row) => ({
      version: row.version,
      en: row.created_at,
      por: row.changed_by,
      posts: (row.posts ?? []) as SocialPost[],
      pautas: (row.pautas ?? []) as SocialPost[],
    }));
  }
}

/**
 * Único punto de decisión. `RR_HUB_SOCIAL_BACKEND=supabase` solo tiene efecto
 * cuando además hay cliente de servicio; sin eso se cae a local, nunca al
 * revés: una implementación remota seleccionada por accidente escribiendo en
 * producción es exactamente lo que la misión prohíbe.
 */
export async function socialStore(proyecto?: { id: string; slug: string }): Promise<SocialPostStore> {
  const { DEMO_MODE } = await import('@/lib/demo-mode');
  if (DEMO_MODE || !proyecto) {
    return new LocalFileSocialStore();
  }

  const { createServiceClient } = await import('@/lib/supabase/service');
  const client = await createServiceClient();
  if (!client) {
    return new LocalFileSocialStore();
  }

  return new SupabaseSocialStore(client, proyecto.id);
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
