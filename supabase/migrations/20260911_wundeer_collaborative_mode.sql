-- Wundeer collaborative mode: public, traceable work without Google login.
-- Deliberately scoped to project slug = 'wundeer'.  The selected browser role
-- is UX guidance, not an identity guarantee; every write records that label.

alter table public.rr_hub_events add column if not exists actor_label text;
alter table public.rr_hub_comments add column if not exists author_label text;

create or replace function public.rr_hub_is_wundeer_idea(candidate uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.rr_hub_ideas i
    join public.rr_hub_projects p on p.id = i.project_id
    where i.id = candidate and p.slug = 'wundeer'
  );
$$;

-- Remove the expiring audit-only access rules. The app no longer has an audit
-- surface; Wundeer is a collaborative public workspace.
drop policy if exists rr_hub_projects_audit on public.rr_hub_projects;
drop policy if exists rr_hub_ideas_audit on public.rr_hub_ideas;
drop policy if exists rr_hub_events_audit on public.rr_hub_events;
drop policy if exists rr_hub_comments_audit on public.rr_hub_comments;
drop policy if exists rr_hub_assets_audit on public.rr_hub_assets;
drop policy if exists rr_hub_profiles_audit on public.rr_hub_profiles;
drop policy if exists rr_hub_access_audit on public.rr_hub_access;
drop policy if exists rr_hub_invites_audit on public.rr_hub_invites;

drop policy if exists rr_hub_wundeer_public_project_read on public.rr_hub_projects;
create policy rr_hub_wundeer_public_project_read on public.rr_hub_projects
  for select to anon using (slug = 'wundeer');

drop policy if exists rr_hub_wundeer_public_ideas_read on public.rr_hub_ideas;
create policy rr_hub_wundeer_public_ideas_read on public.rr_hub_ideas
  for select to anon using (exists (select 1 from public.rr_hub_projects p where p.id = project_id and p.slug = 'wundeer'));

drop policy if exists rr_hub_wundeer_public_ideas_insert on public.rr_hub_ideas;
create policy rr_hub_wundeer_public_ideas_insert on public.rr_hub_ideas
  for insert to anon with check (exists (select 1 from public.rr_hub_projects p where p.id = project_id and p.slug = 'wundeer'));

drop policy if exists rr_hub_wundeer_public_ideas_update on public.rr_hub_ideas;
create policy rr_hub_wundeer_public_ideas_update on public.rr_hub_ideas
  for update to anon using (exists (select 1 from public.rr_hub_projects p where p.id = project_id and p.slug = 'wundeer'))
  with check (exists (select 1 from public.rr_hub_projects p where p.id = project_id and p.slug = 'wundeer'));

drop policy if exists rr_hub_wundeer_public_events_read on public.rr_hub_events;
create policy rr_hub_wundeer_public_events_read on public.rr_hub_events
  for select to anon using (public.rr_hub_is_wundeer_idea(idea_id));
drop policy if exists rr_hub_wundeer_public_events_insert on public.rr_hub_events;
create policy rr_hub_wundeer_public_events_insert on public.rr_hub_events
  for insert to anon with check (public.rr_hub_is_wundeer_idea(idea_id));

drop policy if exists rr_hub_wundeer_public_comments_read on public.rr_hub_comments;
create policy rr_hub_wundeer_public_comments_read on public.rr_hub_comments
  for select to anon using (public.rr_hub_is_wundeer_idea(idea_id));
drop policy if exists rr_hub_wundeer_public_comments_insert on public.rr_hub_comments;
create policy rr_hub_wundeer_public_comments_insert on public.rr_hub_comments
  for insert to anon with check (public.rr_hub_is_wundeer_idea(idea_id));
drop policy if exists rr_hub_wundeer_public_comments_update on public.rr_hub_comments;
create policy rr_hub_wundeer_public_comments_update on public.rr_hub_comments
  for update to anon using (public.rr_hub_is_wundeer_idea(idea_id)) with check (public.rr_hub_is_wundeer_idea(idea_id));

-- The database remains the source of truth. File uploads stay authenticated
-- only inside the Wundeer prefix. The bucket is intentionally public so any
-- collaborator can open a shared delivery without a signed-in session.
update storage.buckets set public = true where id = 'rr-content-assets';
drop policy if exists rr_hub_wundeer_public_storage_insert on storage.objects;
create policy rr_hub_wundeer_public_storage_insert on storage.objects
  for insert to anon with check (bucket_id = 'rr-content-assets' and name like 'wundeer/%');
drop policy if exists rr_hub_wundeer_public_storage_read on storage.objects;
create policy rr_hub_wundeer_public_storage_read on storage.objects
  for select to anon using (bucket_id = 'rr-content-assets' and name like 'wundeer/%');
