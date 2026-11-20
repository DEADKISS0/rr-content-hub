-- Archivar clientes sin borrar filas.
--
-- `rr_hub_projects` solo se podía borrar. Borrar un cliente se lleva ideas,
-- votos y accesos en cascada, y no hay forma de volver atrás. Esta migración
-- añade `archived_at` (cuándo) y `archived_by` (quién, si lo hizo una persona).
-- NULL = el cliente sigue en el catálogo. Con fecha, un usuario normal no lo
-- ve ni entra: ni por RLS, ni por las funciones que se saltan el RLS.
--
-- El admin global (`rr_hub_profiles.global_role = 'admin'`) sí los ve. La app,
-- que lee con service role y por eso no pasa por estas políticas, repite la
-- misma regla y marca el nombre.
--
-- No borra filas. No toca tablas que no sean `rr_hub_*`. No archiva datos:
-- eso vive en `supabase/data/20261120_archivar_clientes_excepto_tres.sql` y
-- se aplica DESPUÉS de desplegar la app que ya entiende la columna.
--
-- Reversible. El SQL de bajada, listo para copiar, está en
-- `supabase/rollback/20261120_hub_proyectos_archivados.down.sql`.
-- No se ejecuta aquí.

begin;

-- ---------------------------------------------------------------------------
-- 1. Columnas. Idempotente.
-- ---------------------------------------------------------------------------
alter table public.rr_hub_projects
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.rr_hub_profiles (id) on delete set null;

comment on column public.rr_hub_projects.archived_at is
  'Cuándo se archivó el cliente. NULL = sigue en el catálogo y se puede abrir. No es un borrado: la fila, sus ideas y sus accesos siguen.';
comment on column public.rr_hub_projects.archived_by is
  'Quién lo archivó (rr_hub_profiles.id). NULL si lo archivó un script.';

create index if not exists rr_hub_projects_activos_slug_idx
  on public.rr_hub_projects (slug)
  where archived_at is null;

-- ---------------------------------------------------------------------------
-- 2. Predicados. SECURITY DEFINER para no recursar con el RLS que los llama.
--    No devuelven filas: un booleano. El admin es el global_role, no un correo.
-- ---------------------------------------------------------------------------
create or replace function public.rr_hub_ve_archivados()
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1
      from public.rr_hub_profiles p
     where p.id = auth.uid()
       and p.global_role = 'admin'
  );
$fn$;

comment on function public.rr_hub_ve_archivados() is
  'true si la sesión de Supabase es un admin global. Es quien puede seguir viendo un cliente archivado. No dice nada de nadie más.';

create or replace function public.rr_hub_proyecto_activo(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select coalesce(
    (select p.archived_at is null from public.rr_hub_projects p where p.id = p_id),
    false
  );
$fn$;

comment on function public.rr_hub_proyecto_activo(uuid) is
  'true si ese proyecto existe y no está archivado. false si no existe o si archived_at tiene fecha.';

create or replace function public.rr_hub_idea_en_proyecto_activo(p_idea_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select coalesce(
    (select public.rr_hub_proyecto_activo(i.project_id)
       from public.rr_hub_ideas i
      where i.id = p_idea_id),
    false
  );
$fn$;

comment on function public.rr_hub_idea_en_proyecto_activo(uuid) is
  'true si la idea pertenece a un proyecto que no está archivado.';

revoke all on function public.rr_hub_ve_archivados() from public;
revoke all on function public.rr_hub_proyecto_activo(uuid) from public;
revoke all on function public.rr_hub_idea_en_proyecto_activo(uuid) from public;
grant execute on function public.rr_hub_ve_archivados() to anon, authenticated, service_role;
grant execute on function public.rr_hub_proyecto_activo(uuid) to anon, authenticated, service_role;
grant execute on function public.rr_hub_idea_en_proyecto_activo(uuid) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Proyectos. El miembro ve los suyos si están vivos. El admin ve también
--    los archivados. El anónimo deja de ver un Wundeer archivado y la
--    auditoría pública tampoco lo lista.
-- ---------------------------------------------------------------------------
drop policy if exists rr_hub_projects_miembro on public.rr_hub_projects;
create policy rr_hub_projects_miembro on public.rr_hub_projects
  for select to authenticated
  using (
    public.rr_hub_ve_archivados()
    or (
      archived_at is null
      and exists (
        select 1 from public.rr_hub_access a
         where a.project_id = rr_hub_projects.id
           and a.user_id = auth.uid()
      )
    )
  );

drop policy if exists rr_hub_wundeer_public_project_read on public.rr_hub_projects;
create policy rr_hub_wundeer_public_project_read on public.rr_hub_projects
  for select to anon
  using (slug = 'wundeer' and archived_at is null);

drop policy if exists rr_hub_projects_audit on public.rr_hub_projects;
create policy rr_hub_projects_audit on public.rr_hub_projects
  for select to anon
  using (public.rr_hub_audit_enabled() and archived_at is null);

-- El catálogo público no lleva el código y tampoco los archivados.
-- security_invoker se vuelve a declarar: un replace no debe perderlo.
create or replace view public.rr_hub_catalogo as
  select id, name, slug, client_name, brand_primary_color, description
    from public.rr_hub_projects
   where archived_at is null;

alter view public.rr_hub_catalogo set (security_invoker = true);

comment on view public.rr_hub_catalogo is
  'Catálogo de clientes vivos, sin access_code y sin archivados. El admin global lee la tabla, no esta vista.';

-- ---------------------------------------------------------------------------
-- 4. Hijos de rr_hub_*. Un usuario normal no lee ni escribe lo de un cliente
--    archivado. El admin global sí. Las políticas son permisivas: hay que
--    cerrar cada una, porque con que una deje pasar la fila, pasa.
-- ---------------------------------------------------------------------------
drop policy if exists rr_hub_ideas_read on public.rr_hub_ideas;
create policy rr_hub_ideas_read on public.rr_hub_ideas
  for select to authenticated
  using (
    public.rr_hub_ve_archivados()
    or (
      public.rr_hub_proyecto_activo(project_id)
      and exists (
        select 1 from public.rr_hub_access a
         where a.project_id = rr_hub_ideas.project_id
           and a.user_id = auth.uid()
      )
    )
  );

drop policy if exists rr_hub_ideas_write on public.rr_hub_ideas;
create policy rr_hub_ideas_write on public.rr_hub_ideas
  for all to authenticated
  using (
    public.rr_hub_ve_archivados()
    or (
      public.rr_hub_proyecto_activo(project_id)
      and exists (
        select 1 from public.rr_hub_access a
         where a.project_id = rr_hub_ideas.project_id
           and a.user_id = auth.uid()
      )
    )
  )
  with check (
    public.rr_hub_ve_archivados()
    or (
      public.rr_hub_proyecto_activo(project_id)
      and exists (
        select 1 from public.rr_hub_access a
         where a.project_id = rr_hub_ideas.project_id
           and a.user_id = auth.uid()
      )
    )
  );

drop policy if exists rr_hub_wundeer_public_ideas_read on public.rr_hub_ideas;
create policy rr_hub_wundeer_public_ideas_read on public.rr_hub_ideas
  for select to anon
  using (
    exists (
      select 1 from public.rr_hub_projects p
       where p.id = project_id
         and p.slug = 'wundeer'
         and p.archived_at is null
    )
  );

drop policy if exists rr_hub_ideas_audit on public.rr_hub_ideas;
create policy rr_hub_ideas_audit on public.rr_hub_ideas
  for select to anon
  using (
    public.rr_hub_audit_enabled()
    and public.rr_hub_proyecto_activo(project_id)
  );

drop policy if exists rr_hub_comments_read on public.rr_hub_comments;
create policy rr_hub_comments_read on public.rr_hub_comments
  for select to authenticated
  using (
    public.rr_hub_ve_archivados()
    or (
      public.rr_hub_idea_en_proyecto_activo(idea_id)
      and exists (
        select 1 from public.rr_hub_ideas i
        join public.rr_hub_access a on a.project_id = i.project_id
         where i.id = rr_hub_comments.idea_id
           and a.user_id = auth.uid()
      )
    )
  );

drop policy if exists rr_hub_comments_write on public.rr_hub_comments;
create policy rr_hub_comments_write on public.rr_hub_comments
  for all to authenticated
  using (
    public.rr_hub_ve_archivados()
    or (
      public.rr_hub_idea_en_proyecto_activo(idea_id)
      and exists (
        select 1 from public.rr_hub_ideas i
        join public.rr_hub_access a on a.project_id = i.project_id
         where i.id = rr_hub_comments.idea_id
           and a.user_id = auth.uid()
      )
    )
  )
  with check (
    public.rr_hub_ve_archivados()
    or (
      public.rr_hub_idea_en_proyecto_activo(idea_id)
      and exists (
        select 1 from public.rr_hub_ideas i
        join public.rr_hub_access a on a.project_id = i.project_id
         where i.id = rr_hub_comments.idea_id
           and a.user_id = auth.uid()
      )
    )
  );

drop policy if exists rr_hub_comments_audit on public.rr_hub_comments;
create policy rr_hub_comments_audit on public.rr_hub_comments
  for select to anon
  using (
    public.rr_hub_audit_enabled()
    and public.rr_hub_idea_en_proyecto_activo(idea_id)
  );

drop policy if exists rr_hub_events_read on public.rr_hub_events;
create policy rr_hub_events_read on public.rr_hub_events
  for select to authenticated
  using (
    public.rr_hub_ve_archivados()
    or (
      public.rr_hub_idea_en_proyecto_activo(idea_id)
      and exists (
        select 1 from public.rr_hub_ideas i
        join public.rr_hub_access a on a.project_id = i.project_id
         where i.id = rr_hub_events.idea_id
           and a.user_id = auth.uid()
      )
    )
  );

drop policy if exists rr_hub_events_write on public.rr_hub_events;
create policy rr_hub_events_write on public.rr_hub_events
  for all to authenticated
  using (
    public.rr_hub_ve_archivados()
    or (
      public.rr_hub_idea_en_proyecto_activo(idea_id)
      and exists (
        select 1 from public.rr_hub_ideas i
        join public.rr_hub_access a on a.project_id = i.project_id
         where i.id = rr_hub_events.idea_id
           and a.user_id = auth.uid()
      )
    )
  )
  with check (
    public.rr_hub_ve_archivados()
    or (
      public.rr_hub_idea_en_proyecto_activo(idea_id)
      and exists (
        select 1 from public.rr_hub_ideas i
        join public.rr_hub_access a on a.project_id = i.project_id
         where i.id = rr_hub_events.idea_id
           and a.user_id = auth.uid()
      )
    )
  );

drop policy if exists rr_hub_events_audit on public.rr_hub_events;
create policy rr_hub_events_audit on public.rr_hub_events
  for select to anon
  using (
    public.rr_hub_audit_enabled()
    and public.rr_hub_idea_en_proyecto_activo(idea_id)
  );

drop policy if exists rr_hub_assets_read on public.rr_hub_assets;
create policy rr_hub_assets_read on public.rr_hub_assets
  for select to authenticated
  using (
    public.rr_hub_ve_archivados()
    or (
      public.rr_hub_idea_en_proyecto_activo(idea_id)
      and exists (
        select 1 from public.rr_hub_ideas i
        join public.rr_hub_access a on a.project_id = i.project_id
         where i.id = rr_hub_assets.idea_id
           and a.user_id = auth.uid()
      )
    )
  );

drop policy if exists rr_hub_assets_write on public.rr_hub_assets;
create policy rr_hub_assets_write on public.rr_hub_assets
  for all to authenticated
  using (
    public.rr_hub_ve_archivados()
    or (
      public.rr_hub_idea_en_proyecto_activo(idea_id)
      and exists (
        select 1 from public.rr_hub_ideas i
        join public.rr_hub_access a on a.project_id = i.project_id
         where i.id = rr_hub_assets.idea_id
           and a.user_id = auth.uid()
      )
    )
  )
  with check (
    public.rr_hub_ve_archivados()
    or (
      public.rr_hub_idea_en_proyecto_activo(idea_id)
      and exists (
        select 1 from public.rr_hub_ideas i
        join public.rr_hub_access a on a.project_id = i.project_id
         where i.id = rr_hub_assets.idea_id
           and a.user_id = auth.uid()
      )
    )
  );

drop policy if exists rr_hub_assets_audit on public.rr_hub_assets;
create policy rr_hub_assets_audit on public.rr_hub_assets
  for select to anon
  using (
    public.rr_hub_audit_enabled()
    and public.rr_hub_idea_en_proyecto_activo(idea_id)
  );

-- La lectura pública de Wundeer pasa por esta función. Si el cliente está
-- archivado, la función dice que no es una idea pública.
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
       and p.archived_at is null
  );
$fn$;

drop policy if exists rr_hub_access_read on public.rr_hub_access;
create policy rr_hub_access_read on public.rr_hub_access
  for select to authenticated
  using (
    public.rr_hub_ve_archivados()
    or (
      user_id = auth.uid()
      and public.rr_hub_proyecto_activo(project_id)
    )
  );

drop policy if exists rr_hub_access_audit on public.rr_hub_access;
create policy rr_hub_access_audit on public.rr_hub_access
  for select to anon
  using (
    public.rr_hub_audit_enabled()
    and public.rr_hub_proyecto_activo(project_id)
  );

drop policy if exists rr_hub_invites_audit on public.rr_hub_invites;
create policy rr_hub_invites_audit on public.rr_hub_invites
  for select to anon
  using (
    public.rr_hub_audit_enabled()
    and public.rr_hub_proyecto_activo(project_id)
  );

drop policy if exists rr_hub_votes_read on public.rr_hub_votes;
create policy rr_hub_votes_read on public.rr_hub_votes
  for select to authenticated
  using (
    public.rr_hub_ve_archivados()
    or public.rr_hub_idea_en_proyecto_activo(idea_id)
  );

-- ---------------------------------------------------------------------------
-- 5. Funciones que se saltan el RLS. Un cliente archivado no abre la puerta
--    y no sale en la búsqueda. El admin global entra por la app, no por el
--    código de un cliente que ya se cerró.
-- ---------------------------------------------------------------------------
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
       and p.archived_at is null
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
     and p.archived_at is null
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
     and pr.archived_at is null
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
       and pr.archived_at is null
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
       public.rr_hub_ve_archivados()
       or public.rr_hub_proyecto_activo(p_project)
     )
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
       public.rr_hub_ve_archivados()
       or exists (
         select 1
           from public.rr_hub_ideas i
           join public.rr_hub_access acc on acc.project_id = i.project_id
           join public.rr_hub_projects p on p.id = i.project_id
          where i.id = a.idea_id
            and acc.user_id = auth.uid()
            and p.archived_at is null
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

commit;
