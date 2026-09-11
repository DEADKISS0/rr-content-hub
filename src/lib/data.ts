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
