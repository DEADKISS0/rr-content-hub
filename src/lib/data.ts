import { createClient } from '@/lib/supabase/server';
import { demoIdeas, demoProjects, getDemoIdea, getDemoProject } from './demo-data';

/**
 * Data access layer for the RR Content Hub.
 *
 * The hub lives in the same Supabase project as other RR tools, so every table
 * it owns is prefixed `rr_hub_`. These helpers never read the legacy CRM tables.
 * When Supabase env vars are absent the app falls back to demo data so the UI
 * stays reviewable without credentials.
 */

type RawIdea = Record<string, unknown>;

/** Maps an `rr_hub_ideas` row onto the field names the UI already consumes. */
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
    camera: (row.camera_brief as string) ?? '',
    talent: (row.talent_brief as string) ?? '',
    edit: (row.edit_brief as string) ?? '',
    script_content: (row.script_content as string) ?? '',
  };
}

export async function getCurrentUser() {
  const supabase = await createClient();
  if (!supabase) {
    return {
      user: { id: 'demo-user', email: 'demo@rraliados.co', user_metadata: { full_name: 'Modo demo' } },
      supabase: null,
    };
  }
  const { data: { user } } = await supabase.auth.getUser();
  return { user, supabase };
}

export async function getProject(slug: string) {
  const supabase = await createClient();
  if (!supabase) return { project: getDemoProject(slug), access: { role_in_project: 'admin' }, supabase: null };

  const { data: project } = await supabase
    .from('rr_hub_projects')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (!project) return { project: null, access: null, supabase };

  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from('rr_hub_profiles')
      .select('global_role')
      .eq('id', user.id)
      .maybeSingle();
    if (profile?.global_role === 'admin') {
      return { project, access: { role_in_project: 'owner' }, supabase };
    }
  }

  const { data: access } = user
    ? await supabase
        .from('rr_hub_access')
        .select('role_in_project')
        .eq('user_id', user.id)
        .eq('project_id', project.id)
        .maybeSingle()
    : { data: null };

  return { project, access, supabase };
}

export async function getProjects() {
  const supabase = await createClient();
  if (!supabase) {
    return { projects: demoProjects.map((project) => ({ ...project, role_in_project: 'admin' })), supabase: null };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { projects: [], supabase };

  const { data: profile } = await supabase
    .from('rr_hub_profiles')
    .select('global_role')
    .eq('id', user.id)
    .maybeSingle();

  // Global admins supervise every project even without an explicit access row.
  if (profile?.global_role === 'admin') {
    const { data: allProjects } = await supabase
      .from('rr_hub_projects')
      .select('id, name, slug, client_name, brand_primary_color, description')
      .order('name');
    return {
      projects: (allProjects ?? []).map((project) => ({ projects: project, role_in_project: 'owner' })),
      supabase,
    };
  }

  const { data } = await supabase
    .from('rr_hub_access')
    .select('role_in_project, projects:rr_hub_projects(id, name, slug, client_name, brand_primary_color, description)')
    .eq('user_id', user.id);

  return { projects: data ?? [], supabase };
}

export async function getIdeas(projectId: string) {
  const supabase = await createClient();
  if (!supabase) return demoIdeas;

  const { data } = await supabase
    .from('rr_hub_ideas')
    .select('id, code, title, description, objective, content_type, category, status, priority, created_at, reference_urls, camera_brief, talent_brief, edit_brief, script_content')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  return (data ?? []).map(mapIdea);
}

export async function getIdea(projectId: string, id: string) {
  const supabase = await createClient();
  if (!supabase) return getDemoIdea(id);

  const { data } = await supabase
    .from('rr_hub_ideas')
    .select('*')
    .eq('project_id', projectId)
    .eq('id', id)
    .maybeSingle();

  return data ? mapIdea(data) : null;
}

/**
 * Public audit reads. These use the same anonymous client; RLS turns every
 * read below into an anon-only, read-only view while the global audit switch
 * is open, so nothing leaks and nothing can be written.
 */
export async function getAuditSettings() {
  const supabase = await createClient();
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
  const supabase = await createClient();
  if (!supabase) return demoProjects;
  const { data } = await supabase
    .from('rr_hub_projects')
    .select('id, name, slug, client_name, description, brand_primary_color')
    .order('name');
  return data ?? [];
}

/** Read-only administrative surface: roster, access matrix and pending invites. */
export async function getAuditRoster() {
  const supabase = await createClient();
  if (!supabase) return { profiles: [], access: [], invites: [] };
  const [profiles, access, invites] = await Promise.all([
    supabase.from('rr_hub_profiles').select('id, email, full_name, global_role, created_at').order('email'),
    supabase.from('rr_hub_access').select('user_id, project_id, role_in_project, granted_at'),
    supabase.from('rr_hub_invites').select('email, project_id, role_in_project').order('email'),
  ]);
  return { profiles: profiles.data ?? [], access: access.data ?? [], invites: invites.data ?? [] };
}

export async function getAuditProject(slug: string) {
  const supabase = await createClient();
  if (!supabase) return getDemoProject(slug) ?? null;
  const { data } = await supabase
    .from('rr_hub_projects')
    .select('id, name, slug, client_name, description, brand_primary_color, public_audit')
    .eq('slug', slug)
    .maybeSingle();
  return data ?? null;
}

export async function getAuditIdeas(projectId: string) {
  const supabase = await createClient();
  if (!supabase) return demoIdeas;
  const { data } = await supabase
    .from('rr_hub_ideas')
    .select('id, code, title, description, objective, content_type, category, status, priority, created_at, updated_at, reference_urls, camera_brief, talent_brief, edit_brief, script_content')
    .eq('project_id', projectId)
    .order('code', { ascending: true });
  return (data ?? []).map(mapIdea);
}

export async function getAuditIdea(projectId: string, id: string) {
  const supabase = await createClient();
  if (!supabase) return getDemoIdea(id);
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
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from('rr_hub_events')
    .select('id, to_status, comment, created_at, actor:rr_hub_profiles(full_name, email)')
    .eq('idea_id', ideaId)
    .order('created_at', { ascending: false });
  return (data ?? []).map((row: any) => ({
    id: row.id as string,
    status: row.to_status as string,
    actor: (row.actor?.full_name as string) || (row.actor?.email as string) || 'RR ALIADOS',
    note: (row.comment as string) ?? '',
    createdAt: row.created_at as string,
  }));
}

export async function getAuditComments(ideaId: string) {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from('rr_hub_comments')
    .select('id, body, role_label, resolved_at, created_at, author:rr_hub_profiles(full_name, email)')
    .eq('idea_id', ideaId)
    .order('created_at', { ascending: true });
  return (data ?? []).map((row: any) => ({
    id: row.id as string,
    author: (row.author?.full_name as string) || (row.author?.email as string) || 'RR ALIADOS',
    role: row.role_label as string,
    body: row.body as string,
    resolved: Boolean(row.resolved_at),
    createdAt: row.created_at as string,
  }));
}

export async function getAuditAssets(ideaId: string) {
  const supabase = await createClient();
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
