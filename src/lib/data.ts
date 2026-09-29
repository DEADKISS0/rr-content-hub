import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { quienEs } from '@/lib/quien-es';
import { DEMO_MODE, SupabaseNotConfiguredError } from './demo-mode';
import { demoIdeas, demoProjects, getDemoIdea, getDemoProject } from './demo-data';
import { clienteEsVisible, isVisibleProject } from './projects';

/**
 * Data access layer for the RR Content Hub.
 *
 * The hub lives in the same Supabase project as other RR tools, so every table
 * it owns is prefixed `rr_hub_`. These helpers never read the legacy CRM tables.
 *
 * LEE CON LA CLAVE DEL SERVIDOR, y no con la `anon`. No es un descuido ni una
 * comodidad: desde que la puerta es un código por cliente ya no hay sesión de
 * Supabase, así que `auth.uid()` devuelve NULL y el RLS deja pasar a nadie. Un
 * lector anónimo aquí devolvía cero filas en todas partes, y eso se veía como
 * "el tablero está vacío" y "no tienes permiso", nunca como "el RLS está
 * cerrado". Con la clave del servidor el RLS no estorba, y lo que decide quién
 * entra y qué puede hacer es el guard (`project-guard.ts`), que sí sabe quién
 * es porque recibe la cookie firmada.
 *
 * Missing Supabase config used to degrade to demo fixtures. It no longer does:
 * a missing database is a configuration error, and answering it with invented
 * content plus an `admin` role hid real outages. Set `NEXT_PUBLIC_HUB_DEMO=true`
 * to work on the UI without credentials.
 */

/**
 * Called where a missing database used to silently return demo content. In demo
 * mode it yields `null` so the caller's `if (!supabase)` branch still runs; in
 * anything else it throws, because a wrong answer hidden behind a 200 is worse
 * than a visible failure.
 *
 * Returns `true` (not `null`) so `if (requireSupabase()) return fixtures` reads
 * correctly and TypeScript narrows `supabase` to non-null past the guard.
 */
function requireSupabase(): true {
  if (DEMO_MODE) return true;
  throw new SupabaseNotConfiguredError();
}

type RawIdea = Record<string, unknown>;

/**
 * This was the single worst bug in the app: `getIdeas` filtered to four
 * ideation states AND required a non-empty `reference_urls`, but nothing in the
 * write path ever guaranteed a reference. A piece saved without one became
 * invisible the moment it was stored — and because the same filter gated the
 * read, the production and publication queues (which look for `editing`,
 * `published`, …) could never return anything at all.
 *
 * Reads are now unfiltered: the workflow engine (`flow.ts`) is the authority on
 * which states exist, and each queue page already filters for itself.
 */
function mapIdea(row: RawIdea) {
  const urls = Array.isArray(row.reference_urls) ? (row.reference_urls as string[]) : [];
  return {
    id: row.id as string,
    code: (row.code as string) ?? 'IDEA',
    title: row.title as string,
    description: (row.description as string) ?? '',
    objective: (row.objective as string) ?? '',
    content_type: row.content_type as 'organic' | 'paid',
    category: (row.category as string) ?? 'General',
    status: row.status as string,
    priority: row.priority as 'high' | 'normal',
    creator: 'RR ALIADOS',
    created_at: row.created_at as string,
    reference_url: urls[0] ?? (row.reference_url as string) ?? '',
    reference_urls: urls,
    /**
     * Portada real de la pieza: el asset `reference_brief` elegido, resuelto por
     * `rr_hub_idea_cover()`. Viene anidado con la relación de la columna
     * `cover_asset_id` (migración 20260928_hub_idea_cover), no con un join por
     * fecha: la columna es la elección explícita y no se recalcula en cada
     * lectura. Es `null` cuando la idea no tiene brief, y ahí la tarjeta vuelve
     * a su portada de marca.
     *
     * `storage_path` no se pide: es una ruta del bucket privado y la app no la
     * puede abrir sin que el servidor la firme. Solo el `external_url` público
     * sirve para pintar.
     */
    cover_asset: Array.isArray(row.cover_asset) ? row.cover_asset[0] ?? null : row.cover_asset ?? null,
    camera: (row.camera_brief as string) ?? '',
    talent: (row.talent_brief as string) ?? '',
    edit: (row.edit_brief as string) ?? '',
    script_content: (row.script_content as string) ?? '',
  };
}

export async function getCurrentUser() {
  const supabase = await createServiceClient() ?? await createClient();
  if (!supabase) return { user: null, supabase: null };

  // Desde el 2026-09-28 la puerta es un código por cliente, así que la identidad
  // viene de la cookie firmada del hub. Antes venía de `supabase.auth.getUser()`,
  // que era una ida a la red en cada carga de página; ahora es leer la cookie.
  //
  // La forma es la misma (`user` con `email`), porque quien usa esta función
  // solo necesita saber quién es, no tener una sesión de Supabase.
  const sesion = await quienEs();
  if (!sesion) return { user: null, supabase };

  const { data: perfil } = await supabase
    .from('rr_hub_profiles')
    .select('id, full_name, email, global_role')
    .ilike('email', sesion.email)
    .maybeSingle();
  if (!perfil) return { user: null, supabase };

  return { user: { id: perfil.id, email: perfil.email, name: sesion.nombre }, supabase };
}

export async function getProject(slug: string) {
  if (!isVisibleProject(slug)) return { project: null, access: null, supabase: null };

  // Y tiene que ser el cliente del código con el que se entró. Sin esta línea,
  // entrar con 1111 y escribir `/candilejas` a mano abriría el otro cliente: la
  // URL decidiría a qué proyecto se entra, y la cookie solo comprobaría que hay
  // alguna. La cookie manda porque el código es lo que se tecleó.
  const sesion = await quienEs();
  if (!sesion || !clienteEsVisible(slug, sesion.proyecto)) {
    return { project: null, access: null, supabase: null };
  }
  const supabase = await createServiceClient() ?? await createClient();
  if (!supabase) {
    // Was `admin` — the role that bypasses every transition rule in flow.ts.
    return { project: null, access: null, supabase: null };
  }

  const { data: project } = await supabase
    .from('rr_hub_projects')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (!project) return { project: null, access: null, supabase };

  // El `sesion` de arriba ya es el bueno: si no hubiera, `getProject` ya habría
  // devuelto null. Así que aquí no se vuelve a preguntar.
  // Se busca por correo en vez de por `user_id`: es la misma fila, y no depende
  // de que exista una sesión de Supabase de la que sacar el id.
  // El cruce es por `user_id`, y se resuelve en memoria: `rr_hub_access.user_id`
  // tiene FK a `auth.users`, `rr_hub_profiles.id` es su propia PK, y ENTRE LAS DOS
  // NO HAY FK (medido el 2026-09-29 en `pg_constraint`). El embed
  // `user:rr_hub_profiles!inner(email)` que estaba aquí devolvía
  // `400 PGRST200` con `data: null` **sin lanzar excepción** — el mismo fallo que
  // dejó a todo el equipo en `sin_rol` en `project-guard.ts`.
  //
  // Aquí el síntoma era distinto y peor: al no encontrar la fila, la función
  // caía al atajo de `global_role === 'admin'` y daba `owner` a un admin global
  // en un proyecto donde nunca tuvo fila de acceso. Un fallo de consulta
  // traduciéndose en más permisos, no en menos.
  const [acceso, perfiles] = await Promise.all([
    supabase.from('rr_hub_access').select('user_id, role_in_project').eq('project_id', project.id),
    supabase.from('rr_hub_profiles').select('id, email'),
  ]);

  const idDeEsta = ((perfiles.data ?? []) as { id: string; email: string }[]).find(
    (fila) => fila.email?.toLowerCase() === sesion.email.toLowerCase(),
  )?.id;
  const filaDeEsta = (acceso.data ?? []).find((fila) => fila.user_id === idDeEsta) as
    | { role_in_project: string }
    | undefined;
  const access = filaDeEsta ? { role_in_project: filaDeEsta.role_in_project } : null;

  if (access) return { project, access, supabase };

  // Global admins supervise every project even without an explicit access row.
  // El admin global es `owner` en todos los clientes. Se busca por correo: es la
  // misma fila y no depende de una sesión de Supabase para el id.
  const { data: profile } = await supabase
    .from('rr_hub_profiles')
    .select('global_role')
    .ilike('email', sesion.email)
    .maybeSingle();
  if (profile?.global_role === 'admin') return { project, access: { role_in_project: 'owner' }, supabase };

  return { project, access, supabase };
}

/**
 * El nombre de una persona del equipo, por id.
 *
 * Se usa para el responsable de una pieza (`rr_hub_ideas.created_by`). Devuelve
 * `null` y no un texto de reserva cuando no encuentra a nadie: la ficha tiene que
 * poder decir "sin responsable" en voz alta. Un nombre inventado es peor que un
 * hueco, porque nadie se da cuenta del hueco.
 */
export async function getProfileName(userId: string): Promise<{ full_name: string; email: string | null } | null> {
  const supabase = await createServiceClient() ?? await createClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from('rr_hub_profiles')
    .select('full_name, email')
    .eq('id', userId)
    .maybeSingle();
  if (!data) return null;
  const nombre = (data.full_name as string) || (data.email as string) || null;
  if (!nombre) return null;
  return { full_name: nombre, email: (data.email as string) ?? null };
}

export async function getProjects() {
  const supabase = await createServiceClient() ?? await createClient();
  if (!supabase) {
    // No `admin` role for a missing database. See requireSupabase().
    return { projects: [], supabase: null };
  }

  const sesion = await quienEs();

  // Sin cookie, la portada se ve pero no se listan clientes con código: entrar
  // es lo que enseña qué hay. Antes listaba solo Wundeer en abierto; ahora la
  // lista la da la cookie.
  if (!sesion) return { projects: [], supabase };

  // Global admins supervisan every project even without an explicit access row.
  // Se busca por correo: es la misma fila, y el id ya no viene de una sesión
  // de Supabase.
  const { data: profile } = await supabase
    .from('rr_hub_profiles')
    .select('id, global_role')
    .ilike('email', sesion.email)
    .maybeSingle();
  if (profile?.global_role === 'admin') {
    const { data: allProjects } = await supabase
      .from('rr_hub_projects')
      .select('id, name, slug, client_name, brand_primary_color, description')
      .eq('slug', sesion.proyecto).order('name');
    return {
      projects: (allProjects ?? []).filter((project) => clienteEsVisible(project.slug, sesion.proyecto)).map((project) => ({ projects: project, role_in_project: 'owner' })),
      supabase,
    };
  }

  // Los proyectos de esa persona, por correo: `rr_hub_access` no tiene columna
  // de correo, se une con `rr_hub_profiles` a través del `user_id`.
  const { data: perfil } = await supabase
    .from('rr_hub_profiles')
    .select('id')
    .ilike('email', sesion.email)
    .maybeSingle();
  if (!perfil) return { projects: [], supabase };

  const { data } = await supabase
    .from('rr_hub_access')
    .select('role_in_project, projects:rr_hub_projects(id, name, slug, client_name, brand_primary_color, description)')
    .eq('user_id', perfil.id);

  return { projects: (data ?? []).filter((row: any) => clienteEsVisible(row.projects?.slug, sesion.proyecto)), supabase };
}

export async function getIdeas(projectId: string) {
  const supabase = await createServiceClient() ?? await createClient();
  if (!supabase) { requireSupabase(); return demoIdeas; }

  const { data } = await supabase
    .from('rr_hub_ideas')
    .select('id, code, title, description, objective, content_type, category, status, priority, created_at, reference_urls, camera_brief, talent_brief, edit_brief, script_content')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  return (await conPortadas(supabase, data ?? [])).map(mapIdea);
}

/**
 * Adjunta a cada idea su asset de portada.
 *
 * Se resuelve con la misma regla que la función `rr_hub_idea_cover`: primero
 * la elección guardada en `cover_asset_id`, y si no hay, el `reference_brief`
 * más reciente. Se hace en DOS consultas y no con un join anidado porque el join
 * de PostgREST solo alcanzaría la portada elegida, y la regla del "más reciente"
 * vive en la base, no en el nombre de la relación.
 *
 * Una sola consulta para todas las ideas del proyecto, no una por idea: con 26
 * piezas en el tablero, 26 consultas de portada a la vez.
 *
 * Si la consulta de portadas falla, las ideas se devuelven igual SIN portada y
 * la tarjeta cae al marco de marca. Un fallo aquí no puede dejar el tablero en
 * blanco.
 */
async function conPortadas(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  ideas: Record<string, unknown>[],
): Promise<Record<string, unknown>[]> {
  if (ideas.length === 0) return ideas;
  const ids = ideas.map((idea) => idea.id as string).filter(Boolean);
  if (ids.length === 0) return ideas;

  const elegidos = new Map<string, unknown>();
  {
    // ⚠️ Dos trampas en esta consulta, ambas medidas contra la base el
    // 2026-09-28 (proyecto ntgtvtzbjwotuwkiflar, anon key, idea real):
    //
    //  1. El embed se llama `cover_asset_id`, no `cover_asset`. PostgREST busca
    //     la relación con el NOMBRE de la columna; `cover_asset(...)` da
    //     400 PGRST200 ("Could not find a relationship between
    //     'rr_hub_ideas' and 'cover_asset'") aunque la llave foránea exista.
    //     El alias corto va con dos puntos: `cover_asset:cover_asset_id(...)`,
    //     y es lo que devuelve el nombre que lee el bucle de abajo.
    //
    //  2. supabase-js NO lanza: una consulta rota llega como `{data: null, error}`.
    //     Por eso esto no va en un `try/catch` — un `catch` aquí solo captura
    //     fallos de red y deja pasar el PGRST200 como si fuera "sin portadas".
    //     Se comprueba `error` y se registra, para que una relación que se rompa
    //     se vea en la consola en vez de convertirse en un tablero que
    //     "funciona" pintando siempre el arte de marca.
    const { data: conElegida, error } = await supabase
      .from('rr_hub_ideas')
      .select('id, cover_asset:cover_asset_id(id, file_name, mime_type, external_url)')
      .in('id', ids);
    if (error) {
      console.warn('[hub] no se pudieron leer las portadas elegidas:', error.message);
    }
    for (const fila of conElegida ?? []) {
      // ⚠️ Un embed a UNA columna se devuelve como OBJETO, no como array. La
      // forma de array es la de un embed a una relación que devuelve VARIAS
      // filas. Medido el 2026-09-28 contra la base con las 3 portadas puestas:
      // `cover_asset` llega como `{id, file_name, …}`, y el `?.[0]` de siempre
      // daba `undefined` → `null` → la tarjeta caía al arte de marca sin decir
      // nada, que es el mismo fallo silencioso que el del PGRST200.
      // Se aceptan las dos formas para no depender de eso.
      const bruto = fila.cover_asset as unknown;
      const asset = Array.isArray(bruto) ? (bruto[0] ?? null) : (bruto ?? null);
      if (asset) elegidos.set(fila.id as string, asset);
    }
  }

  const faltantes = ids.filter((id) => !elegidos.has(id));
  if (faltantes.length > 0) {
    {
      // Misma regla que arriba: `error` se comprueba, no se atrapa. Un fallo aquí
      // no es catastrofico (la tarjeta cae al arte de marca) pero tiene que verse.
      const { data: assets, error } = await supabase
        .from('rr_hub_assets')
        .select('id, idea_id, file_name, mime_type, external_url, created_at')
        .in('idea_id', faltantes)
        .eq('asset_stage', 'reference_brief')
        .order('created_at', { ascending: false });
      if (error) {
        console.warn('[hub] no se pudieron leer los briefs de portada:', error.message);
      }
      // La ordenación es global, así que el primero que aparece de cada idea es
      // el suyo más reciente. `seen` evita que un segundo brief la sobreescriba.
      const vistos = new Set<string>();
      for (const fila of assets ?? []) {
        const ideaId = fila.idea_id as string;
        if (vistos.has(ideaId)) continue;
        vistos.add(ideaId);
        elegidos.set(ideaId, {
          id: fila.id,
          file_name: fila.file_name,
          mime_type: fila.mime_type,
          external_url: fila.external_url,
        });
      }
    }
  }

  return ideas.map((idea) => ({
    ...idea,
    cover_asset: elegidos.get(idea.id as string) ?? null,
  }));
}

export async function getIdea(projectId: string, id: string) {
  const supabase = await createServiceClient() ?? await createClient();
  if (!supabase) { requireSupabase(); return getDemoIdea(id); }

  const { data } = await supabase
    .from('rr_hub_ideas')
    .select('*')
    .eq('project_id', projectId)
    .eq('id', id)
    .maybeSingle();

  return data ? mapIdea(data) : null;
}

/**
 * Conteo de votos de una idea, para pintar el contador en la ficha.
 *
 * Solo el NÚMERO, nunca el token de quien votó: el votante es anónimo por
 * diseño, y devolverlo en la página convertiría el voto en un dato personal
 * legible por cualquiera que tenga el enlace. El token del navegador se manda
 * él mismo al votar y el servidor lo usa para el upsert.
 *
 * Se lee siempre, incluso con cero votos: `rr_hub_votes` no tiene filas para una
 * idea recién abierta, y ese `0 a favor / 0 en contra` es exactamente lo que hay
 * que mostrar.
 */
export type ConteoVotos = { aFavor: number; enContra: number; total: number };

export async function getVotos(ideaId: string): Promise<ConteoVotos> {
  const supabase = await createServiceClient() ?? await createClient();
  if (!supabase) return { aFavor: 0, enContra: 0, total: 0 };

  const { data } = await supabase
    .from('rr_hub_votes')
    .select('decision')
    .eq('idea_id', ideaId);

  const votos = data ?? [];
  const aFavor = votos.filter((v) => v.decision === 'yes').length;
  const enContra = votos.filter((v) => v.decision === 'no').length;
  return { aFavor, enContra, total: votos.length };
}

/**
 * El equipo y su último latido, para pintar quién está en línea.
 *
 * Solo devuelve filas que existen en `rr_hub_presencia`: quien nunca ha
 * entrado no aparece. El panel lo traduce a "DESCONECTADO · nunca ha entrado",
 * que es el estado que Dirección pidió distinguir del "activo pero no aquí".
 */
export type PresenciaFila = { email: string; nombre: string | null; lastSeenAt: string | null };

export async function getPresencia(): Promise<PresenciaFila[]> {
  const supabase = await createServiceClient() ?? await createClient();
  if (!supabase) return [];

  const { data } = await supabase
    .from('rr_hub_presencia')
    .select('email, profile_id, last_seen_at')
    .order('last_seen_at', { ascending: false });

  const filas = data ?? [];
  if (!filas.length) return [];

  const ids = filas.map((f) => f.profile_id).filter((id): id is string => Boolean(id));
  const { data: perfiles } = ids.length
    ? await supabase.from('rr_hub_profiles').select('id, full_name').in('id', ids)
    : { data: [] as { id: string; full_name: string | null }[] };

  const nombrePorId = new Map((perfiles ?? []).map((p) => [p.id, p.full_name]));

  return filas.map((f) => ({
    email: f.email as string,
    nombre: (f.profile_id ? nombrePorId.get(f.profile_id) : null) ?? null,
    lastSeenAt: (f.last_seen_at as string | null) ?? null,
  }));
}

/**
 * Public audit reads. These use the same anonymous client; RLS turns every
 * read below into an anon-only, read-only view while the global audit switch
 * is open, so nothing leaks and nothing can be written.
 */
export async function getAuditSettings() {
  const supabase = await createServiceClient() ?? await createClient();
  if (!supabase) return { enabled: false, opens_at: null, expires_at: null, updated_at: null };
  const { data } = await supabase
    .from('rr_hub_audit_settings')
    .select('enabled, opens_at, expires_at, updated_at')
    .eq('id', true)
    .maybeSingle();
  return data ?? { enabled: false, opens_at: null, expires_at: null, updated_at: null };
}

/** Every project, for the global audit index. RLS gates this, not a column filter. */
export async function getAuditProjects() {
  const supabase = await createServiceClient() ?? await createClient();
  if (!supabase) { requireSupabase(); return []; }
  const { data } = await supabase
    .from('rr_hub_projects')
    .select('id, name, slug, client_name, description, brand_primary_color')
    .order('name');
  const sesion = await quienEs();
  return (data ?? []).filter((project) => clienteEsVisible(project.slug, sesion?.proyecto));
}

/** Read-only administrative surface: roster, access matrix and pending invites. */
export async function getAuditRoster() {
  const supabase = await createServiceClient() ?? await createClient();
  if (!supabase) return { profiles: [], access: [], invites: [] };
  const [profiles, access, invites] = await Promise.all([
    supabase.from('rr_hub_profiles').select('id, email, full_name, global_role, created_at').order('email'),
    supabase.from('rr_hub_access').select('user_id, project_id, role_in_project, granted_at'),
    supabase.from('rr_hub_invites').select('email, project_id, role_in_project').order('email'),
  ]);
  return { profiles: profiles.data ?? [], access: access.data ?? [], invites: invites.data ?? [] };
}

export async function getAuditProject(slug: string) {
  if (!isVisibleProject(slug)) return null;

  // La auditoría es de solo lectura, pero no es pública: se ve lo del cliente del
  // código con el que se entró, no el de al lado. Antes solo comprobaba que el
  // slug fuera un cliente conocido, así que entrando con 1111 (Wundeer) se podía
  // abrir `/audit/candilejas` y ver las ideas del otro. Ver sin escribir sigue
  // siendo ver lo de otro cliente.
  const sesion = await quienEs();
  if (!sesion || !clienteEsVisible(slug, sesion.proyecto)) return null;
  const supabase = await createServiceClient() ?? await createClient();
  if (!supabase) { requireSupabase(); return null; }
  const { data } = await supabase
    .from('rr_hub_projects')
    .select('id, name, slug, client_name, description, brand_primary_color, public_audit')
    .eq('slug', slug)
    .maybeSingle();
  return data ?? null;
}

export async function getAuditIdeas(projectId: string) {
  const supabase = await createServiceClient() ?? await createClient();
  if (!supabase) { requireSupabase(); return demoIdeas; }
  const { data } = await supabase
    .from('rr_hub_ideas')
    .select('id, code, title, description, objective, content_type, category, status, priority, created_at, updated_at, reference_urls, camera_brief, talent_brief, edit_brief, script_content')
    .eq('project_id', projectId)
    .order('code', { ascending: true });
  return (data ?? []).map(mapIdea);
}

export async function getAuditIdea(projectId: string, id: string) {
  const supabase = await createServiceClient() ?? await createClient();
  if (!supabase) { requireSupabase(); return getDemoIdea(id); }
  const { data } = await supabase
    .from('rr_hub_ideas')
    .select('*')
    .eq('project_id', projectId)
    .eq('id', id)
    .maybeSingle();
  return data ? mapIdea(data) : null;
}

/** Counts per status for the audit summary, computed server-side. */
export async function getAuditStats(projectId: string) {
  const ideas = await getAuditIdeas(projectId);
  const counts: Record<string, number> = {};
  for (const idea of ideas) counts[idea.status] = (counts[idea.status] ?? 0) + 1;
  return { total: ideas.length, counts };
}

export async function getAuditTimeline(ideaId: string) {
  const supabase = await createServiceClient() ?? await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from('rr_hub_events')
    .select('id, to_status, comment, actor_label, created_at')
    .eq('idea_id', ideaId)
    .order('created_at', { ascending: false });
  return (data ?? []).map((row: any) => ({
    id: row.id as string,
    status: row.to_status as string,
    actor: (row.actor_label as string) || 'RR ALIADOS',
    note: (row.comment as string) ?? '',
    createdAt: row.created_at as string,
  }));
}

export async function getAuditComments(ideaId: string) {
  const supabase = await createServiceClient() ?? await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from('rr_hub_comments')
    .select('id, body, role_label, author_label, resolved_at, created_at')
    .eq('idea_id', ideaId)
    .order('created_at', { ascending: true });
  return (data ?? []).map((row: any) => ({
    id: row.id as string,
    author: (row.author_label as string) || 'RR ALIADOS',
    role: row.role_label as string,
    body: row.body as string,
    resolved: Boolean(row.resolved_at),
    createdAt: row.created_at as string,
  }));
}

export async function getAuditAssets(ideaId: string) {
  const supabase = await createServiceClient() ?? await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from('rr_hub_assets')
    .select('id, file_name, asset_stage, version_label, created_at, external_url')
    .eq('idea_id', ideaId)
    .order('created_at', { ascending: true });
  return (data ?? []).map((row: any) => ({
    id: row.id as string,
    name: row.file_name as string,
    stage: row.asset_stage as string,
    version: (row.version_label as string) ?? 'v1',
    createdAt: row.created_at as string,
  }));
}

/**
 * Comentarios, archivos y línea de tiempo de una pieza.
 *
 * Antes los leía el navegador con la clave anónima. Con la puerta por código el
 * anon no tiene permiso de lectura sobre esas tablas, así que llegaban vacíos y
 * la ficha parecía una pieza sin comentarios ni historial. No había error
 * visible: una lista vacía y una lista que no se cargó se ven igual.
 *
 * Ahora se leen aquí, con la clave del servidor, y llegan como props. La cookie
 * ya checked en la página: quien no entra no llega a este punto.
 */
export async function getComentarios(ideaId: string) {
  const supabase = await createServiceClient() ?? await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from('rr_hub_comments')
    .select('id, body, author_label, resolved, created_at')
    .eq('idea_id', ideaId)
    .order('created_at', { ascending: true });
  // Se devuelve con la forma que el componente ya espera (`text`, `author`,
  // `createdAt`), no con los nombres de columna. Que el mapeo esté aquí y no
  // en el componente es lo que evita tener dos versiones de la misma cosa: si
  // el componente se cambia, el servidor sigue hablando su idioma.
  return (data ?? []).map((c) => ({
    id: c.id as string,
    text: (c.body as string) ?? '',
    author: (c.author_label as string) ?? 'RR ALIADOS',
    role: 'colaboracion',
    createdAt: (c.created_at as string) ?? '',
    resolved: Boolean(c.resolved),
  }));
}

export async function getAssets(ideaId: string) {
  const supabase = await createServiceClient() ?? await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from('rr_hub_assets')
    .select('id, asset_stage, storage_path, external_url, file_name, mime_type, version_label, created_at')
    .eq('idea_id', ideaId)
    .order('created_at', { ascending: true });
  return (data ?? []).map((f) => ({
    id: f.id as string,
    name: (f.file_name as string) || 'archivo',
    kind: (f.mime_type as string) || 'archivo',
    stage: f.asset_stage as string,
    version: (f.version_label as string) || 'v1',
    createdAt: (f.created_at as string) || '',
    url: (f.storage_path as string) || (f.external_url as string) || null,
  }));
}

export async function getTimeline(ideaId: string) {
  const supabase = await createServiceClient() ?? await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from('rr_hub_events')
    .select('id, from_status, to_status, comment, actor_label, created_at')
    .eq('idea_id', ideaId)
    .order('created_at', { ascending: true });
  return (data ?? []).map((e) => ({
    id: e.id as string,
    status: (e.to_status as string) ?? '',
    from: (e.from_status as string) ?? null,
    actor: (e.actor_label as string) ?? 'Sistema',
    note: (e.comment as string) ?? '',
    createdAt: (e.created_at as string) ?? '',
  }));
}

/**
 * A qué clientes tiene acceso la persona que entró, y a cuáles no.
 *
 * Para el selector de clientes. La respuesta tiene las dos mitades a propósito:
 * Santiago pidió (2026-09-29) que se vieran **los dos** clientes, con candado en
 * el que no se puede entrar. Mostrar solo los que puede abrir esconde que existe
 * otro cliente; mostrar los dos sin decir nada invita a pulsar donde no se puede.
 *
 * La regla de qué se puede abrir NO está aquí: el servidor la vuelve a
 * comprobar en `/api/cambiar-cliente` contra `rr_hub_access` antes de emitir la
 * cookie nueva. Esto es la lista para pintar; la decisión, la ruta.
 *
 * El admin global entra en todos los clientes, con o sin fila de acceso: es lo
 * que ya hacía el resto del hub y lo que espera quien administra. El resto solo
 * ve los que tiene en `rr_hub_access`.
 */
export async function getClientesDeLaPersona(): Promise<{
  abiertos: { slug: string; name: string; client_name: string; brand_primary_color: string | null; description: string | null; rol: string }[];
  cerrados: { slug: string; name: string; client_name: string; brand_primary_color: string | null; description: string | null; motivo: 'sin-fila' | 'sin-codigo' }[];
  actual: string | null;
}> {
  const vacio = { abiertos: [], cerrados: [], actual: null as string | null };
  const supabase = await createServiceClient() ?? await createClient();
  if (!supabase) return vacio;

  const sesion = await quienEs();
  if (!sesion) return vacio;

  const { data: perfil } = await supabase
    .from('rr_hub_profiles')
    .select('id, global_role')
    .ilike('email', sesion.email)
    .maybeSingle();
  if (!perfil) return vacio;

  // Las dos consultas van en paralelo y el cruce de `access` con `proyectos` se
  // hace por `project_id`, que es una columna real de las dos. Nada de embed
  // aquí: `rr_hub_access` no tiene FK con `rr_hub_profiles` (verificado en
  // `pg_constraint`), y ese embed devolvía PGRST200 con `data: null` sin lanzar.
  const [catalogo, accesos] = await Promise.all([
    supabase
      .from('rr_hub_projects')
      .select('id, slug, name, client_name, brand_primary_color, description')
      .order('name'),
    supabase.from('rr_hub_access').select('project_id, role_in_project').eq('user_id', perfil.id),
  ]);

  const proyectos = (catalogo.data ?? []) as {
    id: string; slug: string; name: string; client_name: string;
    brand_primary_color: string | null; description: string | null;
  }[];
  if (proyectos.length === 0) return vacio;

  const rolPorProyecto = new Map<string, string>();
  for (const fila of (accesos.data ?? []) as { project_id: string; role_in_project: string }[]) {
    rolPorProyecto.set(fila.project_id, fila.role_in_project);
  }

  // La lista corta manda: un cliente que no está en `CLIENTES_CONOCIDOS` no se
  // ofrece, aunque tenga fila de acceso. Satiro y Boga no tienen código, así que
  // salen con candado y no se pueden abrir. Cuando tengan, basta con añadirlos a
  // esa lista — aquí no hay que tocar nada.
  const conocidos = proyectos.filter((p) => isVisibleProject(p.slug));

  const abiertos = conocidos
    .filter((p) => rolPorProyecto.has(p.id))
    .map((p) => ({ ...p, rol: rolPorProyecto.get(p.id) ?? 'sin_rol' }));

  // Los cerrados salen del catálogo ENTERO, no de `conocidos`. Con la lista
  // corta como fuente, Satiro y Boga no aparecían nunca: un `filter` sobre
  // `conocidos` solo puede devolver cosas que ya estaban en `conocidos`.
  //
  // Eso vaciaba el candado justo en el caso para el que existe. Santiago lo
  // pidió así el 2026-09-29: que se vea qué clientes hay, aunque no se puedan
  // abrir. Con la lista corta, quien no tenía fila en Candilejas veía un
  // desplegable con un solo cliente y sin ninguna pista de que hubiera más.
  //
  // Para abrir hace falta las dos cosas: fila en `rr_hub_access` Y cliente
  // conocido. Por eso la puerta (`/api/cambiar-cliente`) valida `CLIENTES_CONOCIDOS`
  // aunque esta función muestre Satiro y Boga: se ven, pero no se abren.
  const slugsAbiertos = new Set(abiertos.map((p) => p.slug));
  const cerrados = proyectos
    .filter((p) => !slugsAbiertos.has(p.slug))
    .map(({ id: _id, ...resto }) => ({
      ...resto,
      // Por qué está cerrado este cliente. Se distinguen los dos casos porque el
      // texto del candado miente si no: Boga y Satiro tienen filas de acceso
      // reales, lo que no tienen es código de cuatro dígitos. Decirles a sus
      // equipos "tu correo no tiene acceso" es falso, y medido el 2026-09-29 eso
      // era exactamente lo que se veía.
      //
      // `sin-fila` gana sobre `sin-codigo`: si además de no tener código la
      // persona no tiene fila, el problema real es la fila.
      motivo: (rolPorProyecto.has(_id) ? 'sin-codigo' : 'sin-fila') as 'sin-codigo' | 'sin-fila',
    }));

  return { abiertos, cerrados, actual: sesion.proyecto };
}
