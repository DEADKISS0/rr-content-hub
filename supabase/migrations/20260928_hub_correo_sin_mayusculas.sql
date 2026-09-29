-- Correo que no distingue mayusculas, y el equipo dentro y no antes.
--
-- Lo que se rompió de verdad (2026-09-28): `rr_hub_profiles_email_key` es un
-- indice UNICO sobre `email` tal cual. El alta de cuenta corre un trigger que
-- escribe el correo SIN normalizar, asi que un correo con mayuscula y el mismo
-- con minusculas son dos valores distintos para el indice. Consecuencia real:
-- al pedir el codigo de acceso, Supabase insertaba el perfil y reventaba con
--
--     duplicate key value violates unique constraint "rr_hub_profiles_email_key"
--
-- o sea que a una persona del equipo le era IMPOSIBLE entrar, y el error que veia
-- no tenia nada que ver con un correo duplicado.
--
-- El indice pasa a ser sobre `lower(email)`, que es como se comparan de verdad:
-- el login normaliza a minusculas, asi que la clave tiene que hablar el mismo
-- idioma que la puerta.

-- 1. El indice correcto. Antes hay que soltar duplicados reales si los hubiera.
do $$
declare
  duplicado record;
begin
  for duplicado in
    select a.id as conservar, b.id as sobrante
      from public.rr_hub_profiles a
      join public.rr_hub_profiles b
        on lower(a.email) = lower(b.email) and a.id > b.id
  loop
    -- La fila sobrante se le pasa su acceso y sus ideas a la que se conserva, y
    -- solo entonces se borra. Nada de ideas sin dueno.
    update public.rr_hub_ideas set created_by = duplicado.conservar
     where created_by = duplicado.sobrante;

    insert into public.rr_hub_access (user_id, project_id, role_in_project)
    select duplicado.conservar, project_id, role_in_project
      from public.rr_hub_access where user_id = duplicado.sobrante
    on conflict (user_id, project_id) do nothing;

    delete from public.rr_hub_access where user_id = duplicado.sobrante;
    delete from public.rr_hub_profiles where id = duplicado.sobrante;
  end loop;
end
$$;

-- No es un indice suelto: `rr_hub_profiles_email_key` es una RESTRICCION de
-- unicidad, y por eso `drop index` no la toca. Hay que quitar la restriccion.
alter table public.rr_hub_profiles drop constraint if exists rr_hub_profiles_email_key;

create unique index rr_hub_profiles_email_unique
  on public.rr_hub_profiles (lower(email));

comment on index public.rr_hub_profiles_email_unique is
  'El correo no distingue mayusculas: el login normaliza a minusculas y la clave tiene que hablar el mismo idioma que la puerta.';


-- 2. El trigger escribe en minusculas. Con el indice ya en lower(), tambien
--    podria dejar de importar, pero se arregla la causa y no solo el sintoma.
create or replace function public.rr_hub_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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
$$;


-- 3. Que entrar NO cree cuentas. El codigo tiene que poder abrir la puerta a
--    alguien que ya esta en el roster, y solo a el.
--
--    Sin esto, pedir un codigo con cualquier correo creaba una cuenta nueva, y
--    como el middleware historicamente contó "tener perfil" como "estar en el
--    roster", eso era una puerta abierta para cualquiera que se inventara un
--    correo. Ahora el alta queda en las manos de Direccion: si el correo no esta
--    en la lista blanca, no hay cuenta, y por lo tanto no hay sesion.
--
--    Con parametro, que es lo unico que se puede llamar de verdad desde fuera.
create or replace function public.rr_hub_puede_crear_cuenta(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.rr_hub_profiles p
     where lower(p.email) = lower(coalesce(p_email, ''))
       and p.is_team_member
  );
$$;

comment on function public.rr_hub_puede_crear_cuenta(text) is
  'Solo se puede pedir codigo con un correo que YA esta en la lista blanca del equipo. Pedirlo con otro correo no crea cuenta: no se responde que correos existen, y no se abre la puerta a un invento.';


-- Lo que NO queda aqui: un indice unico sobre `auth.users(lower(email))`. Seria
-- lo bonito, pero el rol de este proyecto no es dueño de `auth.users` y la
-- sentencia no se puede aplicar desde aqui. No hace falta para lo que se
-- pide, y una restriccion que no se puede crear es peor que ninguna: `SIGNUP`
-- queda en manos de Direccion, no en las del que se invente un correo.