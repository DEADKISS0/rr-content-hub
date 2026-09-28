-- ===========================================================================
-- RR CONTENT HUB · Aplicación manual en el panel de Supabase
-- Proyecto: ntgtvtzbjwotuwkiflar (RR ALIADOS) · 2026-09-28
-- ===========================================================================
--
-- ⚠️  ESTO YA ESTÁ APLICADO. No hace falta pegar nada.
--
-- Aplicado el 2026-09-28 por la Management API de Supabase con el token
-- `sbp_…` del MCP del perfil default, y verificado leyendo la base de vuelta
-- (no por el `201 []` de la API, que responde igual si no hizo nada).
-- Este archivo queda como respaldo y como registro de lo que se aplicó.
--
-- ── Lo que había y lo que se encontró ──────────────────────────────────────
--
-- PASO 1 — EL BUCKET. YA EXISTÍA. No hubo que crearlo.
--   select * from storage.buckets where id = 'rr-content-assets';
--   → id=rr-content-assets · public=true · file_size_limit=104857600
--   Comprobado además por HTTP: pedir un objeto inexistente devuelve
--   `NoSuchKey` (no `NoSuchBucket`), que es lo que dice "el bucket existe y
--   sirve". El `400` que se veía era por pedir la raíz del bucket, no un fallo.
--
-- PASO 2 — LA MIGRACIÓN. Aplicada, pero NO hacía lo que su propio SQL
-- prometía. Dos huecos, ambos porque la migración hablaba de algo que nunca
-- ocurrió:
--
--   (a) `cover_asset_id` quedó SIN llave foránea. La creó la migración v3 del
--       26 como `uuid` a secas, así que el `add column if not exists …
--       references` de esta se lo saltó. Sin FK, PostgREST no resuelve el embed
--       y contesta 400 PGRST200. Peor: `conPortadas()` envolvía esa consulta en
--       un `try/catch`, y supabase-js no lanza — devuelve `{data: null, error}`
--       — así que el error se comía solo y el tablero pintaba siempre el arte de
--       marca sin que nadie viera nada roto.
--
--   (b) `anon` podía llamar a `rr_hub_idea_cover`. El `grant execute … to
--       authenticated` NO le quita nada a `anon`: en PostgreSQL las funciones
--       NACEN con `EXECUTE` para `PUBLIC`. Medido antes de arreglarlo: `anon`
--       llamaba el RPC y recibía 200. No era una fuga —la función revalida
--       permisos a mano y devolvía `[]`— pero la "segunda barrera" que decía el
--       comentario no existía.
--
-- Por eso este archivo trae las DOS migraciones y no solo la original.
-- ===========================================================================


-- ###########################################################################
-- PASO 1 de 2 · La migración de la portada
-- ###########################################################################
-- Ya aplicada y reejecutada sin error. Se incluye entera para que el archivo
-- sirva de registro completo; `if not exists` la hace reejecutable.

alter table public.rr_hub_ideas
  add column if not exists cover_asset_id uuid
  references public.rr_hub_assets(id) on delete set null;

comment on column public.rr_hub_ideas.cover_asset_id is
  'Portada de la idea: apunta al asset reference_brief elegido. Null = se usa el arte de marca.';

create index if not exists rr_hub_ideas_cover_asset_idx
  on public.rr_hub_ideas (cover_asset_id);

create index if not exists rr_hub_assets_idea_stage_created_idx
  on public.rr_hub_assets (idea_id, asset_stage, created_at desc);

create or replace function public.rr_hub_idea_cover(p_idea_id uuid)
returns table (
  asset_id   uuid,
  file_name  text,
  mime_type  text,
  external_url text,
  storage_path text
)
language sql
stable
security definer
set search_path = public
as $$
  -- `security definer` salta las políticas de RLS de las tablas que lee, así que
  -- esta función NO puede devolver la fila sin volver a comprobar la
  -- autorización a mano. Sin esto, cualquier `anon` que llamara al RPC se
  -- llevaría el `storage_path` de los briefs de ideas de otros proyectos.
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
      with elegida as (
        select i.cover_asset_id as id
        from public.rr_hub_ideas i
        where i.id = p_idea_id and i.cover_asset_id is not null
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
$$;

comment on function public.rr_hub_idea_cover(uuid) is
  'Portada de una idea: el cover_asset_id elegido, o el reference_brief mas reciente. Null si no hay.';

grant execute on function public.rr_hub_idea_cover(uuid) to authenticated;


-- ###########################################################################
-- PASO 2 de 2 · La correctiva: la FK que faltaba y el revoke que faltaba
-- ###########################################################################
-- ESTA ES LA QUE DE VERDAD HACE ALGO. Si solo pudieras pegar una cosa, esta.

-- (a) La llave foránea que PostgREST necesita para resolver el embed.
--     Sin ella: 400 PGRST200 y la portada se pierde en silencio.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.rr_hub_ideas'::regclass
      and contype = 'f'
      and confrelid = 'public.rr_hub_assets'::regclass
  ) then
    alter table public.rr_hub_ideas
      add constraint rr_hub_ideas_cover_asset_id_fkey
      foreign key (cover_asset_id)
      references public.rr_hub_assets(id)
      on delete set null
      not valid;
    alter table public.rr_hub_ideas
      validate constraint rr_hub_ideas_cover_asset_id_fkey;
  end if;
end
$$;

comment on constraint rr_hub_ideas_cover_asset_id_fkey on public.rr_hub_ideas is
  'Portada de la idea. Sin esta FK PostgREST no resuelve el embed y conPortadas() falla en silencio.';

-- (b) El permiso del helper. El ORDEN importa: primero se revoca a PUBLIC (de
--     donde `anon` lo heredaba), después se concede a `authenticated`. Al revés
--     el grant repone lo que se acaba de quitar.
revoke execute on function public.rr_hub_idea_cover(uuid) from public;
revoke execute on function public.rr_hub_idea_cover(uuid) from anon;
grant  execute on function public.rr_hub_idea_cover(uuid) to authenticated;

comment on function public.rr_hub_idea_cover(uuid) is
  'Portada de una idea: el cover_asset_id elegido, o el reference_brief mas reciente. Null si no hay. Solo authenticated: el EXECUTE de PUBLIC por defecto se revoca.';


-- ===========================================================================
-- CÓMO VERIFICAR (copiar después de ejecutar, en el mismo editor)
-- ===========================================================================
-- Las cuatro tienen que salir como se indica. Un `[]` no demuestra nada.
--
-- 1. La FK existe  →  debe devolver UNA fila
--    select conname, convalidated, pg_get_constraintdef(oid) as def
--      from pg_constraint
--     where conrelid='public.rr_hub_ideas'::regclass
--       and confrelid='public.rr_hub_assets'::regclass;
--    esperado: rr_hub_ideas_cover_asset_id_fkey | t | FOREIGN KEY (cover_asset_id)
--              REFERENCES rr_hub_assets(id) ON DELETE SET NULL
--
-- 2. `anon` fuera  →  la lista NO debe contener anon ni "="
--    select proname, proacl from pg_proc
--     where pronamespace='public'::regnamespace and proname='rr_hub_idea_cover';
--    esperado: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
--
-- 3. El embed responde  →  200 (no PGRST200). Probar en el navegador:
--    https://<ref>.supabase.co/rest/v1/rr_hub_ideas?select=id,code,cover_asset:cover_asset_id(id)&limit=1
--    con las cabeceras apikey y Authorization de la anon key.
--
-- 4. El bucket  →  una fila con public=t y file_size_limit=104857600
--    select id, public, file_size_limit from storage.buckets
--     where id='rr-content-assets';
--
-- ===========================================================================
-- PENDIENTE QUE ESTE ARCHIVO NO ARREGLA (decidirlo aparte)
-- ===========================================================================
-- El bucket tiene `allowed_mime_types` con comodines: `image/`, `video/`,
-- `application/pdf`, `application/msword`,
-- `application/vnd.openxmlformats-officedocument.wordprocessingml.document`.
--
-- Storage compara esa lista por IGUALDAD EXACTA, no por prefijo. Medido:
--   application/pdf → pasa el filtro
--   image/png       → 415 InvalidMimeType
--   video/mp4       → 415 InvalidMimeType
--
-- O sea que HOY NO SE PUEDE SUBIR NINGUNA IMAGEN AL BUCKET, y el hub sube
-- precisamente imágenes: las portadas de las piezas. Cualquier arrangement con
-- `browser_upload_image` fallaría con 415.
--
-- Dos salidas, y es decisión de Santiago, no mía:
--   A) Enumerar los tipos de verdad (image/png, image/jpeg, image/webp, …).
--   B) Poner allowed_mime_types a NULL: se acepta cualquier formato y el límite
--      de 100 MB sigue vigente.
--
-- Hasta que se decida, NO hace falta pegar nada de esto: la app sube por
-- `uploadAsset()` en el navegador, y ese camino es el que está bloqueado.
