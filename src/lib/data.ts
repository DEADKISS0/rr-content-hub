import { createClient } from '@/lib/supabase/server';
import { demoIdeas, demoProjects, getDemoIdea, getDemoProject } from './demo-data';

export async function getCurrentUser() {
  const supabase = await createClient();
  if (!supabase) return { user: { id: 'demo-user', email: 'demo@rraliados.co', user_metadata: { full_name: 'Modo demo' } }, supabase: null };
  const { data: { user } } = await supabase.auth.getUser();
  return { user, supabase };
}

export async function getProject(slug: string) {
  const supabase = await createClient();
  if (!supabase) return { project: getDemoProject(slug), access: { role_in_project: 'admin' }, supabase: null };
  const { data: project } = await supabase.from('projects').select('*').eq('slug', slug).single();
  if (!project) return { project: null, access: null, supabase };
  const { data: { user } } = await supabase.auth.getUser();
  const { data: access } = user ? await supabase.from('user_project_access').select('role_in_project').eq('user_id', user.id).eq('project_id', project.id).single() : { data: null };
  return { project, access, supabase };
}

export async function getProjects() {
  const supabase = await createClient();
  if (!supabase) return { projects: demoProjects.map((project) => ({ ...project, role_in_project: 'admin' })), supabase: null };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { projects: [], supabase };
  const { data } = await supabase.from('user_project_access').select('project_id, role_in_project, projects(id, name, slug, client_name, brand_primary_color, logo_url, description)').eq('user_id', user.id);
  return { projects: data ?? [], supabase };
}

export async function getIdeas(projectId: string) {
  const supabase = await createClient();
  if (!supabase) return demoIdeas;
  const { data } = await supabase.from('content_ideas').select('id, title, description, content_type, category, status, priority, created_at, approved_at, publish_date, users!content_ideas_created_by_fkey(name)').eq('project_id', projectId).order('created_at', { ascending: false });
  return data ?? [];
}

export async function getIdea(projectId: string, id: string) {
  const supabase = await createClient();
  if (!supabase) return getDemoIdea(id);
  const { data } = await supabase.from('content_ideas').select('*').eq('project_id', projectId).eq('id', id).single();
  return data;
}
