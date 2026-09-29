-- Pedir el código NO crea cuentas. La lista blanca manda, no el alta.
--
-- Lo que pasaba (2026-09-28): `shouldCreateUser: true` en el login hace que
-- Supabase cree la cuenta de CUALQUIER correo que se escriba, esté o no en el
-- roster. El trigger `rr_hub_handle_new_user` le daba perfil, y como el perfil
-- tiene `is_team_member = false` (bien puesto), el middleware lo rechazaba
-- después — pero la cuenta ya existía, y quedaba un camino de sobra.
--
-- Aquí no se puede impedir eso desde SQL: la creación de cuentas vive en GoTrue,
-- no en un trigger. Pero sí se puede decidir desde la API, y la regla es una
-- sola: el código se pide con un correo que ya está en la lista blanca. Se
-- implementa en `src/app/api/pedir-codigo/route.ts`, que es la única vía por la
-- que la pantalla de login pide el código.
--
-- Lo que sí se fija aquí es lo que la base puede garantizar por sí misma:
--
-- 1. Que pedir el código con un correo que no está dado de alta no responda
--    distinto. Un `400` de "ese correo no existe" es un directorio de correos
--    abierto: basta con escribir direcciones y ver cuáles se rebotan. La función
--    devuelve siempre lo mismo, y la API lo traduce al mismo texto.
--
-- 2. Que la lista blanca sea la MISMA que usa el middleware para dejar pasar, y
--    no dos listas parecidas. Se expone en una vista estable.

create or replace view public.rr_hub_quien_puede_entrar
as
  select p.id,
         lower(p.email)                as email,
         p.full_name,
         p.is_team_member,
         p.is_active
    from public.rr_hub_profiles p
   where p.is_team_member
     and p.is_active;

comment on view public.rr_hub_quien_puede_entrar is
  'La lista blanca, en una sola vista. La usan el middleware, la pantalla de login y la funcion de votar: si aparecen mas nombres aqui, aparecen en todas partes, y si faltan, faltan en todas.';

-- Y una funcion de una sola linea que dice lo mismo, para no arrastrar la vista
-- ahi donde solo hace falta el si o el no.
create or replace function public.rr_hub_entra(p_email text)
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
       and p.is_active
  );
$$;

comment on function public.rr_hub_entra(text) is
  'true si ese correo puede entrar al hub. No dice nada mas: ni si la cuenta existe, ni si el codigo llego.';