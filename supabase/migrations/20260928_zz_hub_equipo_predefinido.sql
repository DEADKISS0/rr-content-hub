-- El equipo completo, por defecto. Y lo que separa "estar en el equipo" de
-- "poder hacer algo": entrar con su correo, y estar activo.
--
-- Hasta aquí `rr_hub_profiles` era una fila por persona, pero ser parte del
-- equipo nodecía nada. Tres huecos reales:
--
-- 1. DOS PERSONAS DEL ROSTER NO TENIAN ACCESO A NINGUN PROYECTO. Con el selector
--    de responsable exigiendo acceso al proyecto, esos dos nombres no aparecian
--    nunca: no por un bug, sino porque nadie los habia metido. Se les da
--    `client_viewer` en los tres proyectos, que es el rol que solo mira. Es la
--    lectura de "equipo por defecto": que todo el mundo pueda ver el trabajo,
--    y que asignar siga siendo una decisión de la casa.
--
-- 2. EL EQUIPO SE EXPANDIA SOLO. El trigger de alta inserta un perfil para
--    CUALQUIER cuenta nueva, y el middleware contaba eso como "esta en el
--    roster". Cualquiera que se registrara con un correo suelto entraba al hub.
--    Aquí se separan las dos cosas: `is_team_member` es la lista blanca
--    autoritativa, preprovisionada, y el trigger ya no decide. Solo se escribe
--    `false` por defecto; ponerlo en `true` sigue siendo un acto humano, y del
--    owner, no del que se registra.
--
-- 3. "VOTAR" NO ERA LO MISMO QUE "ESTAR". `rr_hub_votes` solo exigia sesion y
--    access. A partir de ahora el voto exige tres cosas: sesion, fila en el
--    equipo, y que la fila del equipo este activa.

-- ---------------------------------------------------------------------------
-- 1. La columna que separa "esta en el equipo" de "se registro ayer".
-- ---------------------------------------------------------------------------
alter table public.rr_hub_profiles
  add column if not exists is_team_member boolean not null default false;

comment on column public.rr_hub_profiles.is_team_member is
  'Lista blanca autoritativa. La preprovisiona una persona, no un trigger. Quien solo se registro tiene false y no cuenta como equipo ni como votante.';

-- Los 18 que ya estaban son el equipo. La lista se fija aqui, a mano, con lo
-- que ya habia: no se infiere de una cuenta que alguien creo por su cuenta.
update public.rr_hub_profiles set is_team_member = true where is_active;

-- La cuenta del bot no es una persona del equipo: votea por codigo, no con sesion.
update public.rr_hub_profiles
   set is_team_member = false
 where email = 'chat-rr-aliados@altruismo.app';


-- ---------------------------------------------------------------------------
-- 2. Que el trigger de alta deje de inventar miembros del equipo.
-- ---------------------------------------------------------------------------
-- Antes: inserta global_role/is_active para cualquiera. El middleware leia eso
-- como "esta en el roster" y abodia la puerta. Ahora solo deja la cuenta
-- existe; el equipo se decide aparte.
create or replace function public.rr_hub_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- La cuenta existe y su correo queda en minuscula (el login normaliza a
  -- minuscula; si el alta guardara el correo tal cual, "Tefaweb000@gmail.com"
  -- se guardaba con mayuscula y la busqueda no lo encontraba: hacia semanas que
  -- un miembro del equipo no podia entrar).
  insert into public.rr_hub_profiles (id, full_name, email, global_role, is_active, is_team_member)
  values (new.id,
          coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
          lower(new.email), 'member', true, false)
  on conflict (id) do update
    set full_name  = excluded.full_name,
        email       = excluded.email,
        updated_at  = now();

  -- El acceso por proyecto lo da la lista de invitaciones, que es humana.
  -- Esta parte ya estaba bien y se deja como estaba.
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


-- ---------------------------------------------------------------------------
-- 3. Todo el equipo ve el trabajo. Asignar sigue siendo decision de la casa.
-- ---------------------------------------------------------------------------
-- Los dos que no tenian acceso a ningun proyecto no aparecian nunca en el
-- selector de responsable. No era un bug del selector: no existia la fila.
insert into public.rr_hub_access (user_id, project_id, role_in_project)
select pr.id, pj.id, 'client_viewer'
  from public.rr_hub_profiles pr
  cross join public.rr_hub_projects pj
 where pr.email in ('chat-rr-aliados@altruismo.app', 'peraltasuarezmariaalejandra@gmail.com')
on conflict (user_id, project_id) do nothing;


-- ---------------------------------------------------------------------------
-- 4. La funcion que decide quien puede votar. Ahora son tres condiciones.
-- ---------------------------------------------------------------------------
-- OJO, una correccion que cambia el diseno: `rr_hub_votes` NO tiene `user_id`.
-- El voto se guarda con `voter_token` (un identificador opaco) y `voter_email`.
-- O sea que la identidad del votante es su CORREO, no su id de auth. Por eso la
-- regla mira el correo, y por eso hacia falta una funcion por correo y no otra.
-- Y hasta ahora bastaba con inventar un token y escribir un correo: el voto
-- contaba sin que ese correo estuviera en ninguna lista. Eso se cierra aqui.
create or replace function public.rr_hub_can_vote_by_email(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.rr_hub_profiles pr
     where lower(pr.email) = lower(coalesce(p_email, ''))
       and pr.is_team_member
       and pr.is_active
  );
$$;

comment on function public.rr_hub_can_vote_by_email(text) is
  'Votar exige: sesion con ese correo, fila en la lista blanca del equipo, y fila activa. Estar registrado no basta.';


-- ---------------------------------------------------------------------------
-- 5. La politica de la votacion, con las tres condiciones dentro.
-- ---------------------------------------------------------------------------
-- Ademas, el correo del voto tiene que ser el correo de la sesion. Antes la
-- fila de `voter_email` la escribia el cliente, sin comparar con nadie.
drop policy if exists rr_hub_votes_write on public.rr_hub_votes;

create policy rr_hub_votes_write on public.rr_hub_votes
  for all to authenticated
  using (
    lower(trim(coalesce(voter_email, ''))) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
    and public.rr_hub_can_vote_by_email(voter_email)
  )
  with check (
    lower(trim(coalesce(voter_email, ''))) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
    and public.rr_hub_can_vote_by_email(voter_email)
  );

-- Y el rol de la tabla deja de llegarle al anon: la clave anon va dentro del
-- bundle de JavaScript del navegador, o sea que es publica.
revoke all on public.rr_hub_votes from anon;
grant select on public.rr_hub_votes to authenticated;
grant insert, update, delete on public.rr_hub_votes to authenticated;
