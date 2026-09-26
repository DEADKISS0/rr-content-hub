-- Security fix: anonymous visitors were able to UPDATE rr_hub_ideas.
--
-- Why this exists
-- ---------------
-- 20260911_wundeer_collaborative_mode.sql granted anon:
--   for insert to anon / for update to anon
-- on rr_hub_ideas, scoped only by "project is wundeer". A browser role picker
-- is UX, not identity, so anyone with the link could rewrite any Wundeer idea.
-- Verified live against production: an anonymous PATCH to rr_hub_ideas
-- returned 204 and changed a real idea's title.
--
-- This migration keeps the collaboration read surface exactly as it was and
-- removes only the anonymous write paths, moving writes behind Supabase Auth.
-- Idempotent: every statement is drop-if-exists / create-policy.

-- ---------------------------------------------------------------------------
-- 1. Anonymous read stays (the public collaborative board is the product).
-- ---------------------------------------------------------------------------
drop policy if exists rr_hub_wundeer_public_project_read on public.rr_hub_projects;
create policy rr_hub_wundeer_public_project_read on public.rr_hub_projects
  for select to anon using (slug = 'wundeer');

drop policy if exists rr_hub_wundeer_public_ideas_read on public.rr_hub_ideas;
create policy rr_hub_wundeer_public_ideas_read on public.rr_hub_ideas
  for select to anon using (exists (select 1 from public.rr_hub_projects p where p.id = project_id and p.slug = 'wundeer'));

drop policy if exists rr_hub_wundeer_public_events_read on public.rr_hub_events;
create policy rr_hub_wundeer_public_events_read on public.rr_hub_events
  for select to anon using (public.rr_hub_is_wundeer_idea(idea_id));

drop policy if exists rr_hub_wundeer_public_comments_read on public.rr_hub_comments;
create policy rr_hub_wundeer_public_comments_read on public.rr_hub_comments
  for select to anon using (public.rr_hub_is_wundeer_idea(idea_id));

-- ---------------------------------------------------------------------------
-- 2. Anonymous writes are revoked.
-- ---------------------------------------------------------------------------
drop policy if exists rr_hub_wundeer_public_ideas_insert on public.rr_hub_ideas;
drop policy if exists rr_hub_wundeer_public_ideas_update on public.rr_hub_ideas;
drop policy if exists rr_hub_wundeer_public_events_insert on public.rr_hub_events;
drop policy if exists rr_hub_wundeer_public_comments_insert on public.rr_hub_comments;
drop policy if exists rr_hub_wundeer_public_comments_update on public.rr_hub_comments;

-- ---------------------------------------------------------------------------
-- 3. Authenticated collaborators keep their writes, still scoped to Wundeer.
--    Anyone with a session who can see the project may comment and move work;
--    creating an idea still requires an owner/creator/admin role.
-- ---------------------------------------------------------------------------
drop policy if exists rr_hub_wundeer_auth_events_insert on public.rr_hub_events;
create policy rr_hub_wundeer_auth_events_insert on public.rr_hub_events
  for insert to authenticated
  with check (public.rr_hub_is_wundeer_idea(idea_id));

drop policy if exists rr_hub_wundeer_auth_comments_insert on public.rr_hub_comments;
create policy rr_hub_wundeer_auth_comments_insert on public.rr_hub_comments
  for insert to authenticated
  with check (public.rr_hub_is_wundeer_idea(idea_id));

drop policy if exists rr_hub_wundeer_auth_comments_update on public.rr_hub_comments;
create policy rr_hub_wundeer_auth_comments_update on public.rr_hub_comments
  for update to authenticated
  using (public.rr_hub_is_wundeer_idea(idea_id))
  with check (public.rr_hub_is_wundeer_idea(idea_id));

drop policy if exists rr_hub_wundeer_auth_ideas_update on public.rr_hub_ideas;
create policy rr_hub_wundeer_auth_ideas_update on public.rr_hub_ideas
  for update to authenticated
  using (exists (select 1 from public.rr_hub_projects p where p.id = project_id and p.slug = 'wundeer')
         or public.rr_hub_is_admin())
  with check (exists (select 1 from public.rr_hub_projects p where p.id = project_id and p.slug = 'wundeer')
         or public.rr_hub_is_admin());

drop policy if exists rr_hub_wundeer_auth_ideas_insert on public.rr_hub_ideas;
create policy rr_hub_wundeer_auth_ideas_insert on public.rr_hub_ideas
  for insert to authenticated
  with check (public.rr_hub_is_admin()
         or exists (select 1 from public.rr_hub_access a
                    join public.rr_hub_projects p on p.id = a.project_id
                    where a.project_id = project_id and p.slug = 'wundeer'
                      and a.user_id = auth.uid() and a.role_in_project in ('owner','creator')));

-- ---------------------------------------------------------------------------
-- 4. No anonymous DELETE anywhere in the hub (none was granted before, this
--    only makes the invariant explicit so a future migration cannot miss it).
-- ---------------------------------------------------------------------------
revoke delete on public.rr_hub_ideas from anon, authenticated;
revoke delete on public.rr_hub_events from anon, authenticated;
revoke delete on public.rr_hub_comments from anon, authenticated;
revoke delete on public.rr_hub_assets from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Storage: the Wundeer prefix stays readable by collaborators, but uploads
--    require a session. The bucket is flagged public so a shared delivery link
--    opens without a login; that is intentional, and anon INSERT is removed.
-- ---------------------------------------------------------------------------
drop policy if exists rr_hub_wundeer_public_storage_insert on storage.objects;

drop policy if exists rr_hub_wundeer_auth_storage_insert on storage.objects;
create policy rr_hub_wundeer_auth_storage_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'rr-content-assets' and (name like 'wundeer/%' or public.rr_hub_is_admin()));

drop policy if exists rr_hub_wundeer_auth_storage_delete on storage.objects;
create policy rr_hub_wundeer_auth_storage_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'rr-content-assets' and public.rr_hub_is_admin());

-- ---------------------------------------------------------------------------
-- 6. Status values the app writes must stay inside the CHECK constraint.
--    'discarded' is used by the UI's clean-board filter but is NOT a valid
--    status: isCleanBoardIdea() filters by status list, so nothing can ever
--    reach it. Verify with:
--      select status, count(*) from public.rr_hub_ideas group by 1 order by 1;
-- ---------------------------------------------------------------------------
