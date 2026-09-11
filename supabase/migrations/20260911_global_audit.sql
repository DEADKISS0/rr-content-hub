-- Global audit mode (2026-09-11)
-- One master switch opens READ-ONLY access to every project for external audit.
-- Google login is untouched: this is a parallel public door, gated by RLS only.

create table if not exists public.rr_hub_audit_settings (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  opens_at timestamptz,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.rr_hub_audit_settings (id) values (true) on conflict (id) do nothing;

-- Single source of truth for "is public audit open right now".
create or replace function public.rr_hub_audit_enabled()
returns boolean language sql stable security definer set search_path = public as $fn$
  select coalesce((
    select s.enabled
       and (s.expires_at is null or now() < s.expires_at)
       and (s.opens_at  is null or now() >= s.opens_at)
    from public.rr_hub_audit_settings s where s.id = true
  ), false);
$fn$;

alter table public.rr_hub_audit_settings enable row level security;
drop policy if exists rr_hub_audit_settings_admin on public.rr_hub_audit_settings;
create policy rr_hub_audit_settings_admin on public.rr_hub_audit_settings for all using (public.rr_hub_is_admin()) with check (public.rr_hub_is_admin());
drop policy if exists rr_hub_audit_settings_read on public.rr_hub_audit_settings;
create policy rr_hub_audit_settings_read on public.rr_hub_audit_settings for select to anon using (true);

-- Re-point the audit policies at the global switch (all projects, not just flagged).
drop policy if exists rr_hub_projects_audit on public.rr_hub_projects;
create policy rr_hub_projects_audit on public.rr_hub_projects for select to anon using (public.rr_hub_audit_enabled());

drop policy if exists rr_hub_ideas_audit on public.rr_hub_ideas;
create policy rr_hub_ideas_audit on public.rr_hub_ideas for select to anon using (public.rr_hub_audit_enabled() and exists (select 1 from public.rr_hub_projects p where p.id = rr_hub_ideas.project_id));

drop policy if exists rr_hub_events_audit on public.rr_hub_events;
create policy rr_hub_events_audit on public.rr_hub_events for select to anon using (public.rr_hub_audit_enabled() and exists (select 1 from public.rr_hub_ideas i where i.id = rr_hub_events.idea_id));

drop policy if exists rr_hub_comments_audit on public.rr_hub_comments;
create policy rr_hub_comments_audit on public.rr_hub_comments for select to anon using (public.rr_hub_audit_enabled() and exists (select 1 from public.rr_hub_ideas i where i.id = rr_hub_comments.idea_id));

drop policy if exists rr_hub_assets_audit on public.rr_hub_assets;
create policy rr_hub_assets_audit on public.rr_hub_assets for select to anon using (public.rr_hub_audit_enabled() and exists (select 1 from public.rr_hub_ideas i where i.id = rr_hub_assets.idea_id));

-- Administrative read-only surface: team roster, access matrix and pending invites.
drop policy if exists rr_hub_profiles_audit on public.rr_hub_profiles;
create policy rr_hub_profiles_audit on public.rr_hub_profiles for select to anon using (public.rr_hub_audit_enabled());

drop policy if exists rr_hub_access_audit on public.rr_hub_access;
create policy rr_hub_access_audit on public.rr_hub_access for select to anon using (public.rr_hub_audit_enabled());

drop policy if exists rr_hub_invites_audit on public.rr_hub_invites;
create policy rr_hub_invites_audit on public.rr_hub_invites for select to anon using (public.rr_hub_audit_enabled());

-- Keep the legacy flag consistent for display purposes.
update public.rr_hub_projects set public_audit = true;

-- OPEN the window for the external audit (read-only). Change the interval to
-- extend, or set enabled = false to close immediately.
update public.rr_hub_audit_settings
   set enabled = true,
       expires_at = now() + interval '7 days',
       updated_at = now()
 where id = true;
