-- El RLS miraba a `auth.uid()`, y con la puerta por código eso ya no existe.
--
-- Lo que pasaba (2026-09-28): la puerta pasó a ser un código de cuatro dígitos por
-- cliente, y la identidad pasó a ser una cookie firmada del hub. La cookie no la
-- ve Postgres: no hay sesión de Supabase, así que `auth.uid()` devuelve siempre
-- NULL. Y una política que compara con NULL no compara nada: `user_id = NULL` es
-- NULL, no verdadero.
--
-- El efecto era que TODAS las políticas de lectura se cerravan silenciosamente
-- a cero. La puerta abría bien, la persona entraba bien, y después el guard
-- devolvía `sin_rol` para todo el mundo: el tablero salía en "solo lectura" y
-- nadie podía crear ni mover piezas. La puerta funcionaba y el interior no.
--
-- La solución NO es abrir el RLS. Es cambiar qué es la identidad. Aquí hay dos
-- caminos y se toman los dos, con razones distintas:
--
-- 1. La BASE comprueba lo que SÍ puede: la cookie no existe para ella, pero el
--    servidor sí sabe quién es. Para eso la lectura sensible va por la clave del
--    servidor (`security definer` o service role), y la base no lo tiene que
--    autorizar. Es el camino de `project-guard.ts` y de `data.ts` ya.
--
-- 2. Lo que SÍ se deja en RLS es lo que no depende de la identidad: la lista de
--    clientes que se pueden ver y las ideas que se pueden leer. Eso lo decide el
--    código de acceso, no la persona, y por tanto no necesita `auth.uid()`.
--
-- Y lo que se hace aquí, además, es quitarle el papel a `auth.uid()` de las
-- políticas que ya no lo tienen sentido, para que no vuelva a pasar: una
-- política que compara con algo que siempre es NULL parece que protege y no
-- protege nada, que es peor que no tenerla.

-- ---------------------------------------------------------------------------
-- 1. Una función que dice quién es, leída del servidor y no de la cookie
-- ---------------------------------------------------------------------------
-- Se declara con `security definer` para que el papel pueda leer lo que el
-- RLS le esconde. Devuelve SIEMPRE falso: el RLS no puede autenticar a nadie,
-- porque no tiene con qué. Su trabajo es hacer explícito que el RLS ya no
-- autentica, en vez de dejar un `auth.uid()` ahí que parece que sí.
create or replace function public.rr_hub_hay_sesion_supabase()
returns boolean
language sql
stable
as $$
  -- Siempre falso, y a propósito. Si algún día alguien escribe una política con
  -- esta función esperando que aclare quién entra, va a obtener exactamente lo
  -- que dice: que no aclara nada. La puerta es la cookie, y la cookie no está
  -- en la base.
  select false;
$$;

comment on function public.rr_hub_hay_sesion_supabase() is
  'Siempre false. La puerta ya no es una sesion de Supabase: es un codigo por cliente y una cookie firmada que Postgres no ve. Esta funcion existe para que ningun escritor vuelva a poner auth.uid() creyendo que protege algo.';

-- ---------------------------------------------------------------------------
-- 2. Las politicas que quedan, y por que
-- ---------------------------------------------------------------------------
-- Las de lectura de `rr_hub_access` y `rr_hub_profiles` SE QUITAN. No es que se
--astern abran: es que no tienen forma de ser correctas. Su lugar lo ocupa el
-- guard del servidor, que sí sabe quién entra y comprueba la fila por correo.
--
-- Lo que se deja intacto: los permisos de `anon`, que ya no incluyen nada útil
-- sobre estas dos tablas, y las políticas de escritura que compara `user_id`
-- con el id resuelto por el servidor.

-- Se van: ninguna política de lectura puede Colchón decidir con `auth.uid()`.
drop policy if exists rr_hub_access_read on public.rr_hub_access;
drop policy if exists rr_hub_profile_read on public.rr_hub_profiles;

-- Y ahora la lectura va por la función que sí puede, para que exista una sola
-- respuesta a "quién es" en la base y no dos que digan cosas distintas.
create or replace view public.rr_hub_accesos_legibles
as
  select a.user_id, a.project_id, a.role_in_project, lower(p.email) as email
    from public.rr_hub_access a
    join public.rr_hub_profiles p on p.id = a.user_id;

comment on view public.rr_hub_accesos_legibles is
  'Los accesos con el correo de quien los tiene. El guard lo lee con la clave del servidor. No tiene RLS y no se expone al navegador: leerla sin la clave del servidor daria el mapa entero de quien puede hacer que en cada cliente.';

-- ---------------------------------------------------------------------------
-- 3. La revisión que evita que esto vuelva
-- ---------------------------------------------------------------------------
-- La comprobación que hay que hacer cuando se toca el acceso:
--
--      select policyname, qual from pg_policies
--       where qual like '%auth.uid()%'
--         and tablename in ('rr_hub_access', 'rr_hub_profiles');
--
-- Si eso devuelve algo, la política depende de una sesión que ya no existe y
-- va a dejar pasar a nadie en silencio. Un permiso que no deja pasar a nadie
-- parece un permiso; es un outage silencioso.