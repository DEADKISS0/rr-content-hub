import { createClient } from '@supabase/supabase-js';
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

async function context(request: NextRequest) {
  const env = configured();
  if (!env) return { response: error('La automatización no está configurada todavía.', 503) } as const;
  if (!authorized(request, env.token)) return { response: error('API key inválida.', 401) } as const;
  return { supabase: createClient(env.url, env.serviceKey) } as const;
}

export async function GET(request: NextRequest) {
  const setup = await context(request);
  if ('response' in setup) return setup.response;
  if (new URL(request.url).searchParams.get('project') !== 'wundeer') return error('Solo el proyecto Wundeer está disponible.', 400);

  const { data: project, error: projectError } = await setup.supabase.from('rr_hub_projects').select('id').eq('slug', 'wundeer').single();
  if (projectError || !project) return error('Wundeer no existe en la base.', 404);
  const { data, error: ideasError } = await setup.supabase
    .from('rr_hub_ideas')
    .select('id, code, title, description, objective, content_type, category, status, priority, reference_urls, created_at, updated_at')
    .eq('project_id', project.id)
    .order('created_at', { ascending: false });
  if (ideasError) return error('No se pudieron consultar las ideas.', 500);
  return NextResponse.json({ project: 'wundeer', count: data?.length ?? 0, ideas: data ?? [] });
}

export async function POST(request: NextRequest) {
  const setup = await context(request);
  if ('response' in setup) return setup.response;
  let body: Payload;
  try { body = await request.json(); } catch { return error('El cuerpo debe ser JSON válido.', 400); }
  if (body.project_slug !== 'wundeer') return error('Solo se pueden crear ideas en Wundeer.', 400);
  const title = body.title?.trim() ?? '';
  if (title.length < 3 || title.length > 160) return error('title debe tener entre 3 y 160 caracteres.', 400);
  const contentType = body.content_type === 'paid' ? 'paid' : 'organic';
  const references = Array.isArray(body.reference_urls) ? body.reference_urls.map((value) => value.trim()).filter(Boolean) : [];
  if (references.some((value) => !validUrl(value))) return error('Cada reference_urls debe ser una URL http(s) válida.', 400);

  const { data: project, error: projectError } = await setup.supabase.from('rr_hub_projects').select('id').eq('slug', 'wundeer').single();
  if (projectError || !project) return error('Wundeer no existe en la base.', 404);
  const { data: codes } = await setup.supabase.from('rr_hub_ideas').select('code').eq('project_id', project.id).eq('content_type', contentType);
  const prefix = contentType === 'organic' ? 'O' : 'P';
  const next = (codes ?? []).reduce((max, row) => Math.max(max, Number(String(row.code ?? '').replace(/^\D+/, '')) || 0), 0) + 1;
  const code = `${prefix}${next}`;
  const { data: idea, error: insertError } = await setup.supabase.from('rr_hub_ideas').insert({
    project_id: project.id, code, title,
    description: body.description?.trim() || 'Sin descripción aún.', objective: body.objective?.trim() || '',
    content_type: contentType, category: body.category?.trim() || 'General', reference_urls: references,
    status: 'draft', priority: body.priority === 'high' ? 'high' : 'normal',
  }).select('id, code, title, status').single();
  if (insertError || !idea) return error(insertError?.message || 'No se pudo crear la idea.', 400);
  await setup.supabase.from('rr_hub_events').insert({
    idea_id: idea.id, to_status: 'draft', comment: 'Idea creada mediante la API de automatización.', actor_label: 'Automatización API',
  });
  return NextResponse.json({ success: true, idea }, { status: 201 });
}
