-- Content Hub isolated from existing RR CRM tables in public.*
-- Safe to apply to the current Supabase project: only creates rr_hub_* objects.

create table if not exists public.rr_hub_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text unique,
  global_role text not null default 'member' check (global_role in ('admin', 'member')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rr_hub_projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  client_name text not null,
  description text,
  brand_primary_color text not null default '#be076d',
  created_at timestamptz not null default now()
);

create table if not exists public.rr_hub_access (
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.rr_hub_projects(id) on delete cascade,
  role_in_project text not null check (role_in_project in ('owner','creator','camera','model','editor','publisher','media_buyer','client_approver','client_viewer')),
  granted_at timestamptz not null default now(),
  primary key (user_id, project_id)
);

create table if not exists public.rr_hub_ideas (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.rr_hub_projects(id) on delete cascade,
  code text,
  title text not null,
  description text,
  objective text,
  content_type text not null check (content_type in ('organic','paid')),
  category text,
  status text not null default 'draft' check (status in ('draft','pending_approval','needs_changes','approved','script_in_progress','pending_script_review','script_approved','in_production','raw_uploaded','editing','ready_to_publish','published','closed')),
  priority text not null default 'normal' check (priority in ('high','normal')),
  created_by uuid references auth.users(id),
  reference_urls jsonb not null default '[]',
  camera_brief text,
  talent_brief text,
  edit_brief text,
  script_content text,
  script_drive_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rr_hub_events (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.rr_hub_ideas(id) on delete cascade,
  actor_id uuid references auth.users(id),
  from_status text,
  to_status text not null,
  comment text,
  created_at timestamptz not null default now()
);

create table if not exists public.rr_hub_comments (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.rr_hub_ideas(id) on delete cascade,
  author_id uuid references auth.users(id),
  body text not null,
  role_label text not null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.rr_hub_assets (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.rr_hub_ideas(id) on delete cascade,
  uploaded_by uuid references auth.users(id),
  asset_stage text not null check (asset_stage in ('reference_brief','script','raw','edit_v1','edit_v2','edit_final','publication_evidence')),
  storage_path text,
  external_url text,
  file_name text not null,
  mime_type text,
  version_label text not null default 'v1',
  created_at timestamptz not null default now(),
  check (storage_path is not null or external_url is not null)
);

create or replace function public.rr_hub_handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.rr_hub_profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'), new.email)
  on conflict (id) do update set full_name = excluded.full_name, email = excluded.email, updated_at = now();
  return new;
end;
$$;

drop trigger if exists rr_hub_auth_user_created on auth.users;
create trigger rr_hub_auth_user_created after insert on auth.users
for each row execute procedure public.rr_hub_handle_new_user();

create or replace function public.rr_hub_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.rr_hub_profiles where id = auth.uid() and global_role = 'admin');
$$;

alter table public.rr_hub_profiles enable row level security;
alter table public.rr_hub_projects enable row level security;
alter table public.rr_hub_access enable row level security;
alter table public.rr_hub_ideas enable row level security;
alter table public.rr_hub_events enable row level security;
alter table public.rr_hub_comments enable row level security;
alter table public.rr_hub_assets enable row level security;

create policy "rr hub profile own or admin" on public.rr_hub_profiles for select using ((id = auth.uid()) or public.rr_hub_is_admin());
create policy "rr hub admins manage profiles" on public.rr_hub_profiles for all using (public.rr_hub_is_admin()) with check (public.rr_hub_is_admin());
create policy "rr hub members read projects" on public.rr_hub_projects for select using (public.rr_hub_is_admin() or exists (select 1 from public.rr_hub_access a where a.project_id = id and a.user_id = auth.uid()));
create policy "rr hub admins manage projects" on public.rr_hub_projects for all using (public.rr_hub_is_admin()) with check (public.rr_hub_is_admin());
create policy "rr hub members read access" on public.rr_hub_access for select using (user_id = auth.uid() or public.rr_hub_is_admin());
create policy "rr hub admins manage access" on public.rr_hub_access for all using (public.rr_hub_is_admin()) with check (public.rr_hub_is_admin());
create policy "rr hub members read ideas" on public.rr_hub_ideas for select using (public.rr_hub_is_admin() or exists (select 1 from public.rr_hub_access a where a.project_id = project_id and a.user_id = auth.uid()));
create policy "rr hub creators insert ideas" on public.rr_hub_ideas for insert with check (public.rr_hub_is_admin() or exists (select 1 from public.rr_hub_access a where a.project_id = project_id and a.user_id = auth.uid() and a.role_in_project in ('owner','creator')));
create policy "rr hub members update ideas" on public.rr_hub_ideas for update using (public.rr_hub_is_admin() or exists (select 1 from public.rr_hub_access a where a.project_id = project_id and a.user_id = auth.uid()));
create policy "rr hub members read comments" on public.rr_hub_comments for select using (exists (select 1 from public.rr_hub_ideas i join public.rr_hub_access a on a.project_id = i.project_id where i.id = idea_id and a.user_id = auth.uid()) or public.rr_hub_is_admin());
create policy "rr hub members add comments" on public.rr_hub_comments for insert with check (exists (select 1 from public.rr_hub_ideas i join public.rr_hub_access a on a.project_id = i.project_id where i.id = idea_id and a.user_id = auth.uid()) or public.rr_hub_is_admin());
create policy "rr hub members read assets" on public.rr_hub_assets for select using (exists (select 1 from public.rr_hub_ideas i join public.rr_hub_access a on a.project_id = i.project_id where i.id = idea_id and a.user_id = auth.uid()) or public.rr_hub_is_admin());
create policy "rr hub members add assets" on public.rr_hub_assets for insert with check (exists (select 1 from public.rr_hub_ideas i join public.rr_hub_access a on a.project_id = i.project_id where i.id = idea_id and a.user_id = auth.uid()) or public.rr_hub_is_admin());
