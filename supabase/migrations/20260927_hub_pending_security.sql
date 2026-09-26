-- ===========================================================================
-- 20260927_hub_pending_security.sql
--
-- Qué cierra este archivo, y por qué cada cosa está aquí
-- ----------------------------------------------------
-- Tres huecos verificados en vivo el 2026-09-26 contra el proyecto
-- ntgtvtzbjwotuwkiflar, ninguno cubierto por mis migraciones anteriores:
--
--  1. FUGA VIVA: `public.profiles` (7 filas) y `public.projects` (10 filas)
--     son legibles por cualquiera con la publishable key, que va en el bundle
--     del navegador. Sondado: `curl .../rest/v1/profiles?select=*&limit=1`
--     devuelve 200 con datos. Son tablas de un CRM compartido que ningún
--     archivo de `src/` consulta. Aquí se les retira el acceso anónimo sin
--     borrar una sola fila.
--
--  2. EL BUCKET NO EXISTE: la API de Storage responde 404 NoSuchBucket para
--     `rr-content-assets`. `signedAssetUrl()` usa `getPublicUrl()`, así que
--     cada entrega compartida daba una URL rota en vez de un error visible.
--     Se crea público a propósito: las entregas de Wundeer se comparten con el
--     espacio público. Si algún día pasan a privadas, hay que cambiar juntos
--     este bloque y `signedAssetUrl()`.
--
--  3. CÓDIGOS DUPLICADOS: `code` se calcula con max+1 y se inserta sin
--     restricción única, así que dos creaciones simultáneas escriben el mismo
--     código. Se añade el índice único parcial y el código reintenta ante
--     23505 (esa parte va en el código, no aquí).
--
-- Idempotente: se puede aplicar dos veces sin romper nada.
-- Aditiva: no borra tablas, no renombra columnas, no toca datos de ideas.
-- ===========================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Inventario ANTES de cambiar nada. Solo lectura: deja constancia en el log
--    de qué veía un anónimo, para poder revertir con criterio si aparece un
--    consumidor de esas tablas que no encontramos.
-- ---------------------------------------------------------------------------
do $$
declare
  anon_read_profiles boolean;
  anon_read_projects boolean;
  filas_profiles     bigint;
  filas_projects     bigint;
begin
  select has_table_privilege('anon', 'public.profiles', 'select') into anon_read_profiles;
  select has_table_privilege('anon', 'public.projects', 'select') into anon_read_projects;
  select count(*) into filas_profiles from public.profiles;
  select count(*) into filas_projects from public.projects;

  raise notice 'CRM antes del cierre: anon SELECT profiles=%, projects=%; filas=% / %',
    anon_read_profiles, anon_read_projects, filas_profiles, filas_projects;
exception when undefined_table then
  raise notice 'Las tablas del CRM no existen en este proyecto: nada que cerrar.';
end $$;

-- ---------------------------------------------------------------------------
-- 2. Cerrar la lectura anónima del CRM huérfano.
--    `revoke` sobre el rol es lo correcto aquí: apaga el privilegio heredado
--    de la tabla, en vez de taparlo con una política RLS que alguien podría
--    reescribir. No se toca `service_role` ni `authenticated`.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.profiles') is not null then
    execute 'revoke all on table public.profiles from anon';
  end if;
  if to_regclass('public.projects') is not null then
    execute 'revoke all on table public.projects from anon';
  end if;
  raise notice 'CRM: acceso anónimo retirado (los datos siguen ahí).';
end $$;

-- ---------------------------------------------------------------------------
-- 3. El bucket de assets, con las políticas de storage que lo acompañan.
--    El orden importa: primero el bucket, después las políticas.
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

drop policy if exists rr_hub_wundeer_auth_storage_insert on storage.objects;
create policy rr_hub_wundeer_auth_storage_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'rr-content-assets' and (name like 'wundeer/%' or public.rr_hub_is_admin()));

drop policy if exists rr_hub_wundeer_auth_storage_delete on storage.objects;
create policy rr_hub_wundeer_auth_storage_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'rr-content-assets' and public.rr_hub_is_admin());

drop policy if exists rr_hub_storage_read on storage.objects;
create policy rr_hub_storage_read on storage.objects
  for select using (bucket_id = 'rr-content-assets');

-- ---------------------------------------------------------------------------
-- 4. Código único por proyecto y tipo.
--    Primero se comprueba que no haya duplicados: si los hay, es mejor fallar
--    aquí con un mensaje claro que dejar el índice a medias. NO se borra nada
--    automáticamente — decidir cuál de las dos piezas duplicadas se renombra
--    es una decisión humana.
-- ---------------------------------------------------------------------------
do $$
declare
  duplicados integer;
  ejemplo    text;
begin
  select count(*), string_agg(formato, ', ') into duplicados, ejemplo
  from (
    select project_id || ' · ' || content_type || ' · ' || code ||
           ' (' || count(*) || ' veces)' as formato
      from public.rr_hub_ideas
     where code is not null
     group by project_id, content_type, code
    having count(*) > 1
  ) d;

  if duplicados > 0 then
    raise exception 'Hay % códigos duplicados (%). Renómbralos a mano antes de crear el índice; el detalle está en la consulta comentada al final de este archivo.', duplicados, ejemplo;
  end if;
  raise notice 'Códigos: sin duplicados, se puede crear el índice único.';
end $$;

create unique index if not exists rr_hub_ideas_code_unique
  on public.rr_hub_ideas (project_id, content_type, code)
  where code is not null;

commit;

-- ---------------------------------------------------------------------------
-- Lo que este archivo NO hace, a propósito
-- ---------------------------------------------------------------------------
--
-- · No cierra la ventana de auditoría (`rr_hub_audit_settings`). La bandera se
--   puede apagar, pero eso no restringe nada hoy: ninguna ruta consulta esa
--   tabla para decidir si muestra el panorama; solo el panel de admin la usa
--   para pintar un aviso. Apagarla daría una sensación falsa de puerta
--   cerrada. Si se quiere cerrar de verdad, es un cambio de código en
--   src/app/audit/[projectSlug]/page.tsx, no una bandera.
--
-- · No borra las filas que dejó la auditoría del 2026-09-25. Van aparte y a
--   mano, porque borrar datos es una decisión del dueño, no del que limpia:
--
--     delete from public.rr_hub_comments where body = 'probe-hermes';
--     delete from public.rr_hub_ideas    where title = 'RR-AUDIT-PROBE-DELETE-ME';
--
-- ---------------------------------------------------------------------------
-- Verificación después de aplicar
-- ---------------------------------------------------------------------------
--
--   -- El CRM deja de ser legible por anónimos (esperado: false / false):
--   select has_table_privilege('anon', 'public.profiles', 'select');
--   select has_table_privilege('anon', 'public.projects', 'select');
--
--   -- Wundeer sigue siendo público (esperado: true):
--   select has_table_privilege('anon', 'public.rr_hub_ideas', 'select');
--
--   -- service_role intacto (esperado: true):
--   select has_table_privilege('service_role', 'public.profiles', 'select');
--
--   -- El bucket existe y es público (esperado: 1 fila, public = true):
--   select id, public, file_size_limit from storage.buckets where id = 'rr-content-assets';
--
--   -- El índice único existe (esperado: 1 fila):
--   select indexname from pg_indexes
--    where tablename = 'rr_hub_ideas' and indexname = 'rr_hub_ideas_code_unique';
--
--   -- Duplicados que impedirían el índice (esperado: 0 filas):
--   select project_id, content_type, code, count(*)
--     from public.rr_hub_ideas where code is not null
--    group by 1,2,3 having count(*) > 1;
-- ===========================================================================
