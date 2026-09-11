-- RR Content Hub: identidad, roles y flujo auditable.
-- Aplicar después de schema.sql desde Supabase SQL Editor o Supabase CLI.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text unique,
  global_role text not null default 'member' check (global_role in ('admin', 'member')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_project_access
  drop constraint if exists user_project_access_role_in_project_check;
alter table public.user_project_access
  add constraint user_project_access_role_in_project_check check (role_in_project in ('owner','creator','camera','model','editor','publisher','media_buyer','client_approver','client_viewer'));

alter table public.content_ideas
  drop constraint if exists content_ideas_status_check;
alter table public.content_ideas
  add constraint content_ideas_status_check check (status in (
    'draft','pending_approval','needs_changes','approved','script_in_progress',
    'pending_script_review','script_approved','in_production','raw_uploaded',
    'editing','ready_to_publish','published','closed'
  ));

alter table public.content_assets add column if not exists asset_stage text not null default 'reference_brief'
  check (asset_stage in ('reference_brief','script','raw','edit_v1','edit_v2','edit_final','publication_evidence'));
alter table public.content_assets add column if not exists external_url text;
alter table public.content_ideas add column if not exists camera_brief text;
alter table public.content_ideas add column if not exists talent_brief text;
alter table public.content_ideas add column if not exists edit_brief text;
alter table public.content_ideas add column if not exists script_content text;
alter table public.content_ideas add column if not exists script_drive_url text;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'), new.email)
  on conflict (id) do update set full_name = excluded.full_name, email = excluded.email, updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.is_global_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and global_role = 'admin');
$$;

alter table public.profiles enable row level security;
create policy "users read own profile" on public.profiles for select using (id = auth.uid() or public.is_global_admin());
create policy "admins manage profiles" on public.profiles for all using (public.is_global_admin()) with check (public.is_global_admin());
create policy "admins manage project access" on public.user_project_access for all using (public.is_global_admin()) with check (public.is_global_admin());

-- Storage is private by default. Create the bucket in the dashboard as `rr-content-assets`.
-- Policy checks project membership through content_assets metadata, never a public URL.
