-- Las políticas del hub que comparan con `auth.uid()` también se quedaban sin
-- nada que comparar.
--
-- Ya se quitaron las de lectura de `rr_hub_access` y `rr_hub_profiles` en
-- `20260928_hub_rls_sin_sesion.sql`. Las de ESCRITURA seguían ahí, y esa es la
-- parte que importa: una escritura cuya política compara `user_id = auth.uid()`
-- con `auth.uid()` siempre NULL no está protegiendo: está cerrando. Nadie
-- puede escribir, y el error que sale no dice "no tienes permiso": dice
-- "violación de política", que no señala la causa.
--
-- La diferencia con la puerta antigua es que ahí la comparación valía. Ahora no:
-- la identidad es la cookie firmada y Postgres no la ve.
--
-- Lo que hacen estas políticas, entonces, es dejar de fingir. Se reescriben para
-- que el permiso lo decida EL SERVIDOR, que sí sabe quién entró, y que escribe
-- con la clave del servidor (`service_role`), saltándose el RLS por diseño: el
-- RLS protege al ANON y al AUTHENTICATED, y ya no hay ninguno de los dos
--
-- Con esto, `anon` y `authenticated` se quedan con lo que pueden tener:
--
--   * leer los proyectos a los que se puede entrar por código (catálogo), y
--   * nada más.
--
-- Toda escritura pasa por el servidor, que comprueba el guard antes de tocar
-- nada. Un cliente que hable directamente con PostgREST con la clave `anon` no
-- puede escribir en ninguna tabla del hub: no tiene permiso de tabla.

-- ---------------------------------------------------------------------------
-- 1. Las políticas que se quitan
-- ---------------------------------------------------------------------------
-- Todas las que comparan con `auth.uid()` o con `is_admin()` de la tabla
-- `profiles` (que es la del schema `auth`, no la del hub: `profiles` a secas
-- pertenece a otra parte de la base y no tiene nada que ver con esto).

drop policy if exists rr_hub_projects_read on public.rr_hub_projects;
drop policy if exists rr_hub_ideas_read     on public.rr_hub_ideas;
drop policy if exists rr_hub_ideas_write    on public.rr_hub_ideas;
drop policy if exists rr_hub_comments_read  on public.rr_hub_comments;
drop policy if exists rr_hub_comments_write on public.rr_hub_comments;
drop policy if exists rr_hub_events_read    on public.rr_hub_events;
drop policy if exists rr_hub_events_write   on public.rr_hub_events;
drop policy if exists rr_hub_assets_read    on public.rr_hub_assets;
drop policy if exists rr_hub_assets_write   on public.rr_hub_assets;
drop policy if exists rr_hub_ad_library_read  on public.rr_hub_ad_library;
drop policy if exists rr_hub_ad_library_write on public.rr_hub_ad_library;

-- ---------------------------------------------------------------------------
-- 2. Lo que se deja: leer el catálogo de clientes por su código
-- ---------------------------------------------------------------------------
-- El catálogo (qué clientes hay, de qué color, cómo se llaman) no es un
-- secreto: es lo que el botón de entrada necesita para decir "Wundeer" o
-- "Candilejas" cuando tecleas 1111 o 2222. El código de cada cliente es una
-- columna de `rr_hub_projects` (`access_code`), y esa columna no se le da a
-- `anon`: se lee por el servidor, que es la única forma de no mandar los
-- códigos al navegador de quien los teclea.
--
-- Por eso el catálogo sí se puede leer sin código, y el código no se puede leer
-- sin código. Lo que NO es público es qué ideas hay, quién puede hacerlas y
-- quién votó qué.

-- El catálogo va por una vista SIN la columna del código, porque a `anon` se le
-- da `select` sobre lo que sigue. Si `anon` pudiera leer `rr_hub_projects` entero,
-- leería los cuatro códigos en un GET y la puerta no sería nada.
revoke select on public.rr_hub_projects from anon, authenticated;

create or replace view public.rr_hub_catalogo as
  select id, name, slug, client_name, brand_primary_color, description
    from public.rr_hub_projects;

comment on view public.rr_hub_catalogo is
  'El catalogo de clientes SIN la columna access_code. Es lo unico que puede leer el navegador sin haber entrado. Da nombre, color y slug, que es lo que la pantalla de entrada necesita para decir que cliente es; nunca el codigo.';

grant select on public.rr_hub_catalogo to anon, authenticated;

-- El resto, solo para el servidor.

revoke all on public.rr_hub_ideas     from anon, authenticated;
revoke all on public.rr_hub_comments  from anon, authenticated;
revoke all on public.rr_hub_events    from anon, authenticated;
revoke all on public.rr_hub_assets    from anon, authenticated;
revoke all on public.rr_hub_ad_library from anon, authenticated;
revoke all on public.rr_hub_profiles  from anon, authenticated;
revoke all on public.rr_hub_access    from anon, authenticated;
revoke all on public.rr_hub_votes     from anon, authenticated;
revoke all on public.rr_hub_presencia from anon, authenticated;

grant select on public.rr_hub_projects to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. La revisión que evita que esto vuelva
-- ---------------------------------------------------------------------------
-- Cuando se toque el acceso, esta es la pregunta que hay que hacerse:
--
--      select tablename, policyname from pg_policies
--       where (qual like '%auth.uid()%' or with_check like '%auth.uid()%')
--         and tablename like 'rr_hub%';
--
-- Si eso devuelve algo, esa política depende de una sesión que ya no existe. No
-- va a dejar entrar a nadie, ni a los que deben, y el síntoma —"no puedo hacer
-- nada"— no señala que la culpa sea del RLS. Por eso la pregunta está aquí
-- escrita, y no solo en la cabeza de quien lo descubra.