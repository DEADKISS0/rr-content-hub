-- Cierra la escalada de privilegios y abre la votación. Tres agujeros, tres
-- causas, y las tres son la misma: una política que mira la FILA cuando tenía
-- que mirar la COLUMNA.
--
--
-- 1. ESCALADA: cualquiera con sesión se hacía admin a sí mismo.
--
--    `rr_hub_profile_read` es `for all` con `using (id = auth.uid())`. Eso
--    comprueba QUÉ FILA tocas, no QUÉ COLUMNA cambias: la fila es tuya, así que
--    la política te deja modificarla entera — incluido `global_role`. Con eso,
--    `rr_hub_is_admin()` devuelve true y el usuario tiene paso libre en todas
--    las demás políticas.
--
--    Comprobado en la base viva antes de escribir esto:
--      has_column_privilege('authenticated','rr_hub_profiles','global_role','update') = true
--      has_column_privilege('authenticated','rr_hub_access','role_in_project','update') = true
--
--    Lo que hace esta migración: revoca la escritura de las columnas de rango y
--    separa la lectura de la escritura. Un miembro puede LEER su fila y NADIE
--    puede cambiar su rango con su propia sesión. El rol se cambia por SQL, que
--    es lo que se quiere: es una decisión de Dirección, no del usuario.

revoke update on table public.rr_hub_profiles from authenticated;
revoke update on table public.rr_hub_access from authenticated;

drop policy if exists rr_hub_profile_read on public.rr_hub_profiles;
-- Solo LECTURA, y solo la fila propia. Sin `for all`: un `for all` con
-- `with check` sobre columnas sensibles es exactamente el agujero de arriba.
create policy rr_hub_profile_read on public.rr_hub_profiles
  for select to authenticated
  using (id = auth.uid() or rr_hub_is_admin());

drop policy if exists rr_hub_profile_update on public.rr_hub_profiles;
-- Escribir es de admin, y por service role. Un `owner` de proyecto no se
-- cambia a sí mismo desde la app.
create policy rr_hub_profile_update on public.rr_hub_profiles
  for update to authenticated
  using (rr_hub_is_admin())
  with check (rr_hub_is_admin());

drop policy if exists rr_hub_access_read on public.rr_hub_access;
create policy rr_hub_access_read on public.rr_hub_access
  for select to authenticated
  using (user_id = auth.uid() or rr_hub_is_admin());

drop policy if exists rr_hub_access_update on public.rr_hub_access;
create policy rr_hub_access_update on public.rr_hub_access
  for update to authenticated
  using (rr_hub_is_admin())
  with check (rr_hub_is_admin());


-- 2. VOTACIÓN ABIERTA AL ANON.
--
--    `rr_hub_votes` se creó en la migración de votación y nunca encendió RLS. Con
--    RLS apagado, la clave anon —que va dentro del bundle de JavaScript, o sea
--    que es pública— puede leer, insertar, actualizar y borrar votos.
--
--    Hoy la tabla tiene 0 filas, así que el agujero no ha_costado nada. En
--    cuanto haya un voto, cualquiera puede falsear el conteo que decide si la
--    pieza pasa a `pending_approval`. Y con la columna `voter_email` que se
--    añadió para la votación interna, sería además un almacén de correos.

alter table public.rr_hub_votes enable row level security;

-- RLS no basta por sí solo: mientras `anon` tenga el privilegio de tabla, la
-- petición pasa el primer filtro y llega a las políticas. Sin privilegio, se
-- queda en la puerta. Por eso hacen falta las dos cosas, y por eso el
-- verificador tiene que mirar `has_table_privilege`, no solo `relrowsecurity`:
-- con RLS encendida y privilegios puestos, la tabla parecía cerrada y no lo
-- estaba.
revoke all on table public.rr_hub_votes from anon;
revoke insert, update, delete on table public.rr_hub_votes from authenticated;
grant select on table public.rr_hub_votes to authenticated;
grant select, insert, update, delete on table public.rr_hub_votes to service_role;

drop policy if exists rr_hub_votes_read on public.rr_hub_votes;
create policy rr_hub_votes_read on public.rr_hub_votes
  for select to authenticated
  using (true);

drop policy if exists rr_hub_votes_write on public.rr_hub_votes;
-- El voto entra por la API, que usa service role tras comprobar el roster. El
-- cliente no escribe aquí: si lo hiciera, la restricción de "un voto por
-- persona y token" sería solo una sugerencia.
create policy rr_hub_votes_write on public.rr_hub_votes
  for all to authenticated
  using (false)
  with check (false);


-- 3. EL CORREO QUE NO PODÍA ENTRAR.
--
--    `rr_hub_profiles` guardaba `Tefaweb000@gmail.com` con mayúscula. El
--    middleware normaliza a minúsculas antes de comparar, así que la búsqueda
--    exacta no encontraba la fila y esa persona caía en `?sinAcceso=1` siendo
--    parte del roster. Verificado: la consulta exacta devuelve 0 filas; la
--    normalizada, 1.

update public.rr_hub_profiles set email = lower(email) where email <> lower(email);
update public.rr_hub_access a
   set user_id = p.id
  from public.rr_hub_profiles p
 where a.user_id is null
   and lower(p.email) = lower(a.user_id::text);
