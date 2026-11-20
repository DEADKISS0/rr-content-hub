-- DOWN de supabase/data/20261120_archivar_clientes_excepto_tres.sql
--
-- 1. Quita el archivo de todo lo que no sea Candilejas, Pesquera y RR Interno.
--    También desarchiva un cliente que se hubiera archivado después a mano,
--    si no es uno de esos tres. No borra filas.
-- 2. El owner no tiene marcha atrás fiel: este script no guardó el rol
--    anterior. El DELETE de abajo quita esas cuatro filas solo si siguen en
--    'owner'. Si esas personas ya eran owner y deben seguir siéndolo, NO
--    ejecutes el DELETE: deja el bloque comentado y no lo toques.

begin;

update public.rr_hub_projects
   set archived_at = null,
       archived_by = null
 where id <> all (array[
     '92cce4ef-796d-46f5-91f1-62aadf063560'::uuid,
     'c0260d85-977b-47e4-a143-3b409103b498'::uuid,
     'd1427ada-b63e-4b15-ba53-0d9ff2aa1782'::uuid
   ])
   and slug <> all (array[
     'candilejas',
     'pesquera-oro-del-mar',
     'rr-interno'
   ]);

-- Opcional. Borra el acceso owner que el script de datos aseguró.
-- Descomenta solo si esas filas no deben existir.
-- delete from public.rr_hub_access
--  where user_id in (
--    '9d7ba905-8481-446b-825d-6e54578b332b',
--    'fd7496dd-bd07-4f71-9808-c4ee8be86e13'
--  )
--    and project_id in (
--      'c0260d85-977b-47e4-a143-3b409103b498',
--      'd1427ada-b63e-4b15-ba53-0d9ff2aa1782'
--    )
--    and role_in_project = 'owner';

commit;
