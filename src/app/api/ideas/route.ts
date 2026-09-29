import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { isVisibleProject } from '@/lib/projects';
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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = process.env.RR_HUB_AUTOMATION_TOKEN;
  return url && serviceKey && token ? { url, serviceKey, token } : null;
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
      status: 'draft', priority: input.priority,
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
  const setup = await context(request);
  if ('response' in setup) return setup.response;
  // Esta API la usa el generador de ideas, que está capado por la cola
  // (`--tope-cola`), así que no necesita más puerta que la que ya tiene: la clave
  // de API. Lo que sí hace es dejar de estar atada a un solo cliente: escribir
  // `project=wundeer` o `project=candilejas` devuelve las ideas de ese cliente.
  const slug = new URL(request.url).searchParams.get('project') ?? 'wundeer';
  if (!isVisibleProject(slug)) return error('Ese cliente no existe.', 400);

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
  const setup = await context(request);
  if ('response' in setup) return setup.response;
  let body: Payload;
  try { body = await request.json(); } catch { return error('El cuerpo debe ser JSON válido.', 400); }
  const slug = body.project_slug ?? 'wundeer';
  if (!isVisibleProject(slug)) return error('Ese cliente no existe.', 400);

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
  });
  if (insertError || !idea) return error(insertError ?? 'No se pudo crear la idea.', 409);
  await setup.supabase.from('rr_hub_events').insert({
    idea_id: idea.id, to_status: 'draft', comment: 'Idea creada mediante la API de automatización.', actor_label: 'Automatización API',
  });
  return NextResponse.json({ success: true, idea }, { status: 201 });
}
