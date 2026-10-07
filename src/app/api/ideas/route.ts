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

const LIMITS = { title: [3, 160], description: [0, 2000], objective: [0, 500], category: [1, 80], references: 10 } as const;

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
  | { title: string; contentType: 'organic' | 'paid'; references: string[] } {
  const title = body.title?.trim() ?? '';
  const [tMin, tMax] = LIMITS.title;
  if (title.length < tMin || title.length > tMax) {
    return { error: `title debe tener entre ${tMin} y ${tMax} caracteres.` };
  }
  for (const field of ['description', 'objective', 'category'] as const) {
    const [min, max] = LIMITS[field];
    const value = (body[field] ?? '').trim();
    if (value.length < min || value.length > max) {
      return { error: `${field} debe tener entre ${min} y ${max} caracteres.` };
    }
  }
  const raw = Array.isArray(body.reference_urls) ? body.reference_urls : [];
  if (raw.length > LIMITS.references) {
    return { error: `reference_urls admite maximo ${LIMITS.references} elementos.` };
  }
  const references = raw.map((value) => String(value).trim()).filter(Boolean);
  if (references.some((value) => !validUrl(value))) {
    return { error: 'Cada reference_urls debe ser una URL http(s) válida.' };
  }
  return { title, contentType: body.content_type === 'paid' ? 'paid' : 'organic', references };
}

type IdeaRow = { id: string; code: string; title: string; status: string };

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
      origen: input.origen,
    }).select('id, code, title, status').single();

    if (!error) return { data: data as IdeaRow };
    // 23505 = unique violation: another writer took this code, recompute.
    if (error.code === '23505') continue;
    return { error: error.message };
  }
  return { error: 'No se pudo asignar un codigo libre tras varios intentos.' };
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

  let body: Payload;
  try { body = await request.json(); } catch { return error('El cuerpo debe ser JSON válido.', 400); }
  const slug = body.project_slug ?? 'wundeer';
  if (!catalogoIncluye(slug)) return error('Ese cliente no existe.', 400);
  if (!(await clienteExiste(slug))) return error('Ese cliente no existe.', 400);

  const problem = validate(body);
  if ('error' in problem) return error(problem.error, 400);
  const { title, contentType, references } = problem;

  const { data: project, error: projectError } = await setup.supabase.from('rr_hub_projects').select('id').eq('slug', slug).single();
  if (projectError || !project) return error(`${slug} no existe en la base.`, 404);

  const { data: idea, error: insertError } = await insertWithCode(setup.supabase, {
    projectId: project.id,
    title,
    description: body.description?.trim() || 'Sin descripción aún.',
    objective: body.objective?.trim() || '',
    category: body.category?.trim() || 'General',
    references,
    contentType,
    priority: body.priority === 'high' ? 'high' : 'normal',
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
