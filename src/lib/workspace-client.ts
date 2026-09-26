'use client';

import { createClient } from '@/lib/supabase/client';
import { ROLE_LABEL, allowedTransitions, type RoleKey, type WorkflowStatus } from '@/lib/flow';

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
  // The check below is for the UI only: it greys out buttons the person cannot
  // use, so they get an explanation instead of a silent failure. It is NOT a
  // security control. The real one runs on the server, in
  // api/workspace/transition, which reads the caller's real role from
  // rr_hub_access and ignores the status posted from here.
  //
  // The previous version of this comment claimed a hand-crafted request could
  // not skip states. It could: the write went straight to Supabase with the
  // anon key, so this function was the only thing between the request and the
  // table, and the requester did not have to run it.
  const from = (input.fromStatus ?? 'draft') as WorkflowStatus;
  const to = input.toStatus as WorkflowStatus;
  const permitted = allowedTransitions(input.role, from).some((move) => move.to === to);
  if (!permitted) {
    return { error: `Tu rol (${ROLE_LABEL[input.role]}) no puede pasar de ${from} a ${to}.` };
  }

  const response = await postWorkspaceAction('transition', {
    ideaId: input.ideaId, toStatus: to, fromStatus: from, note: input.note,
  });
  return response ?? {};
}

/** Shared call into the server-side workspace API. */
async function postWorkspaceAction(action: string, body: Record<string, unknown>): Promise<{ error?: string } | null> {
  const supabase = createClient();
  if (!supabase) return { error: 'Supabase no está configurado en este entorno.' };

  const { data: sessionData } = await supabase.auth.getSession();
  const response = await fetch(`/api/workspace/${action}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      // The session token is what lets the server look up the real role. Without
      // it the route answers 401 rather than trusting anything sent by the page.
      ...(sessionData.session?.access_token ? { authorization: `Bearer ${sessionData.session.access_token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (response.ok) return null;
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  return { error: payload?.error ?? `La operación falló (${response.status}).` };
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
  // `roleLabel` used to be written straight into the row, so the browser chose
  // how a comment was attributed — anyone could post as "Owner". The server
  // ignores it and uses the caller's real role from rr_hub_access.
  const response = await postWorkspaceAction('comment', { ideaId: input.ideaId, body: input.body });
  return response ?? {};
}

export async function resolveComment(input: { commentId: string; ideaId: string; resolved: boolean }): Promise<{ error?: string }> {
  const response = await postWorkspaceAction('resolve-comment', {
    commentId: input.commentId, ideaId: input.ideaId, resolved: input.resolved,
  });
  return response ?? {};
}

/** Idea creation, including the sequential `code`. The server owns both. */
export async function createIdea(input: {
  projectSlug: string; title: string; description: string; objective: string;
  contentType: 'organic' | 'paid'; category: string; referenceUrls: string[];
  cameraBrief: string; talentBrief: string; editBrief: string; script: string;
}): Promise<{ error?: string; id?: string }> {
  const supabase = createClient();
  if (!supabase) return { error: 'Supabase no está configurado en este entorno.' };
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return { error: 'Necesitas una sesión para crear una idea.' };

  const response = await fetch('/api/workspace/create-idea', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${sessionData.session.access_token}`,
    },
    body: JSON.stringify(input),
  });
  const payload = (await response.json().catch(() => null)) as { error?: string; id?: string } | null;
  if (!response.ok) return { error: payload?.error ?? `No se pudo crear la idea (${response.status}).` };
  return { id: payload?.id };
}

export async function saveIdeaScript(input: { ideaId: string; script: string; role: RoleKey }): Promise<{ error?: string }> {
  // Saving a script is not a state transition. The original version stamped a
  // `script_in_progress` event on every save, so the traceability timeline
  // listed moves that never happened. The server route writes no event either.
  const response = await postWorkspaceAction('script', { ideaId: input.ideaId, script: input.script });
  return response ?? {};
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
  // The session id is part of the path because the server checks for it: it
  // ties the stored object to whoever uploaded it, so a member of one project
  // cannot register an asset inside another's folder.
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) return { error: 'Necesitas una sesión para subir archivos.' };

  const path = `${input.projectSlug}/${input.ideaId}/${input.stage}/${userId}-${Date.now()}-${safeName}`;

  // The bytes go up from the browser on purpose: that request carries the
  // session token, so the RLS policies on storage.objects are what decide
  // whether this person may write here. The metadata row then goes through the
  // server route, which checks the path belongs to this idea.
  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, input.file, { upsert: false, contentType: input.file.type || undefined });
  if (uploadError) return { error: uploadError.message };

  // Only record the asset once the bytes are actually there. The other order
  // left a row pointing at an object that was never uploaded, which then
  // rendered as a broken image instead of an error.
  const response = await postWorkspaceAction('asset', {
    ideaId: input.ideaId, path, stage: input.stage,
    fileName: input.file.name, mimeType: input.file.type, versionLabel: input.versionLabel,
  });
  return response ?? {};
}

export async function signedAssetUrl(path: string): Promise<string | null> {
  const supabase = createClient();
  if (!supabase || !path || /^https?:\/\//.test(path)) return path || null;
  // Wundeer deliveries are intentionally shared with the public workspace.
  // Use the bucket URL directly instead of creating a misleading expiring URL.
  //
  // `getPublicUrl` never fails: it builds a string from the path whether or not
  // the bucket or the object exists, so a dead asset rendered as a broken image
  // with no error anywhere. Listing the containing folder is the cheap way to
  // find out — `download()` would pull the whole file (up to 100 MB) just to
  // learn that it is there.
  const folder = path.slice(0, path.lastIndexOf('/') + 1);
  const file = path.slice(path.lastIndexOf('/') + 1);
  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).list(folder, { search: file });
  if (error || !data?.some((entry) => entry.name === file)) return null;
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
