-- Cierra la escritura anonima sobre el hub.
--
-- Por que existe
-- --------------
-- El hub se documentaba como "solo lectura" y eso era falso. Dos capas lo
-- permitian, y ambas habian que cerrarse:
--
--   1. 20260911_wundeer_collaborative_mode.sql concedio `for insert to anon` y
--      `for update to anon` sobre ideas, comentarios y eventos, con el unico
--      filtro de "el proyecto es wundeer".
--   2. 20260910_content_hub_isolated.sql declaro las politicas base como
--      `for all` SIN `to authenticated`, asi que `anon` tambien las cumplia
--      para cualquier proyecto con fila en rr_hub_access.
--
-- Verificado contra produccion el 2026-09-25 con la publishable key: un
-- POST a rr_hub_ideas devolvio 201 y un PATCH devolvio 200 con la fila
-- actualizada. Cualquiera con el link podia crear piezas y moverlas de estado.
--
-- Este archivo cierra las dos capas. La lectura publica de Wundeer se
-- conserva a proposito: es el producto. Lo que se cierra es la escritura.
--
-- Idempotente: todo es drop-if-exists / create-policy. Se puede reaplicar.

-- ---------------------------------------------------------------------------
-- 1. Lectura anonima: se mantiene exactamente como estaba.
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
-- 2. Escritura anonima: fuera. Esta es la parte que faltaba.
-- ---------------------------------------------------------------------------
drop policy if exists rr_hub_wundeer_public_ideas_insert   on public.rr_hub_ideas;
drop policy if exists rr_hub_wundeer_public_ideas_update   on public.rr_hub_ideas;
drop policy if exists rr_hub_wundeer_public_events_insert  on public.rr_hub_events;
drop policy if exists rr_hub_wundeer_public_events_update  on public.rr_hub_events;
drop policy if exists rr_hub_wundeer_public_comments_insert on public.rr_hub_comments;
drop policy if exists rr_hub_wundeer_public_comments_update on public.rr_hub_comments;
drop policy if exists rr_hub_wundeer_public_assets_insert  on public.rr_hub_assets;
drop policy if exists rr_hub_wundeer_public_assets_update  on public.rr_hub_assets;

-- ---------------------------------------------------------------------------
-- 3. Las `for all` de 20260910 se reemplazan por pares explicitos.
--    `for all` sin `to authenticated` es lo que hacia la escritura publica.
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 4. DELETE no se le da a nadie por RLS. Antes no se concedia y asi se queda;
--    dejarlo explicito evita que una migracion futura lo abra por descuido.
-- ---------------------------------------------------------------------------
revoke delete on public.rr_hub_ideas    from anon, authenticated;
revoke delete on public.rr_hub_events   from anon, authenticated;
revoke delete on public.rr_hub_comments from anon, authenticated;
revoke delete on public.rr_hub_assets   from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Storage: la subida exige sesion; el bucket sigue siendo legible por
--    enlace para que un entregable compartido abra sin login.
-- ---------------------------------------------------------------------------
drop policy if exists rr_hub_wundeer_public_storage_insert on storage.objects;
drop policy if exists rr_hub_wundeer_auth_storage_insert   on storage.objects;
create policy rr_hub_wundeer_auth_storage_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'rr-content-assets' and (name like 'wundeer/%' or public.rr_hub_is_admin()));

drop policy if exists rr_hub_wundeer_auth_storage_delete on storage.objects;
create policy rr_hub_wundeer_auth_storage_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'rr-content-assets' and public.rr_hub_is_admin());

-- ---------------------------------------------------------------------------
-- 6. La ventana de auditoria se proviso para 7 dias y quedo con
--    expires_at = null, que la funcion rr_hub_audit_enabled() lee como
--    "sin caducidad". Se cierra.
-- ---------------------------------------------------------------------------
update public.rr_hub_audit_settings
   set enabled = false, expires_at = now(), updated_at = now()
 where id = true;

-- ---------------------------------------------------------------------------
-- 6b. `code` se generaba con un SELECT max+1 seguido de un INSERT, sin ninguna
--     restriccion que lo hiciera unico: dos llamadas simultaneas leian el mismo
--     maximo y las dos insertaban, dejando codigos duplicados. La API ahora
--     reintenta ante 23505, pero eso solo funciona si existe el indice.
--     Solo afecta a filas con codigo: la idea que creo la auditoria tiene
--     code = null y esta exenta.
-- ---------------------------------------------------------------------------
create unique index if not exists rr_hub_ideas_code_unique
  on public.rr_hub_ideas (project_id, content_type, code)
  where code is not null;

-- Verifica que no haya duplicados antes de que el indice falle:
--   select project_id, content_type, code, count(*)
--     from public.rr_hub_ideas where code is not null
--    group by 1,2,3 having count(*) > 1;

-- ---------------------------------------------------------------------------
-- 8. El bucket de assets no existe. Verificado en produccion: la API de
--    Storage devuelve `[]`, o sea que NO hay ningun bucket, no solo falta el
--    del hub. `uploadAsset()` por tanto fallaba siempre con NoSuchBucket, y
--    `getPublicUrl()` sobre un bucket inexistente devuelve una URL que da 404
--    en lugar de un error visible.
--
--    Se crea publico a proposito: `signedAssetUrl()` devuelve la URL directa
--    (no una signed URL) porque las entregas de Wundeer se comparten con el
--    espacio publico. Si algun dia los assets pasan a ser privados, ese
--    comentario y esta linea tienen que cambiar juntos.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'rr-content-assets',
  'rr-content-assets',
  true,
  104857600, -- 100 MB
  array['image/', 'video/', 'application/pdf', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Las politicas de storage ya estan en la seccion de policies de este mismo
-- archivo; si este bloque se aplica antes que ellas, el bucket queda sin acceso
-- hasta que se apliquen. Por eso el orden de este archivo importa: el bloque
-- del bucket va DESPUES de las politicas de storage.

-- Verificacion:
--   select id, public from storage.buckets where id = 'rr-content-assets';

-- ---------------------------------------------------------------------------
-- 9. Limpieza de las filas que dejo la auditoria del 2026-09-25. Se quedan
--    con el commit, no con la base: asi el paso es auditable.
-- ---------------------------------------------------------------------------
delete from public.rr_hub_comments where body = 'probe-hermes';
delete from public.rr_hub_ideas where title = 'RR-AUDIT-PROBE-DELETE-ME';

-- ---------------------------------------------------------------------------
-- Verificacion despues de aplicar (todas deben dar 0 filas o 401/42501):
--
--   -- escritura anonima bloqueada
--   select 1 from pg_policies
--    where schemaname = 'public' and tablename like 'rr_hub_%'
--      and 'anon' = any(roles) and cmd in ('INSERT','UPDATE','DELETE');
--
--   -- solo lectura anonima sigue viva
--   select tablename, cmd from pg_policies
--    where schemaname = 'public' and 'anon' = any(roles) order by 1,2;
--
--   -- no quedan filas de prueba
--   select count(*) from public.rr_hub_ideas where title = 'RR-AUDIT-PROBE-DELETE-ME';
-- ---------------------------------------------------------------------------
