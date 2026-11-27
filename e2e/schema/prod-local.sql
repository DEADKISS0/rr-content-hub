-- Esquema local que reproduce lo medido en prod (ntgtvtzbjwotuwkiflar) el 2026-11-27.
-- No es una migracion: no vive en supabase/migrations y no se aplica a produccion.
--
-- Fuentes:
--   * politicas RLS y funciones rr_hub_*: snapshot completo del 27-nov.
--   * columnas, checks y FKs de las tablas que el hub escribe: consulta de solo
--     lectura a information_schema / pg_constraint el mismo dia. El adjunto de
--     columnas venia truncado a media fila; esta lista sale de esa consulta,
--     no del adjunto cortado.
--   * handle_new_user (CRM): consulta de solo lectura. Hace falta porque el
--     alta de auth.users dispara ese trigger ademas del del hub.
--
-- No se inventan columnas de lo que el snapshot corto no mostro:
--   * rr_hub_search y rr_hub_social_plan_commit no se crean. La vista
--     rr_hub_board y las columnas completas de rr_hub_social_plans estaban
--     en la parte omitida del adjunto de vistas.
--   * Las vistas (feed, catalogo, board, ...) no se crean por el mismo corte.
--   * El enum cm_global_role solo incluye 'direccion', que es el unico valor
--     que aparece en la politica rr_hub_profiles_escribir.
--
-- Grants: service_role recibe lo necesario para que PostgREST escriba como
-- en Supabase (bypassrls). anon y authenticated NO reciben grants nuevos.

create schema if not exists auth;

create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create or replace function auth.jwt() returns jsonb
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
$$;

create table if not exists auth.users (
  id uuid primary key,
  email text unique,
  encrypted_password text,
  email_confirmed_at timestamptz,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  raw_app_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_sso_user boolean not null default false,
  is_anonymous boolean not null default false,
  aud text,
  role text
);

do $$ begin
  create type public.cm_global_role as enum ('direccion');
exception when duplicate_object then null;
end $$;

create table if not exists public.cm_access (
  user_id uuid,
  global_role public.cm_global_role,
  is_active boolean not null default false,
  revoked_at timestamptz
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  avatar_url text,
  bio text,
  role text not null default 'user',
  points integer not null default 0,
  level integer not null default 1,
  followers_count integer not null default 0,
  following_count integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.rr_hub_projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  client_name text not null,
  description text,
  brand_primary_color text not null default '#be076d',
  created_at timestamptz not null default now(),
  public_audit boolean not null default false,
  access_code text
);

create table if not exists public.rr_hub_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  global_role text not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz,
  is_active boolean not null default true,
  is_team_member boolean not null default false,
  constraint rr_hub_profiles_global_role_check check (global_role = any (array['admin','member']))
);

create table if not exists public.rr_hub_access (
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.rr_hub_projects(id) on delete cascade,
  role_in_project text not null,
  granted_at timestamptz not null default now(),
  primary key (user_id, project_id),
  constraint rr_hub_access_role_in_project_check check (role_in_project = any (array['owner','creator','camera','model','editor','publisher','media_buyer','client_approver','client_viewer']))
);

create table if not exists public.rr_hub_invites (
  email text not null,
  project_id uuid not null references public.rr_hub_projects(id) on delete cascade,
  role_in_project text not null,
  primary key (email, project_id),
  constraint rr_hub_invites_role_in_project_check check (role_in_project = any (array['owner','creator','camera','model','editor','publisher','media_buyer','client_approver','client_viewer']))
);

create table if not exists public.rr_hub_ideas (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.rr_hub_projects(id) on delete cascade,
  code text,
  title text not null,
  description text,
  objective text,
  content_type text not null,
  category text,
  status text not null default 'draft',
  priority text not null default 'normal',
  created_by uuid references auth.users(id),
  reference_urls jsonb not null default '[]'::jsonb,
  camera_brief text,
  talent_brief text,
  edit_brief text,
  script_content text,
  script_drive_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  due_at timestamptz,
  published_url text,
  metrics jsonb not null default '{}'::jsonb,
  cover_asset_id uuid,
  search_tsv tsvector,
  ad_id uuid,
  archived_at timestamptz,
  archived_by uuid references public.rr_hub_profiles(id) on delete set null,
  origen text not null default 'manual',
  automation_batch_key text,
  automation_batch_index smallint,
  constraint rr_hub_ideas_content_type_check check (content_type = any (array['organic','paid'])),
  constraint rr_hub_ideas_priority_check check (priority = any (array['high','normal'])),
  constraint rr_hub_ideas_origen_check check (origen = any (array['manual','asistente'])),
  constraint rr_hub_ideas_status_check check (status = any (array['draft','internal_review','voting','pending_approval','needs_changes','approved','script_in_progress','pending_script_review','script_approved','in_production','raw_uploaded','editing','ready_to_publish','published','closed'])),
  constraint rr_hub_ideas_automation_batch_index_check check (automation_batch_index is null or (automation_batch_index >= 0 and automation_batch_index <= 9))
);

create table if not exists public.rr_hub_assets (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.rr_hub_ideas(id) on delete cascade,
  uploaded_by uuid references auth.users(id),
  asset_stage text not null,
  storage_path text,
  external_url text,
  file_name text not null,
  mime_type text,
  version_label text not null default 'v1',
  created_at timestamptz not null default now(),
  constraint rr_hub_assets_asset_stage_check check (asset_stage = any (array['reference_brief','script','raw','edit_v1','edit_v2','edit_final','publication_evidence'])),
  constraint rr_hub_assets_check check (storage_path is not null or external_url is not null)
);

alter table public.rr_hub_ideas
  drop constraint if exists rr_hub_ideas_cover_asset_id_fkey;
alter table public.rr_hub_ideas
  add constraint rr_hub_ideas_cover_asset_id_fkey
  foreign key (cover_asset_id) references public.rr_hub_assets(id) on delete set null;

create table if not exists public.rr_hub_comments (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.rr_hub_ideas(id) on delete cascade,
  author_id uuid references auth.users(id),
  body text not null,
  role_label text not null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  author_label text
);

create table if not exists public.rr_hub_events (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.rr_hub_ideas(id) on delete cascade,
  actor_id uuid references auth.users(id),
  from_status text,
  to_status text not null,
  comment text,
  created_at timestamptz not null default now(),
  actor_label text
);

create table if not exists public.rr_hub_votes (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.rr_hub_ideas(id) on delete cascade,
  voter_token text not null,
  decision text not null,
  note text,
  created_at timestamptz not null default now(),
  voter_email text,
  constraint rr_hub_votes_decision_check check (decision = any (array['yes','no','change','note'])),
  constraint rr_hub_votes_change_needs_note check (decision <> all (array['change','note']) or (note is not null and length(btrim(note)) > 0)),
  constraint rr_hub_votes_idea_id_voter_token_key unique (idea_id, voter_token)
);

create table if not exists public.rr_hub_script_versions (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.rr_hub_ideas(id) on delete cascade,
  version_number integer not null,
  script_content text not null,
  saved_by uuid references auth.users(id),
  actor_label text not null default 'RR ALIADOS',
  created_at timestamptz not null default now(),
  constraint rr_hub_script_versions_script_content_check check (length(btrim(script_content)) >= 1 and length(btrim(script_content)) <= 60000),
  constraint rr_hub_script_versions_version_number_check check (version_number > 0),
  constraint rr_hub_script_versions_idea_id_version_number_key unique (idea_id, version_number)
);

create table if not exists public.rr_hub_presencia (
  email text primary key,
  profile_id uuid references public.rr_hub_profiles(id) on delete set null,
  last_seen_at timestamptz not null default now(),
  sesion_id text
);

-- Columnas no nulas extra de esta tabla estaban en el tramo truncado del
-- snapshot de columnas. Aqui solo entra lo que el dump COMPLETO de
-- pg_constraint exige (PK, FKs, checks, unique) mas idea_id, que es lo que
-- lee la politica rr_hub_reference_captures_read.
create table if not exists public.rr_hub_reference_captures (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.rr_hub_ideas(id) on delete cascade,
  asset_id uuid references public.rr_hub_assets(id) on delete set null,
  source_url text,
  image_url text,
  capture_method text,
  status text,
  constraint rr_hub_reference_captures_idea_id_source_url_key unique (idea_id, source_url),
  constraint rr_hub_reference_captures_capture_method_check check (capture_method = any (array['direct_image','provider_thumbnail','authorized_browser','none'])),
  constraint rr_hub_reference_captures_status_check check (status = any (array['ready','persisted','requires_authorized_capture','unsupported'])),
  constraint rr_hub_reference_captures_check check (status = any (array['ready','persisted']) or image_url is null or capture_method = 'authorized_browser')
);

create table if not exists public.rr_hub_audit_settings (
  id boolean primary key,
  enabled boolean not null default false,
  expires_at timestamptz,
  opens_at timestamptz,
  constraint rr_hub_audit_settings_id_check check (id)
);

-- Stubs so las funciones SQL que se crean antes (orden alfabetico del snapshot)
-- puedan resolverse. El CREATE OR REPLACE de abajo deja el cuerpo real.
create or replace function public.rr_hub_is_admin()
returns boolean language sql stable security definer set search_path to 'public'
as $$ select false $$;

create or replace function public.rr_hub_is_wundeer_idea(candidate uuid)
returns boolean language sql stable security definer set search_path to 'public'
as $$ select false $$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $function$
BEGIN
  INSERT INTO public.profiles (id, email, name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rr_hub_audit_enabled()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((
    select s.enabled
       and (s.expires_at is null or now() < s.expires_at)
       and (s.opens_at  is null or now() >= s.opens_at)
    from public.rr_hub_audit_settings s where s.id = true
  ), false);
$function$;

CREATE OR REPLACE FUNCTION public.rr_hub_can_vote_by_email(p_email text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.rr_hub_profiles pr
     where lower(pr.email) = lower(coalesce(p_email, ''))
       and pr.is_team_member
       and pr.is_active
  );
$function$;

CREATE OR REPLACE FUNCTION public.rr_hub_cliente_por_codigo(p_codigo text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  encontrado text;
begin
  select p.slug into encontrado
    from public.rr_hub_projects p
   where p.access_code = p_codigo
   limit 1;
  return encontrado;
end;
$function$;

CREATE OR REPLACE FUNCTION public.rr_hub_codigo_abre(p_codigo text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.rr_hub_projects p
     where p.access_code is not null
       and p.access_code = p_codigo
  );
$function$;

CREATE OR REPLACE FUNCTION public.rr_hub_entra(p_email text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.rr_hub_profiles p
     where lower(p.email) = lower(coalesce(p_email, ''))
       and p.is_team_member
       and p.is_active
  );
$function$;

CREATE OR REPLACE FUNCTION public.rr_hub_equipo_del_cliente(p_codigo text)
 RETURNS TABLE(nombre text, correo text, rol text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p.full_name, lower(p.email), a.role_in_project
    from public.rr_hub_projects pr
    join public.rr_hub_access a on a.project_id = pr.id
    join public.rr_hub_profiles p on p.id = a.user_id
   where pr.access_code = p_codigo
     and p.full_name is not null
     and p.is_active
   order by p.full_name;
$function$;

CREATE OR REPLACE FUNCTION public.rr_hub_handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.rr_hub_profiles (id, full_name, email, global_role, is_active, is_team_member)
  values (new.id,
          coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
          lower(new.email), 'member', true, false)
  on conflict (id) do update
    set full_name  = excluded.full_name,
        email       = lower(excluded.email),
        updated_at  = now();

  -- El acceso por proyecto lo da la lista de invitaciones, que es humana.
  if new.email is not null then
    insert into public.rr_hub_access (user_id, project_id, role_in_project)
    select new.id, i.project_id, i.role_in_project
      from public.rr_hub_invites i
     where lower(i.email) = lower(new.email)
    on conflict (user_id, project_id) do update set role_in_project = excluded.role_in_project;
  end if;

  -- Lo que NO hace, y es lo importante: el trigger nunca escribe
  -- is_team_member. Ese TRUE lo pone una persona, no un alta de cuenta.
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.rr_hub_hay_sesion_supabase()
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  -- Siempre falso, y a propósito. Si algún día alguien escribe una política con
  -- esta función esperando que aclare quién entra, va a obtener exactamente lo
  -- que dice: que no aclara nada. La puerta es la cookie, y la cookie no está
  -- en la base.
  select false;
$function$;

CREATE OR REPLACE FUNCTION public.rr_hub_idea_cover(p_idea_id uuid)
 RETURNS TABLE(asset_id uuid, file_name text, mime_type text, external_url text, storage_path text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- `security definer` salta las políticas de RLS de las tablas que lee, así que
  -- esta función NO puede devolver la fila sin volver a comprobar la
  -- autorización a mano. Si no, cualquier `anon` que llamara al RPC del hub
  -- público (ver docs/AUDIT_2026-09-26.md) se llevaría el `storage_path` de
  -- los briefs de ideas de otros proyectos. Estas dos condiciones son las
  -- MISMAS que usan las políticas `rr_hub_assets_read` y `rr_hub_ideas_read`
  -- de 20260926_close_anon_write.sql, copiadas a mano porque una función
  -- definer no las evalúa.
  select a.id, a.file_name, a.mime_type, a.external_url, a.storage_path
  from public.rr_hub_assets a
  where (
      public.rr_hub_is_admin()
      or exists (
        select 1
        from public.rr_hub_ideas i
        join public.rr_hub_access acc on acc.project_id = i.project_id
        where i.id = a.idea_id and acc.user_id = auth.uid()
      )
    )
    and a.id in (
      -- Rama 1: la portada elegida a mano. Como máximo una fila, porque
      -- `cover_asset_id` es una columna y la idea tiene una sola fila.
      with elegida as (
        select i.cover_asset_id as id
        from public.rr_hub_ideas i
        where i.id = p_idea_id and i.cover_asset_id is not null
      ),
      -- Rama 2: sin portada elegida, el reference_brief más reciente. El
      -- `limit 1` va DENTRO del CTE, no sobre el union: aplicado al final
      -- cortaría la fila de la rama 1 sin avisar.
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
$function$;

CREATE OR REPLACE FUNCTION public.rr_hub_is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ select exists (select 1 from public.rr_hub_profiles where id = auth.uid() and global_role = 'admin'); $function$;

CREATE OR REPLACE FUNCTION public.rr_hub_is_wundeer_idea(candidate uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ select exists (select 1 from public.rr_hub_ideas i join public.rr_hub_projects p on p.id = i.project_id where i.id = candidate and p.slug = 'wundeer'); $function$;

CREATE OR REPLACE FUNCTION public.rr_hub_puede_crear_cuenta(p_email text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.rr_hub_profiles p
     where lower(p.email) = lower(coalesce(p_email, ''))
       and p.is_team_member
  );
$function$;

CREATE OR REPLACE FUNCTION public.rr_hub_puede_entrar(p_codigo text, p_email text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.rr_hub_save_script(p_idea_id uuid, p_script_content text, p_saved_by uuid DEFAULT NULL::uuid, p_actor_label text DEFAULT 'RR ALIADOS'::text)
 RETURNS TABLE(version_id uuid, version_number integer, saved_at timestamp with time zone, actor_label text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_idea_id uuid;
  v_next integer;
  v_id uuid;
  v_saved_at timestamptz;
  v_actor text;
begin
  if p_script_content is null or length(btrim(p_script_content)) = 0 then
    raise exception 'script_content_empty' using errcode = '22023';
  end if;
  if length(p_script_content) > 60000 then
    raise exception 'script_content_too_long' using errcode = '22001';
  end if;

  -- Lock the parent row: max()+1 alone is racy when two saves arrive together.
  select id into v_idea_id
  from public.rr_hub_ideas
  where id = p_idea_id
  for update;
  if v_idea_id is null then
    raise exception 'idea_not_found' using errcode = 'P0002';
  end if;

  select coalesce(max(s.version_number), 0) + 1
    into v_next
  from public.rr_hub_script_versions s
  where s.idea_id = p_idea_id;

  v_actor := coalesce(nullif(btrim(p_actor_label), ''), 'RR ALIADOS');
  insert into public.rr_hub_script_versions (idea_id, version_number, script_content, saved_by, actor_label)
  values (p_idea_id, v_next, p_script_content, p_saved_by, v_actor)
  returning id, created_at into v_id, v_saved_at;

  update public.rr_hub_ideas
  set script_content = p_script_content, updated_at = v_saved_at
  where id = p_idea_id;

  return query select v_id, v_next, v_saved_at, v_actor;
end;
$function$;

-- omitida a proposito: rr_hub_search (depende de una vista o tabla cuyo DDL venia truncado en el snapshot)

-- omitida a proposito: rr_hub_social_plan_commit (depende de una vista o tabla cuyo DDL venia truncado en el snapshot)

CREATE OR REPLACE FUNCTION public.rr_hub_touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if new.updated_at is not distinct from old.updated_at then
    new.updated_at = now();
  end if;
  return new;
end;
$function$;

drop trigger if exists rr_hub_ideas_touch on public.rr_hub_ideas;
create trigger rr_hub_ideas_touch
  before update on public.rr_hub_ideas
  for each row execute function public.rr_hub_touch_updated_at();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists rr_hub_auth_user_created on auth.users;
create trigger rr_hub_auth_user_created
  after insert on auth.users
  for each row execute function public.rr_hub_handle_new_user();
drop policy if exists rr_hub_access_admin on public.rr_hub_access;
create policy rr_hub_access_admin on public.rr_hub_access
  as permissive
  for ALL
  to public
  using (rr_hub_is_admin())
  with check (rr_hub_is_admin());
drop policy if exists rr_hub_access_update on public.rr_hub_access;
create policy rr_hub_access_update on public.rr_hub_access
  as permissive
  for UPDATE
  to authenticated
  using (rr_hub_is_admin())
  with check (rr_hub_is_admin());
drop policy if exists rr_hub_wundeer_public_assets_read on public.rr_hub_assets;
create policy rr_hub_wundeer_public_assets_read on public.rr_hub_assets
  as permissive
  for SELECT
  to anon
  using (rr_hub_is_wundeer_idea(idea_id));
drop policy if exists rr_hub_audit_settings_admin on public.rr_hub_audit_settings;
create policy rr_hub_audit_settings_admin on public.rr_hub_audit_settings
  as permissive
  for ALL
  to public
  using (rr_hub_is_admin())
  with check (rr_hub_is_admin());
drop policy if exists rr_hub_audit_settings_read on public.rr_hub_audit_settings;
create policy rr_hub_audit_settings_read on public.rr_hub_audit_settings
  as permissive
  for SELECT
  to anon
  using (true);
drop policy if exists rr_hub_wundeer_public_comments_read on public.rr_hub_comments;
create policy rr_hub_wundeer_public_comments_read on public.rr_hub_comments
  as permissive
  for SELECT
  to anon
  using (rr_hub_is_wundeer_idea(idea_id));
drop policy if exists rr_hub_wundeer_public_events_read on public.rr_hub_events;
create policy rr_hub_wundeer_public_events_read on public.rr_hub_events
  as permissive
  for SELECT
  to anon
  using (rr_hub_is_wundeer_idea(idea_id));
drop policy if exists rr_hub_wundeer_public_ideas_read on public.rr_hub_ideas;
create policy rr_hub_wundeer_public_ideas_read on public.rr_hub_ideas
  as permissive
  for SELECT
  to anon
  using ((EXISTS ( SELECT 1
   FROM rr_hub_projects p
  WHERE ((p.id = rr_hub_ideas.project_id) AND (p.slug = 'wundeer'::text)))));
drop policy if exists rr_hub_invites_admin on public.rr_hub_invites;
create policy rr_hub_invites_admin on public.rr_hub_invites
  as permissive
  for ALL
  to public
  using (rr_hub_is_admin())
  with check (rr_hub_is_admin());
drop policy if exists rr_hub_presencia_solo_servidor on public.rr_hub_presencia;
create policy rr_hub_presencia_solo_servidor on public.rr_hub_presencia
  as permissive
  for ALL
  to service_role
  using (true)
  with check (true);
drop policy if exists rr_hub_profile_admin on public.rr_hub_profiles;
create policy rr_hub_profile_admin on public.rr_hub_profiles
  as permissive
  for ALL
  to public
  using (rr_hub_is_admin())
  with check (rr_hub_is_admin());
drop policy if exists rr_hub_profile_update on public.rr_hub_profiles;
create policy rr_hub_profile_update on public.rr_hub_profiles
  as permissive
  for UPDATE
  to authenticated
  using (rr_hub_is_admin())
  with check (rr_hub_is_admin());
drop policy if exists rr_hub_profiles_escribir on public.rr_hub_profiles;
create policy rr_hub_profiles_escribir on public.rr_hub_profiles
  as permissive
  for ALL
  to authenticated
  using ((EXISTS ( SELECT 1
   FROM cm_access c
  WHERE ((c.user_id = auth.uid()) AND (c.global_role = 'direccion'::cm_global_role) AND c.is_active AND (c.revoked_at IS NULL)))))
  with check ((EXISTS ( SELECT 1
   FROM cm_access c
  WHERE ((c.user_id = auth.uid()) AND (c.global_role = 'direccion'::cm_global_role) AND c.is_active AND (c.revoked_at IS NULL)))));
drop policy if exists rr_hub_profiles_leer on public.rr_hub_profiles;
create policy rr_hub_profiles_leer on public.rr_hub_profiles
  as permissive
  for SELECT
  to authenticated
  using (true);
drop policy if exists rr_hub_projects_admin on public.rr_hub_projects;
create policy rr_hub_projects_admin on public.rr_hub_projects
  as permissive
  for ALL
  to public
  using (rr_hub_is_admin())
  with check (rr_hub_is_admin());
drop policy if exists rr_hub_wundeer_public_project_read on public.rr_hub_projects;
create policy rr_hub_wundeer_public_project_read on public.rr_hub_projects
  as permissive
  for SELECT
  to anon
  using ((slug = 'wundeer'::text));
drop policy if exists rr_hub_reference_captures_read on public.rr_hub_reference_captures;
create policy rr_hub_reference_captures_read on public.rr_hub_reference_captures
  as permissive
  for SELECT
  to public
  using ((rr_hub_is_admin() OR (EXISTS ( SELECT 1
   FROM (rr_hub_ideas i
     JOIN rr_hub_access a ON ((a.project_id = i.project_id)))
  WHERE ((i.id = rr_hub_reference_captures.idea_id) AND (a.user_id = auth.uid()))))));
drop policy if exists rr_hub_script_versions_read on public.rr_hub_script_versions;
create policy rr_hub_script_versions_read on public.rr_hub_script_versions
  as permissive
  for SELECT
  to public
  using ((rr_hub_is_admin() OR (EXISTS ( SELECT 1
   FROM (rr_hub_ideas i
     JOIN rr_hub_access a ON ((a.project_id = i.project_id)))
  WHERE ((i.id = rr_hub_script_versions.idea_id) AND (a.user_id = auth.uid()))))));
drop policy if exists rr_hub_votes_read on public.rr_hub_votes;
create policy rr_hub_votes_read on public.rr_hub_votes
  as permissive
  for SELECT
  to authenticated
  using (true);
drop policy if exists rr_hub_votes_write on public.rr_hub_votes;
create policy rr_hub_votes_write on public.rr_hub_votes
  as permissive
  for ALL
  to authenticated
  using (((lower(TRIM(BOTH FROM COALESCE(voter_email, ''::text))) = lower(TRIM(BOTH FROM COALESCE((auth.jwt() ->> 'email'::text), ''::text)))) AND rr_hub_can_vote_by_email(voter_email)))
  with check (((lower(TRIM(BOTH FROM COALESCE(voter_email, ''::text))) = lower(TRIM(BOTH FROM COALESCE((auth.jwt() ->> 'email'::text), ''::text)))) AND rr_hub_can_vote_by_email(voter_email)));
alter table public.profiles enable row level security;
alter table public.cm_access enable row level security;
alter table public.rr_hub_projects enable row level security;
alter table public.rr_hub_profiles enable row level security;
alter table public.rr_hub_access enable row level security;
alter table public.rr_hub_invites enable row level security;
alter table public.rr_hub_ideas enable row level security;
alter table public.rr_hub_assets enable row level security;
alter table public.rr_hub_comments enable row level security;
alter table public.rr_hub_events enable row level security;
alter table public.rr_hub_votes enable row level security;
alter table public.rr_hub_script_versions enable row level security;
alter table public.rr_hub_presencia enable row level security;
alter table public.rr_hub_reference_captures enable row level security;
alter table public.rr_hub_audit_settings enable row level security;

grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (p.proname like 'rr_hub_%' or p.proname = 'handle_new_user')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
    execute format('grant execute on function %s to service_role', r.sig);
  end loop;
end $$;
