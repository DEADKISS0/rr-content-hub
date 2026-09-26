-- 20260926_close_anon_write.sql
-- Cierra la escritura anonima sobre el hub.
--
-- Contexto: 20260911_wundeer_collaborative_mode.sql concedio INSERT y UPDATE
-- al rol `anon`, de modo que cualquier visitante con el link podia crear ideas,
-- cambiar su estado de aprobacion y estampar comentarios sin credenciales.
-- Este archivo revierte solo la escritura; la lectura publica de Wundeer se
-- conserva a proposito (es el modo en que el hub se entrega hoy).
--
-- Idempotente: se puede reaplicar sin efecto adicional.

-- 1. Escritura anonima: fuera.
drop policy if exists rr_hub_wundeer_public_ideas_insert   on public.rr_hub_ideas;
drop policy if exists rr_hub_wundeer_public_ideas_update   on public.rr_hub_ideas;
drop policy if exists rr_hub_wundeer_public_events_insert  on public.rr_hub_events;
drop policy if exists rr_hub_wundeer_public_events_update  on public.rr_hub_events;
drop policy if exists rr_hub_wundeer_public_comments_insert on public.rr_hub_comments;
drop policy if exists rr_hub_wundeer_public_comments_update on public.rr_hub_comments;
drop policy if exists rr_hub_wundeer_public_assets_insert  on public.rr_hub_assets;
drop policy if exists rr_hub_wundeer_public_assets_update  on public.rr_hub_assets;

-- 2. Las politicas base de 20260910 son `for all` sin `to authenticated`,
--    asi que tambien alcanzaban a `anon`. Se reemplazan por pares explicitos
--    de lectura y escritura: lectura para quien tiene acceso, escritura solo
--    para autenticados con rol en el proyecto.
drop policy if exists rr_hub_ideas_read   on public.rr_hub_ideas;
drop policy if exists rr_hub_ideas_update  on public.rr_hub_ideas;
drop policy if exists rr_hub_ideas_insert  on public.rr_hub_ideas;

create policy rr_hub_ideas_read on public.rr_hub_ideas
  for select to authenticated
  using (public.rr_hub_is_admin() or exists (
    select 1 from public.rr_hub_access a
    where a.project_id = rr_hub_ideas.project_id and a.user_id = auth.uid()));

create policy rr_hub_ideas_write on public.rr_hub_ideas
  for all to authenticated
  using (public.rr_hub_is_admin() or exists (
    select 1 from public.rr_hub_access a
    where a.project_id = rr_hub_ideas.project_id and a.user_id = auth.uid()))
  with check (public.rr_hub_is_admin() or exists (
    select 1 from public.rr_hub_access a
    where a.project_id = rr_hub_ideas.project_id and a.user_id = auth.uid()));

drop policy if exists rr_hub_comments_read   on public.rr_hub_comments;
drop policy if exists rr_hub_comments_insert on public.rr_hub_comments;

create policy rr_hub_comments_read on public.rr_hub_comments
  for select to authenticated
  using (public.rr_hub_is_admin() or exists (
    select 1 from public.rr_hub_ideas i
    join public.rr_hub_access a on a.project_id = i.project_id
    where i.id = rr_hub_comments.idea_id and a.user_id = auth.uid()));

create policy rr_hub_comments_write on public.rr_hub_comments
  for all to authenticated
  using (public.rr_hub_is_admin() or exists (
    select 1 from public.rr_hub_ideas i
    join public.rr_hub_access a on a.project_id = i.project_id
    where i.id = rr_hub_comments.idea_id and a.user_id = auth.uid()))
  with check (public.rr_hub_is_admin() or exists (
    select 1 from public.rr_hub_ideas i
    join public.rr_hub_access a on a.project_id = i.project_id
    where i.id = rr_hub_comments.idea_id and a.user_id = auth.uid()));

drop policy if exists rr_hub_events_read   on public.rr_hub_events;
drop policy if exists rr_hub_events_insert on public.rr_hub_events;

create policy rr_hub_events_read on public.rr_hub_events
  for select to authenticated
  using (public.rr_hub_is_admin() or exists (
    select 1 from public.rr_hub_ideas i
    join public.rr_hub_access a on a.project_id = i.project_id
    where i.id = rr_hub_events.idea_id and a.user_id = auth.uid()));

create policy rr_hub_events_write on public.rr_hub_events
  for all to authenticated
  using (public.rr_hub_is_admin() or exists (
    select 1 from public.rr_hub_ideas i
    join public.rr_hub_access a on a.project_id = i.project_id
    where i.id = rr_hub_events.idea_id and a.user_id = auth.uid()))
  with check (public.rr_hub_is_admin() or exists (
    select 1 from public.rr_hub_ideas i
    join public.rr_hub_access a on a.project_id = i.project_id
    where i.id = rr_hub_events.idea_id and a.user_id = auth.uid()));

drop policy if exists rr_hub_assets_read   on public.rr_hub_assets;
drop policy if exists rr_hub_assets_insert on public.rr_hub_assets;

create policy rr_hub_assets_read on public.rr_hub_assets
  for select to authenticated
  using (public.rr_hub_is_admin() or exists (
    select 1 from public.rr_hub_ideas i
    join public.rr_hub_access a on a.project_id = i.project_id
    where i.id = rr_hub_assets.idea_id and a.user_id = auth.uid()));

create policy rr_hub_assets_write on public.rr_hub_assets
  for all to authenticated
  using (public.rr_hub_is_admin() or exists (
    select 1 from public.rr_hub_ideas i
    join public.rr_hub_access a on a.project_id = i.project_id
    where i.id = rr_hub_assets.idea_id and a.user_id = auth.uid()))
  with check (public.rr_hub_is_admin() or exists (
    select 1 from public.rr_hub_ideas i
    join public.rr_hub_access a on a.project_id = i.project_id
    where i.id = rr_hub_assets.idea_id and a.user_id = auth.uid()));

-- 3. Storage: la subida anonima se cierra y el bucket deja de ser publico.
--    El bucket puede no existir todavia; los drop son seguros en ese caso.
drop policy if exists rr_hub_wundeer_public_storage_insert on storage.objects;
drop policy if exists rr_hub_wundeer_public_storage_read   on storage.objects;
update storage.buckets set public = false where id = 'rr-content-assets';

-- 4. Limpieza de las filas de prueba que dejo la auditoria del 2026-09-25.
delete from public.rr_hub_comments where body = 'probe-hermes';
delete from public.rr_hub_ideas where title = 'RR-AUDIT-PROBE-DELETE-ME';

-- 5. La ventana de auditoria fue prevista para 7 dias y quedo con
--    expires_at = null (interpretado como "sin caducidad"). Se cierra.
update public.rr_hub_audit_settings
   set enabled = false, expires_at = now(), updated_at = now()
 where id = true;
