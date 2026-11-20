-- DOWN de 20261120_hub_proyectos_archivados.sql
--
-- No lo aplica `supabase db push`: no está en supabase/migrations.
-- Restaura las políticas y funciones como estaban antes de archivar clientes
-- y quita las dos columnas. No borra proyectos ni accesos.
--
-- Orden: primero las políticas que leen archived_at, después las columnas.
-- Si el script de datos ya corrió, las fechas se pierden al quitar la columna.
-- Para desarchivar sin quitar el esquema, usa el DOWN del script de datos.

begin;

-- Funciones de puerta, búsqueda y portada: el cuerpo anterior, sin archived_at.
create or replace function public.rr_hub_is_wundeer_idea(candidate uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1
      from public.rr_hub_ideas i
      join public.rr_hub_projects p on p.id = i.project_id
     where i.id = candidate
       and p.slug = 'wundeer'
  );
$fn$;

create or replace function public.rr_hub_codigo_abre(p_codigo text)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1 from public.rr_hub_projects p
     where p.access_code is not null
       and p.access_code = p_codigo
  );
$fn$;

create or replace function public.rr_hub_cliente_por_codigo(p_codigo text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  encontrado text;
begin
  select p.slug into encontrado
    from public.rr_hub_projects p
   where p.access_code = p_codigo
   limit 1;
  return encontrado;
end;
$fn$;

create or replace function public.rr_hub_equipo_del_cliente(p_codigo text)
returns table (nombre text, correo text, rol text)
language sql
stable
security definer
set search_path = public
as $fn$
  select p.full_name, lower(p.email), a.role_in_project
    from public.rr_hub_projects pr
    join public.rr_hub_access a on a.project_id = pr.id
    join public.rr_hub_profiles p on p.id = a.user_id
   where pr.access_code = p_codigo
     and p.full_name is not null
     and p.is_active
   order by p.full_name;
$fn$;

create or replace function public.rr_hub_puede_entrar(p_codigo text, p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1
      from public.rr_hub_projects pr
      join public.rr_hub_access a on a.project_id = pr.id
      join public.rr_hub_profiles p on p.id = a.user_id
     where pr.access_code = p_codigo
       and lower(p.email) = lower(coalesce(p_email, ''))
       and p.is_team_member
       and p.is_active
  );
$fn$;

create or replace function public.rr_hub_search(
  p_project uuid,
  p_query text,
  p_limit integer default 50
)
returns setof public.rr_hub_board
language sql
stable
security invoker
set search_path = public
as $fn$
  select b.*
    from public.rr_hub_board b
   where b.project_id = p_project
     and (
       coalesce(btrim(p_query), '') = ''
       or b.search_tsv @@ websearch_to_tsquery('spanish', p_query)
     )
   order by b.updated_at desc
   limit greatest(1, least(coalesce(p_limit, 50), 200));
$fn$;

create or replace function public.rr_hub_idea_cover(p_idea_id uuid)
returns table (
  asset_id uuid,
  file_name text,
  mime_type text,
  external_url text,
  storage_path text
)
language sql
stable
security definer
set search_path = public
as $fn$
  select a.id, a.file_name, a.mime_type, a.external_url, a.storage_path
    from public.rr_hub_assets a
   where (
       public.rr_hub_is_admin()
       or exists (
         select 1
           from public.rr_hub_ideas i
           join public.rr_hub_access acc on acc.project_id = i.project_id
          where i.id = a.idea_id
            and acc.user_id = auth.uid()
       )
     )
     and a.id in (
       with elegida as (
         select i.cover_asset_id as id
           from public.rr_hub_ideas i
          where i.id = p_idea_id
            and i.cover_asset_id is not null
       ),
       reciente as (
         select b.id
           from public.rr_hub_assets b
          where b.idea_id = p_idea_id
            and b.asset_stage = 'reference_brief'
          order by b.created_at desc, b.id desc
          limit 1
       )
       select id from elegida
       union all
       select id from reciente where not exists (select 1 from elegida)
     );
$fn$;

drop policy if exists rr_hub_projects_miembro on public.rr_hub_projects;

drop policy if exists rr_hub_wundeer_public_project_read on public.rr_hub_projects;
create policy rr_hub_wundeer_public_project_read on public.rr_hub_projects
  for select to anon using (slug = 'wundeer');

drop policy if exists rr_hub_projects_audit on public.rr_hub_projects;
create policy rr_hub_projects_audit on public.rr_hub_projects
  for select to anon using (public.rr_hub_audit_enabled());

create or replace view public.rr_hub_catalogo as
  select id, name, slug, client_name, brand_primary_color, description
    from public.rr_hub_projects;
alter view public.rr_hub_catalogo set (security_invoker = true);

drop policy if exists rr_hub_ideas_read on public.rr_hub_ideas;
create policy rr_hub_ideas_read on public.rr_hub_ideas
  for select to authenticated
  using (public.rr_hub_is_admin() or exists (
    select 1 from public.rr_hub_access a
     where a.project_id = rr_hub_ideas.project_id and a.user_id = auth.uid()));

drop policy if exists rr_hub_ideas_write on public.rr_hub_ideas;
create policy rr_hub_ideas_write on public.rr_hub_ideas
  for all to authenticated
  using (public.rr_hub_is_admin() or exists (
    select 1 from public.rr_hub_access a
     where a.project_id = rr_hub_ideas.project_id and a.user_id = auth.uid()))
  with check (public.rr_hub_is_admin() or exists (
    select 1 from public.rr_hub_access a
     where a.project_id = rr_hub_ideas.project_id and a.user_id = auth.uid()));

drop policy if exists rr_hub_wundeer_public_ideas_read on public.rr_hub_ideas;
create policy rr_hub_wundeer_public_ideas_read on public.rr_hub_ideas
  for select to anon
  using (exists (
    select 1 from public.rr_hub_projects p
     where p.id = project_id and p.slug = 'wundeer'
  ));

drop policy if exists rr_hub_ideas_audit on public.rr_hub_ideas;
create policy rr_hub_ideas_audit on public.rr_hub_ideas
  for select to anon
  using (public.rr_hub_audit_enabled() and exists (
    select 1 from public.rr_hub_projects p where p.id = rr_hub_ideas.project_id
  ));

drop policy if exists rr_hub_comments_read on public.rr_hub_comments;
create policy rr_hub_comments_read on public.rr_hub_comments
  for select to authenticated
  using (public.rr_hub_is_admin() or exists (
    select 1 from public.rr_hub_ideas i
    join public.rr_hub_access a on a.project_id = i.project_id
     where i.id = rr_hub_comments.idea_id and a.user_id = auth.uid()));

drop policy if exists rr_hub_comments_write on public.rr_hub_comments;
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

drop policy if exists rr_hub_comments_audit on public.rr_hub_comments;
create policy rr_hub_comments_audit on public.rr_hub_comments
  for select to anon
  using (public.rr_hub_audit_enabled() and exists (
    select 1 from public.rr_hub_ideas i where i.id = rr_hub_comments.idea_id
  ));

drop policy if exists rr_hub_events_read on public.rr_hub_events;
create policy rr_hub_events_read on public.rr_hub_events
  for select to authenticated
  using (public.rr_hub_is_admin() or exists (
    select 1 from public.rr_hub_ideas i
    join public.rr_hub_access a on a.project_id = i.project_id
     where i.id = rr_hub_events.idea_id and a.user_id = auth.uid()));

drop policy if exists rr_hub_events_write on public.rr_hub_events;
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

drop policy if exists rr_hub_events_audit on public.rr_hub_events;
create policy rr_hub_events_audit on public.rr_hub_events
  for select to anon
  using (public.rr_hub_audit_enabled() and exists (
    select 1 from public.rr_hub_ideas i where i.id = rr_hub_events.idea_id
  ));

drop policy if exists rr_hub_assets_read on public.rr_hub_assets;
create policy rr_hub_assets_read on public.rr_hub_assets
  for select to authenticated
  using (public.rr_hub_is_admin() or exists (
    select 1 from public.rr_hub_ideas i
    join public.rr_hub_access a on a.project_id = i.project_id
     where i.id = rr_hub_assets.idea_id and a.user_id = auth.uid()));

drop policy if exists rr_hub_assets_write on public.rr_hub_assets;
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

drop policy if exists rr_hub_assets_audit on public.rr_hub_assets;
create policy rr_hub_assets_audit on public.rr_hub_assets
  for select to anon
  using (public.rr_hub_audit_enabled() and exists (
    select 1 from public.rr_hub_ideas i where i.id = rr_hub_assets.idea_id
  ));

drop policy if exists rr_hub_access_read on public.rr_hub_access;
create policy rr_hub_access_read on public.rr_hub_access
  for select to authenticated
  using (user_id = auth.uid() or public.rr_hub_is_admin());

drop policy if exists rr_hub_access_audit on public.rr_hub_access;
create policy rr_hub_access_audit on public.rr_hub_access
  for select to anon
  using (public.rr_hub_audit_enabled());

drop policy if exists rr_hub_invites_audit on public.rr_hub_invites;
create policy rr_hub_invites_audit on public.rr_hub_invites
  for select to anon
  using (public.rr_hub_audit_enabled());

drop policy if exists rr_hub_votes_read on public.rr_hub_votes;
create policy rr_hub_votes_read on public.rr_hub_votes
  for select to authenticated
  using (true);

drop function if exists public.rr_hub_idea_en_proyecto_activo(uuid);
drop function if exists public.rr_hub_proyecto_activo(uuid);
drop function if exists public.rr_hub_ve_archivados();

drop index if exists public.rr_hub_projects_activos_slug_idx;

alter table public.rr_hub_projects
  drop column if exists archived_by,
  drop column if exists archived_at;

commit;
