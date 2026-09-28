-- Corrección de 20260928_hub_idea_cover.sql: la llave foránea que faltaba y el
-- `revoke` que el grant no fazia.
-- 2026-09-28 · proyecto Wundeer
--
-- Por qué esto existe: la migración anterior se aplicó y dejó dos cosas sin
-- efecto, ambas porque su propio SQL promete lo contrario. No es un problema de
-- lógica sino de alcance, y solo se ve mirando la base después de aplicar.
--
--   1. `cover_asset_id` quedó SIN llave foránea. La columna la había creado
--      20260926_hub_v3_board_feed_search.sql como `uuid` a secas, y el
--      `add column if not exists ... references` de la migración del 28 no hizo
--      nada: `if not exists` sobre una columna que YA existe no le añade
--      constraints. Sin FK, PostgREST no encuentra la relación y la consulta
--      anidada que usa la app responde PGRST200:
--
--        ?select=id,cover_asset(id,file_name)  →  400 PGRST200
--        "Could not find a relationship between 'rr_hub_ideas' and 'cover_asset'"
--
--      Y como `conPortadas()` envuelve esa consulta en un `try/catch` con un
--      comentario que dice "sin portadas elegidas", el error se comía solo: el
--      tablero pintaba siempre el arte de marca y nadie veía un fallo. Una
--      columna de puntero sin FK es un entero que apunta a la nada.
--
--   2. `grant execute ... to authenticated` NO le quitó el permiso a `anon`.
--      En PostgreSQL las funciones nacen con `EXECUTE` para `PUBLIC`, así que
--      además del grant hay que revocar. Comprobado en la base antes de fixear:
--      `anon` llamaba al RPC y recibía 200. El comentario de la migración
--      ("denegar el permiso a anon es la segunda barrera") describía una
--      barrera que no existía.
--
-- La mitigación de dentro (la función revalida `rr_hub_is_admin()` y
-- `rr_hub_access` a mano porque es `security definer`) sí estaba y sí funciona:
-- el `anon` recibía `[]`, sin filas. No era una fuga de datos: es la diferencia
-- entre una barrera y dos. El RLS tampoco se ve afectado: la
-- función corre como `postgres` y salta las políticas de `rr_hub_assets` por
-- diseño, así que quitarle el permiso a `anon` no cambia lo que puede leer
-- quien ya tenía sesión.
--
-- Ningún archivo del código llama al RPC: `conPortadas()` resuelve la regla
-- "elegida, si no la más reciente" con DOS consultas de tabla, no con la
-- función. Por eso revoke no rompe nada (verificado con `grep -rn "rpc(" src/`
-- → 0 resultados).

-- ---------------------------------------------------------------------------
-- 1. La llave foránea que PostgREST necesita
-- ---------------------------------------------------------------------------
-- Sin nombre explícito la genera `rr_hub_ideas_cover_asset_id_fkey`, que es lo
-- que lee PostgREST. Se declara NOT VALID primero por si algún día alguien
-- tiene una portada apuntando a un asset borrado: validar la FK no puede
-- fallar la migración entera y dejar el hub a medias. Hoy no hay ninguna fila
-- con `cover_asset_id` puesta (28 ideas, 0 con valor), así que la validación
-- es un formality — pero `on delete set null` se encarga de que siga así.

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.rr_hub_ideas'::regclass
      and contype = 'f'
      and conrelid = 'public.rr_hub_ideas'::regclass
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

-- ---------------------------------------------------------------------------
-- 2. El permiso del helper: `authenticated` sí, `anon` no
-- ---------------------------------------------------------------------------
-- El orden importa: primero se revoca a `PUBLIC` (que es de donde `anon` lo
-- heredaba), después se concede a `authenticated`. Al revés, el grant
-- repondría a `anon` lo que se acaba de quitar.

revoke execute on function public.rr_hub_idea_cover(uuid) from public;
revoke execute on function public.rr_hub_idea_cover(uuid) from anon;
grant  execute on function public.rr_hub_idea_cover(uuid) to authenticated;

comment on function public.rr_hub_idea_cover(uuid) is
  'Portada de una idea: el cover_asset_id elegido, o el reference_brief mas reciente. Null si no hay. Solo authenticated: el EXECUTE de PUBLIC por defecto se revoca.';

-- ---------------------------------------------------------------------------
-- 3. Aviso sobre el embed en el cliente
-- ---------------------------------------------------------------------------
-- Con la FK viva, la relación existe, pero el NOMBRE del embed lo decide la
-- columna: `cover_asset_id(...)`, no `cover_asset(...)`. PostgREST no acepta
-- un alias suelto; si se quiere el nombre corto, el alias va con dos puntos:
-- `cover_asset:cover_asset_id(id, file_name)`. Verificado contra la base el
-- 2026-09-28, con la anon key y una idea real de Wundeer.
--
-- El RPC no se usa desde el cliente: una función de tabla por PostgREST no es
-- `select` y no se puede encadenar con `order`, así que la app sigue con las
-- dos consultas. La función queda como contrato de datos para SQL (auditorías,
-- reportes) y como documentación ejecutable de la regla.
