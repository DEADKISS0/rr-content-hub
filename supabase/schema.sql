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
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(), idea_id uuid not null references public.content_ideas(id) on delete cascade,
  author_id uuid references auth.users(id), body text not null, role_label text not null default 'RR ALIADOS',
  resolved_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.content_assets (
  id uuid primary key default gen_random_uuid(), idea_id uuid not null references public.content_ideas(id) on delete cascade,
  uploaded_by uuid references auth.users(id), storage_path text not null, file_name text not null, mime_type text,
  version_label text not null default 'v1', created_at timestamptz not null default now()
);
create table if not exists public.idea_versions (
  id uuid primary key default gen_random_uuid(), idea_id uuid not null references public.content_ideas(id) on delete cascade,
  version_number integer not null, title text not null, brief jsonb not null default '{}', created_by uuid references auth.users(id),
  approval_status text not null default 'draft', created_at timestamptz not null default now(), unique(idea_id, version_number)
);
create table if not exists public.production_tasks (
  id uuid primary key default gen_random_uuid(), idea_id uuid not null references public.content_ideas(id) on delete cascade,
  assignee_id uuid references auth.users(id), role_label text not null, task text not null, status text not null default 'todo',
  due_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.publications (
  id uuid primary key default gen_random_uuid(), idea_id uuid not null references public.content_ideas(id) on delete cascade,
  platform text not null, post_url text, published_at timestamptz, caption text, metrics jsonb not null default '{}',
  created_by uuid references auth.users(id), created_at timestamptz not null default now()
);
create index if not exists content_ideas_project_status_idx on public.content_ideas(project_id, status);
create index if not exists comments_idea_created_idx on public.comments(idea_id, created_at);
create index if not exists production_tasks_idea_status_idx on public.production_tasks(idea_id, status);

alter table public.projects enable row level security;
alter table public.user_project_access enable row level security;
alter table public.content_ideas enable row level security;
alter table public.content_events enable row level security;
alter table public.comments enable row level security;
alter table public.content_assets enable row level security;
alter table public.idea_versions enable row level security;
alter table public.production_tasks enable row level security;
alter table public.publications enable row level security;
create policy "members read projects" on public.projects for select using (exists (select 1 from public.user_project_access a where a.project_id=id and a.user_id=auth.uid()));
create policy "members read access" on public.user_project_access for select using (user_id=auth.uid());
create policy "members read ideas" on public.content_ideas for select using (exists (select 1 from public.user_project_access a where a.project_id=content_ideas.project_id and a.user_id=auth.uid()));
create policy "members create ideas" on public.content_ideas for insert with check (exists (select 1 from public.user_project_access a where a.project_id=content_ideas.project_id and a.user_id=auth.uid() and a.role_in_project in ('admin','creator')));
create policy "members update ideas" on public.content_ideas for update using (exists (select 1 from public.user_project_access a where a.project_id=content_ideas.project_id and a.user_id=auth.uid() and a.role_in_project in ('admin','creator','client_approver')));
create policy "members read comments" on public.comments for select using (exists (select 1 from public.content_ideas i join public.user_project_access a on a.project_id=i.project_id where i.id=comments.idea_id and a.user_id=auth.uid()));
create policy "members create comments" on public.comments for insert with check (exists (select 1 from public.content_ideas i join public.user_project_access a on a.project_id=i.project_id where i.id=comments.idea_id and a.user_id=auth.uid()));
create policy "members update comments" on public.comments for update using (author_id=auth.uid() or exists (select 1 from public.content_ideas i join public.user_project_access a on a.project_id=i.project_id where i.id=comments.idea_id and a.user_id=auth.uid() and a.role_in_project in ('admin','creator','client_approver')));
create policy "members read assets" on public.content_assets for select using (exists (select 1 from public.content_ideas i join public.user_project_access a on a.project_id=i.project_id where i.id=content_assets.idea_id and a.user_id=auth.uid()));
create policy "members create assets" on public.content_assets for insert with check (exists (select 1 from public.content_ideas i join public.user_project_access a on a.project_id=i.project_id where i.id=content_assets.idea_id and a.user_id=auth.uid()));
create policy "members read versions" on public.idea_versions for select using (exists (select 1 from public.content_ideas i join public.user_project_access a on a.project_id=i.project_id where i.id=idea_versions.idea_id and a.user_id=auth.uid()));
create policy "members manage production" on public.production_tasks for all using (exists (select 1 from public.content_ideas i join public.user_project_access a on a.project_id=i.project_id where i.id=production_tasks.idea_id and a.user_id=auth.uid()));
create policy "members read publications" on public.publications for select using (exists (select 1 from public.content_ideas i join public.user_project_access a on a.project_id=i.project_id where i.id=publications.idea_id and a.user_id=auth.uid()));
