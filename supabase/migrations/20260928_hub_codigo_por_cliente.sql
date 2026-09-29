-- La puerta del hub: un código de cuatro dígitos por cliente.
--
-- Decisión de Santiago (2026-09-28): fuera el acceso por correo. Entra quien
-- teclea el código del cliente. Wundeer 1111, Candilejas 2222.
--
-- Lo que cambia y lo que NO cambia:
--
-- - **Cambia quién es la persona.** Antes la identidad venía de una sesión de
--   Supabase: un correo, un id de auth, una fila en `auth.users`. Ahora es un
--   nombre de persona dentro de un proyecto, guardado en una cookie firmada.
--   No hay correos, ni contraseñas, ni `auth.uid()`, ni tabla de identidades.
--
-- - **NO cambia quién puede hacer qué.** Eso ya estaba resuelto con listas
--   positivas en `flow.ts` y una fila en `rr_hub_access`, y se queda igual. El
--   código abre la puerta del cliente; el rol de cada persona dentro de él sigue
--   mandando sobre lo que puede escribir. Sacar la autenticación no significa
--   abrirlo: significa que la puerta es más simple.
--
-- - **NO cambia el voto.** Votar sigue exigiendo `is_team_member` Y
--   `is_active`. Con la puerta por código no hay correo de sesión, así que el
--   voto se atribuye a la persona que eligió en la pantalla de acceso, y el
--   servidor comprueba que esa persona sea del equipo antes de contar el voto.
--
-- Por qué un código y no un correo con clave o un código de un uso:
--
-- - Un código de cuatro dígitos se teclea en dos segundos con el móvil en la
--   mano, y no se olvida: nadie recuerda una contraseña, pero "Wundeer es 1111"
--   se lo sabe cualquiera que haya entrado una vez.
--
-- - Es por cliente, no por persona: la puerta es la casa, y dentro de cada
--   cliente se entra con el rol que la persona tenga. Así una persona que hoy
--   está en Wundeer mañana puede estar en Candilejas sin que Dirección tenga que
--   tocar nada.

-- ---------------------------------------------------------------------------
-- 1. El código, en la tabla del proyecto. Nunca en el código.
-- ---------------------------------------------------------------------------
-- Si el código estuviera escrito en el bundle de JavaScript, lo leería cualquiera
-- que abra las herramientas del navegador, y el hub no tendría puerta: se
-- entraría escribiendo cuatro números ya publicados. Va aquí, y lo edita
-- Dirección desde `/audit/admin`.
alter table public.rr_hub_projects
  add column if not exists access_code text;

comment on column public.rr_hub_projects.access_code is
  'Codigo de cuatro digitos con el que se entra a este cliente. Se comprueba en el servidor, nunca en el navegador. El codigo NO es un permiso: entrar no da acceso a nada sin una fila en rr_hub_access.';

-- Los dos que Santiago fijo el 2026-09-28. Los otros dos quedan sin codigo: no
-- se inventan. Un cliente sin codigo no tiene puerta hasta que Dirección le
-- ponga uno.
update public.rr_hub_projects set access_code = '1111' where slug = 'wundeer';
update public.rr_hub_projects set access_code = '2222' where slug = 'candilejas';


-- ---------------------------------------------------------------------------
-- 2. La función que decide si un código abre un cliente.
-- ---------------------------------------------------------------------------
-- `security definer` porque se consulta desde el middleware, que va con la
-- clave anónima: sin esto no podría leer los códigos, que es justo lo que no
-- queremos. La función no filtra por proyecto ni devuelve nada: solo dice sí o
-- no, y solo para el codigo que se le pasa.
create or replace function public.rr_hub_codigo_abre(p_codigo text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.rr_hub_projects p
     where p.access_code is not null
       and p.access_code = p_codigo
  );
$$;

comment on function public.rr_hub_codigo_abre(text) is
  'true si ese codigo es el de algun cliente. No dice cual: decir cual seria una ayuda para probar codigos de uno en uno.';

-- Y la variante que devuelve el cliente, para el login. Va por service role, no
-- por el anon, y aun asi se mantiene aparte para que el middleware no tenga un
-- caminho que devuelva todos los clientes con solo su codigo.
create or replace function public.rr_hub_cliente_por_codigo(p_codigo text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  encontrado text;
begin
  select p.slug into encontrado
    from public.rr_hub_projects p
   where p.access_code = p_codigo
   limit 1;
  return encontrado;
end;
$$;


-- ---------------------------------------------------------------------------
-- 3. La persona entra con su nombre, y el nombre tiene que existir.
-- ---------------------------------------------------------------------------
-- El código solo dice QUÉ cliente. La persona la elige de una lista, y esa lista
-- sale de `rr_hub_access` para ESE cliente: los que tienen fila ahí. Así no se
-- puede inventar un nombre, y un nombre que no tenga acceso no entra tampoco.
--
-- La función existe para que el servidor la pueda llamar con la clave anon sin
-- exponer la tabla entera: devuelve nombres y correos de la gente con acceso al
-- cliente del codigo, y nada mas.
create or replace function public.rr_hub_equipo_del_cliente(p_codigo text)
returns table (nombre text, correo text, rol text)
language sql
stable
security definer
set search_path = public
as $$
  select p.full_name, lower(p.email), a.role_in_project
    from public.rr_hub_projects pr
    join public.rr_hub_access a on a.project_id = pr.id
    join public.rr_hub_profiles p on p.id = a.user_id
   where pr.access_code = p_codigo
     and p.full_name is not null
     and p.is_active
   order by p.full_name;
$$;

comment on function public.rr_hub_equipo_del_cliente(text) is
  'La gente que puede entrar a ese cliente: la que tiene fila de acceso en el. Es la lista de la pantalla de entrada, y no sale nadie mas.';

-- Y la comprobacion final, en un solo sitio: el codigo abre el cliente Y esa
-- persona tiene fila en ese cliente. Las dos cosas, o ninguna.
create or replace function public.rr_hub_puede_entrar(p_codigo text, p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
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
$$;

comment on function public.rr_hub_puede_entrar(text, text) is
  'La puerta, en una sola respuesta: codigo correcto, persona con acceso a ESE cliente, del equipo y activa. Las tres, o no entra.';