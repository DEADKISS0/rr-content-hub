-- La presencia: quién del equipo está conectado ahora mismo.
--
-- Por qué esto lleva RLS y la tabla no lo tenía: `rr_hub_presencia` se creó
-- en la migración de login sin políticas, y con RLS desactivado la clave anon
-- podía leerla entera. No es una tabla de contenido: es la lista de quién está
-- trabajando ahora mismo, con su correo. Eso es exactamente el tipo de dato que
-- no se expone por accidente.
--
-- La regla es estrecha a propósito: cada quien ve su propia fila, y cualquiera
-- con sesión ve la de los demás (que es lo que hace falta para pintar "el equipo
-- está en línea"). Lo que no se puede es sin sesión, ni escribir la fila de otro.

alter table public.rr_hub_presencia enable row level security;

drop policy if exists rr_hub_presencia_read on public.rr_hub_presencia;
create policy rr_hub_presencia_read on public.rr_hub_presencia
  for select to authenticated
  using (true);

drop policy if exists rr_hub_presencia_write_own on public.rr_hub_presencia;
create policy rr_hub_presencia_write_own on public.rr_hub_presencia
  for insert to authenticated
  with check (email = (auth.jwt() ->> 'email'));

drop policy if exists rr_hub_presencia_update_own on public.rr_hub_presencia;
create policy rr_hub_presencia_update_own on public.rr_hub_presencia
  for update to authenticated
  using (email = (auth.jwt() ->> 'email'))
  with check (email = (auth.jwt() ->> 'email'));

drop policy if exists rr_hub_presencia_delete_own on public.rr_hub_presencia;
create policy rr_hub_presencia_delete_own on public.rr_hub_presencia
  for delete to authenticated
  using (email = (auth.jwt() ->> 'email'));
