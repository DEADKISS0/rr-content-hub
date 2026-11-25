import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { clienteExiste } from '@/lib/projects';
import { hubConfig, catalogoIncluye } from '@/lib/config';
import { checkDbLimit, recordDbFailure, recordDbSuccess, retryAfterDb } from '../_lib/rate-limit-db';
import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Payload = {
  project_slug?: string;
  title?: string;
  description?: string;
  objective?: string;
  content_type?: 'organic' | 'paid';
  category?: string;
  reference_urls?: string[];
  priority?: 'high' | 'normal';
  camera_brief?: string;
  talent_brief?: string;
  edit_brief?: string;
};

type BatchPayload = {
  project_slug?: string;
  batch_key?: string;
  ideas?: Payload[];
};

function configured() {
  const url = hubConfig.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = hubConfig.SUPABASE_SERVICE_ROLE_KEY;
  const token = hubConfig.RR_HUB_AUTOMATION_TOKEN;
  return url && serviceKey && token ? { url, serviceKey, token } : null;
}

function origenDe(request: NextRequest): 'asistente' | 'manual' {
  return request.headers.get('x-rr-origen') === 'asistente' ? 'asistente' : 'manual';
}

function origenDePeticion(request: NextRequest): string {
  const cadena = request.headers.get('x-forwarded-for') ?? '';
  const primera = cadena.split(',')[0]?.trim();
  return primera || 'desconocido';
}

function authorized(request: NextRequest, token: string) {
  const value = request.headers.get('x-api-key');
  if (!value || value.length !== token.length) return false;
  return timingSafeEqual(Buffer.from(value), Buffer.from(token));
}

function validUrl(value: string) {
  try { const url = new URL(value); return url.protocol === 'https:' || url.protocol === 'http:'; } catch { return false; }
}

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

const LIMITS = {
  title: [3, 160], description: [0, 6000], objective: [0, 1000], category: [1, 80],
  camera_brief: [0, 2000], talent_brief: [0, 2000], edit_brief: [0, 2000], references: 10,
} as const;

type ValidIdea = {
  title: string;
  description: string;
  objective: string;
  category: string;
  cameraBrief: string;
  talentBrief: string;
  editBrief: string;
  contentType: 'organic' | 'paid';
  references: string[];
  priority: 'high' | 'normal';
};

/**
 * Full body validation, returning either the normalised values or a message.
 *
 * The previous version checked `title` and the reference URLs and nothing else:
 * `description`, `objective` and `category` were accepted at any length, and an
 * unbounded number of references was allowed. This endpoint runs with the
 * service role, which bypasses RLS — so app-side validation is the only
 * boundary there is.
 */
function validate(body: Payload):
  | { error: string }
  | ValidIdea {
  const title = body.title?.trim() ?? '';
  const [tMin, tMax] = LIMITS.title;
  if (title.length < tMin || title.length > tMax) {
    return { error: `title debe tener entre ${tMin} y ${tMax} caracteres.` };
  }
  const text = {} as Record<'description' | 'objective' | 'category' | 'camera_brief' | 'talent_brief' | 'edit_brief', string>;
  for (const field of ['description', 'objective', 'category', 'camera_brief', 'talent_brief', 'edit_brief'] as const) {
    const [min, max] = LIMITS[field];
    const value = (body[field] ?? '').trim();
    if (value.length < min || value.length > max) {
      return { error: `${field} debe tener entre ${min} y ${max} caracteres.` };
    }
    text[field] = value;
  }
  const raw = Array.isArray(body.reference_urls) ? body.reference_urls : [];
  if (raw.length > LIMITS.references) {
    return { error: `reference_urls admite maximo ${LIMITS.references} elementos.` };
  }
  const references = raw.map((value) => String(value).trim()).filter(Boolean);
  if (references.some((value) => !validUrl(value))) {
    return { error: 'Cada reference_urls debe ser una URL http(s) válida.' };
  }
  return {
    title,
    description: text.description || 'Sin descripción aún.',
    objective: text.objective,
    category: text.category || 'General',
    cameraBrief: text.camera_brief,
    talentBrief: text.talent_brief,
    editBrief: text.edit_brief,
    contentType: body.content_type === 'paid' ? 'paid' : 'organic',
    references,
    priority: body.priority === 'high' ? 'high' : 'normal',
  };
}

type IdeaRow = { id: string; code: string; title: string; status: string };
type BatchIdeaRow = IdeaRow & { automation_batch_index: number };

/**
 * Insert with the next sequential code, retrying on collision.
 *
 * The old code read every existing code, took `max + 1` and inserted. Two
 * concurrent callers both read the same maximum and both inserted, producing a
 * duplicate `code` — the column has no unique constraint. Retrying on the
 * conflict turns that race into a short loop instead of silent duplication.
 */
async function insertWithCode(
  supabase: SupabaseClient,
  input: {
    projectId: string; title: string; description: string; objective: string;
    category: string; references: string[]; contentType: 'organic' | 'paid'; priority: 'high' | 'normal';
    cameraBrief: string; talentBrief: string; editBrief: string;
    origen: 'asistente' | 'manual';
  },
): Promise<{ data?: IdeaRow; error?: string }> {
  const prefix = input.contentType === 'organic' ? 'O' : 'P';
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data: codes } = await supabase
      .from('rr_hub_ideas').select('code')
      .eq('project_id', input.projectId).eq('content_type', input.contentType);
    const next = (codes ?? []).reduce(
      (max, row) => Math.max(max, Number(String(row.code ?? '').replace(/^\D+/, '')) || 0), 0) + 1;

    const { data, error } = await supabase.from('rr_hub_ideas').insert({
      project_id: input.projectId, code: `${prefix}${next}`, title: input.title,
      description: input.description, objective: input.objective,
      content_type: input.contentType, category: input.category, reference_urls: input.references,
      status: 'voting', priority: input.priority,
      camera_brief: input.cameraBrief || null,
      talent_brief: input.talentBrief || null,
      edit_brief: input.editBrief || null,
      origen: input.origen,
    }).select('id, code, title, status').single();

    if (!error) return { data: data as IdeaRow };
    // 23505 = unique violation: another writer took this code, recompute.
    if (error.code === '23505') continue;
    return { error: error.message };
  }
  return { error: 'No se pudo asignar un codigo libre tras varios intentos.' };
}

const IDEAS_POR_LOTE = 10;

function batchKeyIsValid(value: string | undefined): value is string {
  return Boolean(value && /^[a-z0-9][a-z0-9._-]{2,119}$/i.test(value));
}

function batchMarker(batchKey: string, index: number) {
  return `Importación automática · lote ${batchKey} · idea ${index + 1}/${IDEAS_POR_LOTE}.`;
}

function validateBatch(body: BatchPayload): { error: string } | { batchKey: string; ideas: ValidIdea[] } {
  if (!batchKeyIsValid(body.batch_key)) {
    return { error: 'batch_key debe tener entre 3 y 120 caracteres: letras, números, punto, guion o guion bajo.' };
  }
  if (!Array.isArray(body.ideas) || body.ideas.length !== IDEAS_POR_LOTE) {
    return { error: `ideas debe contener exactamente ${IDEAS_POR_LOTE} propuestas.` };
  }
  const ideas: ValidIdea[] = [];
  for (const [index, raw] of body.ideas.entries()) {
    const idea = validate(raw);
    if ('error' in idea) return { error: `ideas[${index}]: ${idea.error}` };
    if (idea.description.length < 80) return { error: `ideas[${index}]: description debe resumir el análisis de viabilidad (mínimo 80 caracteres).` };
    for (const [field, value] of [['camera_brief', idea.cameraBrief], ['talent_brief', idea.talentBrief], ['edit_brief', idea.editBrief]] as const) {
      if (value.length < 20) return { error: `ideas[${index}]: ${field} debe contener el mini-brief de producción (mínimo 20 caracteres).` };
    }
    ideas.push(idea);
  }
  return { batchKey: body.batch_key, ideas };
}

async function existingBatch(supabase: SupabaseClient, projectId: string, batchKey: string) {
  const { data, error: lookupError } = await supabase
    .from('rr_hub_ideas')
    .select('id, code, title, status, automation_batch_index')
    .eq('project_id', projectId)
    .eq('automation_batch_key', batchKey)
    .order('automation_batch_index', { ascending: true });
  if (lookupError) return { error: lookupError.message };
  return { data: (data ?? []) as BatchIdeaRow[] };
}

/**
 * A batch is atomic at the ideas table: ten new rows arrive together or none
 * do. The unique batch key is also the idempotency key used by the Tuesday
 * routine, so a network retry returns the original ten cards instead of
 * creating a second set for the team to review.
 */
async function insertBatchWithCodes(
  supabase: SupabaseClient,
  input: { projectId: string; batchKey: string; ideas: ValidIdea[]; origen: 'asistente' | 'manual' },
): Promise<{ data?: BatchIdeaRow[]; duplicate?: boolean; error?: string }> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const already = await existingBatch(supabase, input.projectId, input.batchKey);
    if ('error' in already) return already;
    if (already.data.length === IDEAS_POR_LOTE) return { data: already.data, duplicate: true };
    if (already.data.length > 0) return { error: 'El lote existe de forma incompleta. No se añadieron duplicados.' };

    const { data: codes, error: codesError } = await supabase
      .from('rr_hub_ideas').select('code, content_type')
      .eq('project_id', input.projectId);
    if (codesError) return { error: codesError.message };
    const nextByType: Record<'organic' | 'paid', number> = { organic: 1, paid: 1 };
    for (const row of codes ?? []) {
      const type = row.content_type === 'paid' ? 'paid' : 'organic';
      const sequence = Number(String(row.code ?? '').replace(/^\D+/, '')) || 0;
      nextByType[type] = Math.max(nextByType[type], sequence + 1);
    }
    const rows = input.ideas.map((idea, index) => {
      const prefix = idea.contentType === 'paid' ? 'P' : 'O';
      const code = `${prefix}${nextByType[idea.contentType]++}`;
      return {
        project_id: input.projectId,
        code,
        title: idea.title,
        description: idea.description,
        objective: idea.objective,
        content_type: idea.contentType,
        category: idea.category,
        reference_urls: idea.references,
        status: 'voting',
        priority: idea.priority,
        camera_brief: idea.cameraBrief,
        talent_brief: idea.talentBrief,
        edit_brief: idea.editBrief,
        origen: input.origen,
        automation_batch_key: input.batchKey,
        automation_batch_index: index,
      };
    });
    const { data, error: insertError } = await supabase
      .from('rr_hub_ideas').insert(rows)
      .select('id, code, title, status, automation_batch_index');
    if (!insertError) return { data: (data ?? []) as BatchIdeaRow[] };
    if (insertError.code !== '23505') return { error: insertError.message };
  }
  return { error: 'No se pudo asignar un código libre al lote tras varios intentos.' };
}

async function context(request: NextRequest) {
  const env = configured();
  if (!env) return { response: error('La automatización no está configurada todavía.', 503) } as const;
  if (!authorized(request, env.token)) return { response: error('API key inválida.', 401) } as const;
  return { supabase: createClient(env.url, env.serviceKey) } as const;
}

export async function GET(request: NextRequest) {
  const ip = origenDePeticion(request);
  const path = '/api/ideas:get';
  const ok = await checkDbLimit(ip, path, 120);
  if (!ok) {
    const espera = await retryAfterDb(ip, path);
    const respuesta = NextResponse.json({ error: 'Demasiadas solicitudes. Intenta de nuevo mas tarde.' }, { status: 429 });
    respuesta.headers.set('Retry-After', String(espera));
    return respuesta;
  }
  await recordDbFailure(ip, path);

  const setup = await context(request);
  if ('response' in setup) return setup.response;

  const slug = new URL(request.url).searchParams.get('project') ?? 'wundeer';
  if (!catalogoIncluye(slug)) return error('Ese cliente no existe.', 400);
  if (!(await clienteExiste(slug))) return error('Ese cliente no existe.', 400);

  const { data: project, error: projectError } = await setup.supabase.from('rr_hub_projects').select('id').eq('slug', slug).single();
  if (projectError || !project) return error(`${slug} no existe en la base.`, 404);
  const { data, error: ideasError } = await setup.supabase
    .from('rr_hub_ideas')
    .select('id, code, title, description, objective, content_type, category, status, priority, reference_urls, created_at, updated_at')
    .eq('project_id', project.id)
    .order('created_at', { ascending: false });
  if (ideasError) return error('No se pudieron consultar las ideas.', 500);
  return NextResponse.json({ project: slug, count: data?.length ?? 0, ideas: data ?? [] });
}

export async function POST(request: NextRequest) {
  const ip = origenDePeticion(request);
  const path = '/api/ideas:post';
  const ok = await checkDbLimit(ip, path, 60);
  if (!ok) {
    const espera = await retryAfterDb(ip, path);
    const respuesta = NextResponse.json({ error: 'Demasiadas solicitudes. Intenta de nuevo mas tarde.' }, { status: 429 });
    respuesta.headers.set('Retry-After', String(espera));
    return respuesta;
  }
  await recordDbFailure(ip, path);

  const setup = await context(request);
  if ('response' in setup) return setup.response;

  let body: Payload | BatchPayload;
  try { body = await request.json(); } catch { return error('El cuerpo debe ser JSON válido.', 400); }
  const slug = body.project_slug ?? 'wundeer';
  if (!catalogoIncluye(slug)) return error('Ese cliente no existe.', 400);
  if (!(await clienteExiste(slug))) return error('Ese cliente no existe.', 400);

  const { data: project, error: projectError } = await setup.supabase.from('rr_hub_projects').select('id').eq('slug', slug).single();
  if (projectError || !project) return error(`${slug} no existe en la base.`, 404);

  if ('ideas' in body && body.ideas !== undefined) {
    const batch = validateBatch(body);
    if ('error' in batch) return error(batch.error, 400);
    const result = await insertBatchWithCodes(setup.supabase, {
      projectId: project.id,
      batchKey: batch.batchKey,
      ideas: batch.ideas,
      origen: origenDe(request),
    });
    if (result.error || !result.data) return error(result.error ?? 'No se pudo crear el lote.', 409);

    if (!result.duplicate) {
      const { error: eventsError } = await setup.supabase.from('rr_hub_events').insert(result.data.map((idea) => ({
        idea_id: idea.id,
        to_status: 'voting',
        comment: batchMarker(batch.batchKey, idea.automation_batch_index),
        actor_label: 'Automatización API',
      })));
      if (eventsError) {
        console.error('[ideas-api] lote creado sin eventos:', eventsError.message);
      }
    }
    return NextResponse.json({
      success: true,
      batch_key: batch.batchKey,
      imported: result.duplicate ? 0 : result.data.length,
      already_imported: result.duplicate ?? false,
      ideas: result.data,
    }, { status: result.duplicate ? 200 : 201 });
  }

  const problem = validate(body);
  if ('error' in problem) return error(problem.error, 400);
  const { title, description, objective, category, cameraBrief, talentBrief, editBrief, contentType, references, priority } = problem;

  const { data: idea, error: insertError } = await insertWithCode(setup.supabase, {
    projectId: project.id,
    title,
    description,
    objective,
    category,
    references,
    contentType,
    priority,
    cameraBrief,
    talentBrief,
    editBrief,
    origen: origenDe(request),
  });
  if (insertError || !idea) return error(insertError ?? 'No se pudo crear la idea.', 409);
  await setup.supabase.from('rr_hub_events').insert({
    idea_id: idea.id, to_status: 'voting',
    comment: 'Idea creada mediante la API de automatización y abierta a votación de inmediato.',
    actor_label: 'Automatización API',
  });
  return NextResponse.json({ success: true, idea }, { status: 201 });
}
