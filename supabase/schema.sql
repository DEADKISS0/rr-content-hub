create extension if not exists "pgcrypto";

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(), name text not null, slug text unique not null,
  client_name text not null, description text, brand_primary_color text default '#be076d',
  brand_secondary_color text default '#ded116', created_at timestamptz not null default now()
);
create table if not exists public.user_project_access (
  user_id uuid references auth.users(id) on delete cascade, project_id uuid references public.projects(id) on delete cascade,
  role_in_project text not null default 'viewer', granted_at timestamptz not null default now(), primary key(user_id, project_id)
);
create table if not exists public.content_ideas (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade,
  title text not null, description text, objective text, content_type text not null check (content_type in ('organic','paid')),
  category text, status text not null default 'draft', priority text not null default 'normal', created_by uuid references auth.users(id),
  approved_by uuid references auth.users(id), approved_at timestamptz, publish_date date, reference_urls jsonb not null default '[]',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.content_events (
  id uuid primary key default gen_random_uuid(), idea_id uuid not null references public.content_ideas(id) on delete cascade,
  actor_id uuid references auth.users(id), from_status text, to_status text not null, comment text, created_at timestamptz not null default now()
);
create index if not exists content_ideas_project_status_idx on public.content_ideas(project_id, status);

alter table public.projects enable row level security;
alter table public.user_project_access enable row level security;
alter table public.content_ideas enable row level security;
alter table public.content_events enable row level security;
create policy "members read projects" on public.projects for select using (exists (select 1 from public.user_project_access a where a.project_id=id and a.user_id=auth.uid()));
create policy "members read access" on public.user_project_access for select using (user_id=auth.uid());
create policy "members read ideas" on public.content_ideas for select using (exists (select 1 from public.user_project_access a where a.project_id=content_ideas.project_id and a.user_id=auth.uid()));
create policy "members create ideas" on public.content_ideas for insert with check (exists (select 1 from public.user_project_access a where a.project_id=content_ideas.project_id and a.user_id=auth.uid() and a.role_in_project in ('admin','creator')));
create policy "members update ideas" on public.content_ideas for update using (exists (select 1 from public.user_project_access a where a.project_id=content_ideas.project_id and a.user_id=auth.uid() and a.role_in_project in ('admin','creator','client_approver')));
