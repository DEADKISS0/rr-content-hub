'use client';

import { createClient } from '@/lib/supabase/client';
import { ROLE_LABEL, type RoleKey } from '@/lib/flow';

/**
 * Client-side workspace operations backed by Supabase.
 *
 * Every write goes to the `rr_hub_*` tables (never the legacy CRM tables) and
 * relies on RLS for authorization. When Supabase env vars are absent these
 * helpers report that state so the UI can explain itself instead of pretending
 * to persist anything.
 */

export type AssetStage =
  | 'reference_brief'
  | 'script'
  | 'raw'
  | 'edit_v1'
  | 'edit_v2'
  | 'edit_final'
  | 'publication_evidence';

export const STORAGE_BUCKET = process.env.NEXT_PUBLIC_STORAGE_BUCKET || 'rr-content-assets';

export type TimelineEvent = {
  id: string;
  status: string;
  actor: string;
  note: string;
  createdAt: string;
};

export type IdeaComment = {
  id: string;
  author: string;
  role: string;
  text: string;
  createdAt: string;
  resolved: boolean;
};

export type IdeaAsset = {
  id: string;
  name: string;
  kind: string;
  stage: string;
  version: string;
  createdAt: string;
  url: string | null;
};

const stamp = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
    : 'Ahora';

export async function loadTimeline(ideaId: string): Promise<TimelineEvent[]> {
  const supabase = createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from('rr_hub_events')
    .select('id, to_status, comment, actor_label, created_at')
    .eq('idea_id', ideaId)
    .order('created_at', { ascending: false });
  return (data ?? []).map((row: any) => ({
    id: row.id,
    status: row.to_status,
    actor: row.actor_label || 'RR ALIADOS',
    note: row.comment || 'Sin nota registrada.',
    createdAt: stamp(row.created_at),
  }));
}

export async function transitionIdeaStatus(input: {
  ideaId: string;
  fromStatus?: string;
  toStatus: string;
  note: string;
  role: RoleKey;
}): Promise<{ error?: string }> {
  const supabase = createClient();
  if (!supabase) return { error: 'Supabase no está configurado en este entorno.' };
  const { error: updateError } = await supabase
    .from('rr_hub_ideas')
    .update({ status: input.toStatus, updated_at: new Date().toISOString() })
    .eq('id', input.ideaId);
  if (updateError) return { error: updateError.message };

  const { error: eventError } = await supabase.from('rr_hub_events').insert({
    idea_id: input.ideaId,
    from_status: input.fromStatus ?? null,
    to_status: input.toStatus,
    comment: input.note || null,
    actor_label: `Modo colaborativo · ${ROLE_LABEL[input.role]}`,
  });
  if (eventError) return { error: eventError.message };
  return {};
}

export async function loadComments(ideaId: string): Promise<IdeaComment[]> {
  const supabase = createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from('rr_hub_comments')
    .select('id, body, role_label, author_label, resolved_at, created_at')
    .eq('idea_id', ideaId)
    .order('created_at', { ascending: true });
  return (data ?? []).map((row: any) => ({
    id: row.id,
    author: row.author_label || 'RR ALIADOS',
    role: row.role_label,
    text: row.body,
    createdAt: stamp(row.created_at),
    resolved: Boolean(row.resolved_at),
  }));
}

export async function addComment(input: { ideaId: string; body: string; roleLabel: string }): Promise<{ error?: string }> {
  const supabase = createClient();
  if (!supabase) return { error: 'Supabase no está configurado en este entorno.' };
  const { error } = await supabase
    .from('rr_hub_comments')
    .insert({ idea_id: input.ideaId, body: input.body, role_label: input.roleLabel, author_label: `Modo colaborativo · ${input.roleLabel}` });
  return error ? { error: error.message } : {};
}

export async function resolveComment(input: { commentId: string; resolved: boolean }): Promise<{ error?: string }> {
  const supabase = createClient();
  if (!supabase) return { error: 'Supabase no está configurado en este entorno.' };
  const { error } = await supabase
    .from('rr_hub_comments')
    .update({ resolved_at: input.resolved ? new Date().toISOString() : null })
    .eq('id', input.commentId);
  return error ? { error: error.message } : {};
}

export async function saveIdeaScript(input: { ideaId: string; script: string; role: RoleKey }): Promise<{ error?: string }> {
  const supabase = createClient();
  if (!supabase) return { error: 'Supabase no está configurado en este entorno.' };
  const { error } = await supabase.from('rr_hub_ideas').update({ script_content: input.script, updated_at: new Date().toISOString() }).eq('id', input.ideaId);
  if (error) return { error: error.message };
  const { error: eventError } = await supabase.from('rr_hub_events').insert({
    idea_id: input.ideaId,
    to_status: 'script_in_progress',
    comment: 'Guion guardado y disponible para los equipos de producción.',
    actor_label: `Modo colaborativo · ${ROLE_LABEL[input.role]}`,
  });
  return eventError ? { error: eventError.message } : {};
}

export async function loadAssets(ideaId: string): Promise<IdeaAsset[]> {
  const supabase = createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from('rr_hub_assets')
    .select('id, file_name, mime_type, asset_stage, version_label, storage_path, external_url, created_at')
    .eq('idea_id', ideaId)
    .order('created_at', { ascending: true });
  return (data ?? []).map((row: any) => ({
    id: row.id,
    name: row.file_name,
    kind: (row.mime_type || '').split('/')[0].toUpperCase() || 'ARCHIVO',
    stage: row.asset_stage,
    version: row.version_label || 'v1',
    createdAt: stamp(row.created_at),
    url: row.storage_path || row.external_url || null,
  }));
}

export async function uploadAsset(input: {
  ideaId: string;
  projectSlug: string;
  stage: AssetStage;
  file: File;
  versionLabel: string;
}): Promise<{ error?: string }> {
  const supabase = createClient();
  if (!supabase) return { error: 'Supabase no está configurado en este entorno.' };
  const maxSize = 50 * 1024 * 1024;
  if (input.file.size > maxSize) return { error: 'El archivo supera el límite de 50 MB.' };
  const allowed = input.file.type.startsWith('image/')
    || input.file.type.startsWith('video/')
    || ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(input.file.type);
  if (!allowed) return { error: 'Tipo de archivo no permitido. Usa imagen, video, PDF, DOC o DOCX.' };

  const safeName = input.file.name.replace(/[^\w.\-]+/g, '_');
  const path = `${input.projectSlug}/${input.ideaId}/${input.stage}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, input.file, { upsert: false, contentType: input.file.type || undefined });
  if (uploadError) return { error: uploadError.message };

  const { error: insertError } = await supabase.from('rr_hub_assets').insert({
    idea_id: input.ideaId,
    asset_stage: input.stage,
    storage_path: path,
    file_name: input.file.name,
    mime_type: input.file.type || null,
    version_label: input.versionLabel,
  });
  return insertError ? { error: insertError.message } : {};
}

export async function signedAssetUrl(path: string): Promise<string | null> {
  const supabase = createClient();
  if (!supabase || !path || /^https?:\/\//.test(path)) return path || null;
  // Wundeer deliveries are intentionally shared with the public workspace.
  // Use the bucket URL directly instead of creating a misleading expiring URL.
  return supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl || null;
}

/**
 * Next human-readable code for a project+type: O1, O2 for organic and P1, P2 for
 * paid. Codes let people reference a piece out loud or in an email, so every
 * idea gets one at creation instead of staying anonymous.
 */
export async function nextIdeaCode(projectId: string, contentType: 'organic' | 'paid'): Promise<string> {
  const supabase = createClient();
  const prefix = contentType === 'organic' ? 'O' : 'P';
  if (!supabase) return `${prefix}1`;
  const { data } = await supabase.from('rr_hub_ideas').select('code').eq('project_id', projectId);
  const max = (data ?? []).reduce((highest, row: any) => {
    const match = String(row.code ?? '').match(new RegExp(`^${prefix}(\\d+)$`));
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0);
  return `${prefix}${max + 1}`;
}

/**
 * Light-weight reference check. Cross-origin HEAD calls are opaque, so a
 * failure here means "not obviously a URL", not "definitely broken". We only
 * reject text that cannot be a link at all.
 */
export function looksLikeUrl(value: string): boolean {
  const text = value.trim();
  if (!text) return true;
  try {
    const url = new URL(text);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * A deterministic first draft keeps the workspace useful even without an AI
 * key. It is deliberately editable: a future provider can replace this with
 * a richer draft without changing the data model or the team workflow.
 */
export function buildIdeaPack(input: { title: string; objective: string; description: string; reference: string }) {
  const title = input.title.trim() || 'la pieza';
  const objective = input.objective.trim() || 'conectar la pieza con la audiencia';
  const concept = input.description.trim() || 'la referencia visual seleccionada';
  return {
    camera: `Plano de apertura que sitúe ${title}. Sigue la energía de la referencia y prioriza textura, producto y un cierre limpio. Objetivo de cámara: ${objective}.`,
    talent: `Actitud natural y segura. Vestuario coherente con ${title}; evita gestos sobreactuados. Revisa la referencia antes de rodar.`,
    edit: `Ritmo directo: abre con el gesto o detalle más fuerte, conserva una idea por plano y cierra con la acción principal. Mantén como guía: ${concept}.`,
    script: `TÍTULO: ${title}\n\nOBJETIVO\n${objective}\n\n1. GANCHO (0–2 s)\nMuestra el detalle o acción más atractiva de la referencia.\n\n2. DESARROLLO (2–8 s)\nCuenta una sola idea: ${concept}.\n\n3. CIERRE (8–12 s)\nTermina con producto, gesto o mensaje claro que conecte con el objetivo.\n\nREFERENCIA\n${input.reference.trim() || 'Pendiente de enlace visual.'}`,
  };
}
