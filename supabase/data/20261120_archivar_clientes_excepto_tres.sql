-- Datos: archivar todos los clientes excepto tres, y dejar owner a dos personas.
--
-- NO es una migración de `supabase/migrations`. `supabase db push` no lo corre.
-- Se aplica a mano, DESPUÉS del esquema y DESPUÉS de desplegar la app:
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
--     -f supabase/data/20261120_archivar_clientes_excepto_tres.sql
--
-- Qué hace, y qué no hace:
--   * Pone archived_at = now() en todo `rr_hub_projects` que no sea uno de los
--     tres que se quedan. El filtro es por exclusión (id y slug), no una lista
--     de los que se archivan. Hoy eso deja fuera del archivo a Candilejas,
--     La Pesquera Oro del Mar y RR Interno, y archiva el resto (Wundeer,
--     Satiro Sushi, BOGA, Más Marcas, y cualquier otro que exista).
--   * No borra filas, ni ideas, ni accesos, ni códigos.
--   * Es idempotente: un cliente que ya tiene archived_at no se vuelve a tocar,
--     y el owner se puede aplicar dos veces.
--   * Asegura role_in_project = 'owner' a dos usuarios en Pesquera y RR Interno.
--     Si la fila ya existe, se actualiza. Si no, se inserta.
--
-- Reversión (no se ejecuta aquí): supabase/rollback/20261120_archivar_clientes_excepto_tres.down.sql
-- Pone archived_at = null en todo lo que no sea esos tres. El rol anterior de
-- esas cuatro filas de acceso no se puede reconstruir: este script lo pisa.

begin;

-- Los tres que siguen abiertos. Cualquier otra fila, por id y por slug, se archiva.
-- Las dos condiciones van juntas para no archivar una fila si coincide el id
-- o el slug de un cliente que se queda (un slug renombrado con el id bueno, o
-- al revés, no entra en el archivo).
update public.rr_hub_projects
   set archived_at = now(),
       archived_by = null
 where archived_at is null
   and id <> all (array[
     '92cce4ef-796d-46f5-91f1-62aadf063560'::uuid,
     'c0260d85-977b-47e4-a143-3b409103b498'::uuid,
     'd1427ada-b63e-4b15-ba53-0d9ff2aa1782'::uuid
   ])
   and slug <> all (array[
     'candilejas',
     'pesquera-oro-del-mar',
     'rr-interno'
   ]);

-- Owner en Pesquera y RR Interno. Conflicto = ya había fila: se queda en owner.
insert into public.rr_hub_access (user_id, project_id, role_in_project)
select u.user_id, p.id, 'owner'
  from (
    values
      ('9d7ba905-8481-446b-825d-6e54578b332b'::uuid),
      ('fd7496dd-bd07-4f71-9808-c4ee8be86e13'::uuid)
  ) as u(user_id)
  join public.rr_hub_projects p
    on (
      (p.id = 'c0260d85-977b-47e4-a143-3b409103b498'::uuid and p.slug = 'pesquera-oro-del-mar')
      or
      (p.id = 'd1427ada-b63e-4b15-ba53-0d9ff2aa1782'::uuid and p.slug = 'rr-interno')
    )
on conflict (user_id, project_id) do update
  set role_in_project = 'owner';

-- Si los tres clientes no están, o los dos usuarios no tienen fila owner en
-- los dos proyectos, no se deja el archivo a medias: la transacción se cae.
do $check$
declare
  vivos int;
  owners int;
begin
  select count(*) into vivos
    from public.rr_hub_projects
   where archived_at is null
     and (
       (id = '92cce4ef-796d-46f5-91f1-62aadf063560'::uuid and slug = 'candilejas')
       or (id = 'c0260d85-977b-47e4-a143-3b409103b498'::uuid and slug = 'pesquera-oro-del-mar')
       or (id = 'd1427ada-b63e-4b15-ba53-0d9ff2aa1782'::uuid and slug = 'rr-interno')
     );
  if vivos <> 3 then
    raise exception 'tienen que seguir vivos los 3 clientes (Candilejas, Pesquera, RR Interno); hay %', vivos;
  end if;

  select count(*) into owners
    from public.rr_hub_access
   where role_in_project = 'owner'
     and user_id in (
       '9d7ba905-8481-446b-825d-6e54578b332b'::uuid,
       'fd7496dd-bd07-4f71-9808-c4ee8be86e13'::uuid
     )
     and project_id in (
       'c0260d85-977b-47e4-a143-3b409103b498'::uuid,
       'd1427ada-b63e-4b15-ba53-0d9ff2aa1782'::uuid
     );
  if owners <> 4 then
    raise exception 'se esperaban 4 filas owner (2 personas x Pesquera y RR Interno); hay %', owners;
  end if;
end
$check$;

commit;
