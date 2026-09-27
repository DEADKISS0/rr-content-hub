import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

import { allowedTransitions, ROLE_LABEL, type RoleKey, type WorkflowStatus } from '@/lib/flow';

export const dynamic = 'force-dynamic';

/**
 * Workspace mutations, executed server-side.
 *
 * Why this exists: every write used to happen from the browser with the
 * publishable anon key. That made `transitionIdeaStatus`'s role check a
 * suggestion — the comment in that function claimed a hand-crafted request
 * could not skip states, and it absolutely could, because the only thing
 * standing between the request and the table was code running on the machine
 * making it. The fix is not a better client-side check; it is for the check to
 * happen where the client cannot edit it.
 *
 * Authorization here is the session's role in `rr_hub_access`, never a value
 * posted by the caller. RLS stays on as the second layer.
 */
/**
 * Who the caller is, with one documented escape hatch.
 *
 * Why this exists: the hub reads its roles from `rr_hub_access`, and in
 * production that table is EMPTY — as is `rr_hub_profiles`. So the rule was,
 * literally: log in and still get a 401, with no way in but SQL. That is what
 * "no me deja crear ideas" was. `SUPER_ADMIN_EMAILS` already existed for
 * `/audit/admin`; the same list now also unlocks the project role, so a human
 * can keep working while the roster is being filled in.
 *
 * It is deliberately the SAME env var and the SAME semantics as
 * `admin-guard.ts`: an operator-configured list, never in the repo, and never
 * widening what a project role can do — a super admin is `owner`, which is the
 * top of the existing ladder, not a new bypass.
 */
const SUPER_ADMIN_EMAILS = (process.env.SUPER_ADMIN_EMAILS ?? '')
  .split(',')
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

function isSuperAdmin(email: string): boolean {
  return SUPER_ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function unauthorized() {
  // One message for "no session" and for "not a member of this project": a
  // distinct reply for each would be a probe for enumerating who has access.
  return error('Necesitas una sesión con acceso a este proyecto para hacer eso.', 401);
}

/**
 * Modo abierto.
 *
 * El hub está detrás de un login de Google que comparte proyecto de Supabase con
 * Medellín Guide, y los dos se pisan la sesión: entrar a uno te manda al otro.
 * Mientras eso no se resuelve en el otro lado, `NEXT_PUBLIC_AUTH_ENABLED=false`
 * deja el hub utilizable sin cuenta.
 *
 * Por qué el mismo interruptor apaga las dos cosas: si la puerta se abriera
 * pero el servidor siguiera exigiendo sesión, la persona vería el formulario y
 * el guardado fallaría igual — o peor, quien tenga una sesión abierta en el
 * otro proyecto escribiría con el rol de este.
 *
 * El riesgo es real y conviene decirlo: abierto, cualquiera con la URL puede
 * crear y mover piezas, y los cambios quedan sin rastro de quién los hizo. Es
 * una medida temporal; para volver, `NEXT_PUBLIC_AUTH_ENABLED=true` y la
 * lista de roles en `rr_hub_access` siguen siendo la autoridad.
 */
const ABIERTO = process.env.NEXT_PUBLIC_AUTH_ENABLED !== 'true';

/** Quien figura en las piezas cuando no hay sesión: explícito, nunca inventado. */
const ABIERTO_ACTOR = 'sin-sesion';

async function context(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) {
    return { response: error('El servidor no tiene la configuración de Supabase.', 500) as NextResponse };
  }

  // The service client is what actually performs the write, because the anon
  // client cannot write to the workflow tables while RLS is closed. In open mode
  // it is also the identity: there is no one to ask, so writes go through with
  // a marker instead of pretending to be somebody.
  const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  if (ABIERTO) {
    return { service, supabase: service, userId: null, email: null, abierto: true };
  }

  // The caller's own client, carrying their session cookie. Its RLS applies,
  // which is what lets a member read their own project and stops an outsider.
  const supabase = createClient(url, anonKey, {
    global: { headers: { authorization: request.headers.get('authorization') ?? '' } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data } = await supabase.auth.getUser();
  if (!data.user?.email) return { response: unauthorized() as NextResponse };

  return { supabase, service, userId: data.user.id, email: data.user.email.toLowerCase(), abierto: false };
}

/** The caller's real role in the project that owns this idea. Never from the body. */
async function roleForIdea(supabase: SupabaseClient, userId: string, email: string, ideaId: string): Promise<RoleKey | null> {
  const { data } = await supabase
    .from('rr_hub_ideas')
    .select('project:rr_hub_projects!inner(id)')
    .eq('id', ideaId)
    .maybeSingle();
  const project = (data?.project as { id?: string } | undefined)?.id;
  if (!project) return null;

  const { data: access } = await supabase
    .from('rr_hub_access')
    .select('role_in_project')
    .eq('user_id', userId)
    .eq('project_id', project)
    .maybeSingle();
  if (access?.role_in_project) return access.role_in_project as RoleKey;

  // The roster is empty in production; without this nobody could ever move a
  // piece, not even the owner. Same list and same meaning as admin-guard.ts.
  if (isSuperAdmin(email)) return 'owner';
  return null;
}

type Body = Record<string, unknown>;

/** The three things every action needs: the caller's own client, the service client, and who they are. */
type Ctx = {
  supabase: SupabaseClient;
  service: SupabaseClient;
  userId: string | null;
  email: string | null;
  /** Modo abierto: no hay sesión que comprobar y el rol no se consulta. */
  abierto: boolean;
};

const str = (value: unknown, max = 4000) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

/** POST /api/workspace/transition — move an idea between states. */
export async function POST(request: NextRequest) {
  const route = request.nextUrl.pathname;
  const action = route.split('/').pop() ?? '';

  const ctx = await context(request);
  if ('response' in ctx) return ctx.response;
  const { service, supabase, userId, email } = ctx;

  let body: Body;
  try { body = (await request.json()) as Body; } catch { return error('Cuerpo JSON inválido.', 400); }

  // Creating an idea is the one action that has no idea to authorise against,
  // so it is handled before the ideaId requirement.
  if (action === 'create-idea') return createIdea(body, ctx);

  const ideaId = str(body.ideaId, 64);
  if (!ideaId) return error('Falta ideaId.', 400);

  // En modo abierto no hay a quién preguntar: se opera con el rol de
  // administración, que es el más alto de la escalera que ya existe. No se
  // inventa un rol nuevo, y en cuanto la puerta vuelva a encenderse este
  // camino deja de alcanzarse.
  const role: RoleKey | null = ctx.abierto ? 'owner' : await roleForIdea(supabase, userId!, email!, ideaId);
  if (!role) return unauthorized();

  if (action === 'transition') {
    const to = str(body.toStatus, 40) as WorkflowStatus;
    const from = str(body.fromStatus, 40) as WorkflowStatus;
    if (!to || !from) return error('Faltan fromStatus o toStatus.', 400);

    // The one authority on legal moves, now on the server.
    const permitted = allowedTransitions(role, from).some((move) => move.to === to);
    if (!permitted) return error(`El rol ${ROLE_LABEL[role]} no puede pasar de ${from} a ${to}.`, 403);

    const { data: current, error: readError } = await supabase
      .from('rr_hub_ideas').select('status').eq('id', ideaId).maybeSingle();
    if (readError) return error(readError.message, 500);
    if (!current) return error('La idea no existe.', 404);
    // The browser's idea of `from` is not trusted: read the real one.
    if (current.status !== from) return error(`La idea ya no está en ${from} (está en ${current.status}). Recarga.`, 409);

    const { error: updateError } = await service
      .from('rr_hub_ideas').update({ status: to, updated_at: new Date().toISOString() }).eq('id', ideaId);
    if (updateError) return error(updateError.message, 500);

    const { error: eventError } = await service.from('rr_hub_events').insert({
      idea_id: ideaId, from_status: from, to_status: to,
      comment: str(body.note, 1000) || null, actor_label: ROLE_LABEL[role],
    });
    if (eventError) return error(eventError.message, 500);
    return NextResponse.json({ success: true });
  }

  if (action === 'script') {
    const script = str(body.script, 60_000);
    if (!script) return error('El guion está vacío.', 400);
    const { error: updateError } = await service
      .from('rr_hub_ideas').update({ script_content: script, updated_at: new Date().toISOString() }).eq('id', ideaId);
    if (updateError) return error(updateError.message, 500);
    // Deliberately no event: saving a script is not a state transition, and a
    // fake one in the timeline is worse than no trace.
    return NextResponse.json({ success: true });
  }

  /**
   * Asignar responsable.
   *
   * En modo abierto todo cambio queda como "sin sesión", y eso es honesto pero
   * inútil: nadie sabe a quién preguntarle por la pieza. Esta acción deja que se
   * nombre a una persona REAL del roster, y escribe esa persona en
   * `rr_hub_ideas.created_by`, que es la columna que ya existía para eso y nunca
   * se usaba.
   *
   * La autoridad NO viene del body: el `userId` se resuelve contra
   * `rr_hub_access` en el servidor, y se comprueba que esa persona tenga acceso
   * al proyecto. Mandar un id inventado desde el navegador no asigna nada.
   *
   * No es un `transition`, así que no valida contra `allowedTransitions()`: es
   * metadata, no un cambio de fase. Aun así exige `owner`, porque nombrar a
   * alguien como responsable de una pieza es una decisión de dirección.
   */
  if (action === 'assign') {
    if (role !== 'owner') return error(`Solo el owner puede asignar responsable. Tu rol es ${ROLE_LABEL[role]}.`, 403);

    const asignado = str(body.userId, 64);
    if (!asignado) return error('Falta el responsable.', 400);

    // El proyecto se resuelve por el slug del body, no desde una variable que
    // no existe en este scope: la comprobación tiene que ser "esta persona tiene
    // acceso a ESTE proyecto", y para eso hace falta el id del proyecto.
    const slug = str(body.projectSlug, 60);
    if (!slug) return error('Falta projectSlug.', 400);
    const { data: proyecto } = await service
      .from('rr_hub_projects').select('id').eq('slug', slug).maybeSingle();
    if (!proyecto) return error('Ese proyecto no existe.', 404);

    const { data: existe } = await service
      .from('rr_hub_access')
      .select('user_id, role_in_project')
      .eq('user_id', asignado)
      .eq('project_id', proyecto.id)
      .maybeSingle();
    if (!existe) return error('Esa persona no tiene acceso a este proyecto.', 400);

    const { data: perfil } = await service
      .from('rr_hub_profiles')
      .select('full_name, email')
      .eq('id', asignado).maybeSingle();

    const { error: updateError } = await service
      .from('rr_hub_ideas')
      .update({ created_by: asignado, updated_at: new Date().toISOString() })
      .eq('id', ideaId);
    if (updateError) return error(updateError.message, 500);

    const nombre = perfil?.full_name ?? 'RR Aliados';
    const { error: eventError } = await service.from('rr_hub_events').insert({
      idea_id: ideaId, from_status: null, to_status: null,
      comment: `Responsable asignado: ${nombre}${perfil?.email ? ` (${perfil.email})` : ''}.`,
      actor_label: `${email ?? 'sin sesión'} · ${ROLE_LABEL[role]}`,
      actor_id: userId,
    });
    if (eventError) return error(eventError.message, 500);

    return NextResponse.json({ success: true, nombre });
  }

  if (action === 'comment') {
    const text = str(body.body, 4000);
    if (!text) return error('El comentario está vacío.', 400);
    const { error: insertError } = await service.from('rr_hub_comments').insert({
      idea_id: ideaId, body: text,
      role_label: ROLE_LABEL[role], author_label: `${ctx.email} · ${ROLE_LABEL[role]}`,
    });
    if (insertError) return error(insertError.message, 500);
    return NextResponse.json({ success: true });
  }

  if (action === 'resolve-comment') {
    const commentId = str(body.commentId, 64);
    if (!commentId) return error('Falta commentId.', 400);
    const { error: updateError } = await service
      .from('rr_hub_comments')
      .update({ resolved_at: isResolved(body.resolved) ? new Date().toISOString() : null })
      .eq('id', commentId)
      .eq('idea_id', ideaId);
    if (updateError) return error(updateError.message, 500);
    return NextResponse.json({ success: true });
  }

  if (action === 'asset') {
    // The object itself was uploaded by the browser with the session token, so
    // RLS on storage.objects decided whether that was allowed. The service
    // client only writes the metadata row, after checking the path belongs to
    // this idea and to this session.
    // En modo abierto no hay id de sesión que atar a la ruta: se usa un
    // marcador fijo y explícito. Así el path sigue siendo verificable y además
    // dice a simple vista que la subida vino sin sesión.
    const check = validateAssetPath(str(body.path, 300), ideaId, userId ?? ABIERTO_ACTOR);
    if ('pathError' in check) return error(check.pathError, 400);

    const { error: insertError } = await service.from('rr_hub_assets').insert({
      idea_id: ideaId,
      asset_stage: str(body.stage, 40) as never,
      storage_path: check.assetPath,
      file_name: str(body.fileName, 200),
      mime_type: str(body.mimeType, 100) || null,
      version_label: str(body.versionLabel, 80),
    });
    if (insertError) return error(insertError.message, 500);
    return NextResponse.json({ success: true, path: check.assetPath });
  }

  return error('Acción desconocida.', 404);
}

const isResolved = (value: unknown) => value === true || value === 'true';

/**
 * The storage path is built by the browser, so it is verified here. It has to
 * sit under this idea's own folder, which is what stops a member of one project
 * from registering an asset inside another's. The session id is part of the
 * path for the same reason: it ties the object to whoever uploaded it.
 */
function validateAssetPath(
  candidate: string,
  ideaId: string,
  userId: string,
): { assetPath: string } | { pathError: string } {
  if (!candidate) return { pathError: 'Falta la ruta del archivo.' };
  if (candidate.includes('..')) return { pathError: 'Ruta inválida.' };

  // <projectSlug>/<ideaId>/<stage>/<sessionId>-<file>
  const parts = candidate.split('/');
  if (parts.length !== 4) return { pathError: 'Ruta inválida.' };
  if (parts[1] !== ideaId) return { pathError: 'La ruta no corresponde a esta idea.' };
  if (!parts[3].startsWith(userId)) return { pathError: 'La ruta no corresponde a tu sesión.' };
  return { assetPath: candidate };
}

/**
 * Idea creation lives in its own function because it is the one action without
 * an existing idea to authorise against: the role comes from the project in the
 * body, looked up before anything is written.
 */
async function createIdea(body: Body, ctx: Ctx): Promise<NextResponse> {
  const { supabase, service, userId, email } = ctx;
  const projectSlug = str(body.projectSlug, 60);
  const { data: project } = await supabase
    .from('rr_hub_projects').select('id').eq('slug', projectSlug).maybeSingle();
  if (!project) return error('Ese proyecto no existe.', 404);

  const { data: access } = ctx.abierto
    ? { data: { role_in_project: 'owner' } }
    : await supabase
      .from('rr_hub_access').select('role_in_project')
      .eq('user_id', userId!).eq('project_id', project.id).maybeSingle();
  const creatorRole = (access?.role_in_project as RoleKey | undefined)
    ?? (email && isSuperAdmin(email) ? 'owner' : undefined);
  if (!creatorRole) return unauthorized();

  const title = str(body.title, 160);
  if (title.length < 3) return error('El título necesita al menos 3 caracteres.', 400);
  const contentType = body.contentType === 'paid' ? 'paid' : 'organic';
  const references = Array.isArray(body.referenceUrls)
    ? body.referenceUrls.map((value) => str(value, 300)).filter((value) => /^https?:\/\//.test(value)).slice(0, 10)
    : [];

  // The code is assigned here, not by the browser, for the same reason as in
  // /api/ideas: a max+1 read in two places at once hands out the same number
  // twice, and the browser is not the only writer.
  const prefix = contentType === 'organic' ? 'O' : 'P';
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data: codes } = await service
      .from('rr_hub_ideas').select('code')
      .eq('project_id', project.id).eq('content_type', contentType);
    const next = (codes ?? []).reduce<number>(
      (max, row) => Math.max(max, Number(String((row as { code?: string | null }).code ?? '').replace(/^\D+/, '')) || 0), 0) + 1;

    const { data: idea, error: insertError } = await service.from('rr_hub_ideas').insert({
      project_id: project.id, code: `${prefix}${next}`, title,
      description: str(body.description, 2000) || 'Sin descripción aún.',
      objective: str(body.objective, 500),
      content_type: contentType,
      category: str(body.category, 80) || 'Sin categoría',
      status: 'draft', priority: 'normal',
      camera_brief: str(body.cameraBrief, 4000),
      talent_brief: str(body.talentBrief, 4000),
      edit_brief: str(body.editBrief, 4000),
      script_content: str(body.script, 60_000),
      reference_urls: references,
    }).select('id').single();

    if (!insertError && idea) {
      await service.from('rr_hub_events').insert({
        idea_id: idea.id, to_status: 'draft',
        comment: 'Idea creada con referencia, brief automático y guion inicial.',
        actor_label: `${email ?? 'sin sesión'} · ${ROLE_LABEL[creatorRole]}`,
      });
      return NextResponse.json({ success: true, id: idea.id });
    }
    // 23505 = unique violation: another writer took this code, recompute.
    if (insertError?.code !== '23505') return error(insertError?.message ?? 'No se pudo crear la idea.', 500);
  }
  return error('No se pudo asignar un código libre tras varios intentos.', 409);
}
