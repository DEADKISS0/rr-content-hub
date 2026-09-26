-- ===========================================================================
-- 20260927_crm_public_read_lockdown.sql
--
-- Por que este archivo existe
-- ------------------------
-- El proyecto Supabase del Content Hub (ntgtvtzbjwotuwkiflar) todavia aloja
-- las tablas `public.profiles` y `public.projects` de un CRM compartido con
-- otros productos. Nadie las consulta ya:
--
--   - rr-content-hub no las menciona en ningun archivo de `src/`.
--   - La busqueda en el resto de los repos del equipo (rr-aliados, rr-sync,
--     rr-precontratos, dev/*, snap, src) no devuelve ninguna referencia.
--   - El unico cliente que tiene la URL de este proyecto es
--     `~/.config/rr-commander`, y su .env no llega a usar esas tablas.
--
-- Es decir: la dependencia es cero, pero la fuga sigue abierta. Un anonimo
-- con la publishable key (que es publica, va en el bundle del navegador)
-- puede leer `public.profiles` completa —correos, nombres, avatar de Google—
-- y `public.projects` con el pipeline comercial: valor total, valor pagado,
-- valor potencial, servicios y estado de cada oportunidad.
--
-- Esto NO se arregla devolviendo las tablas al hub: el problema no es de codigo
-- del hub, es que las tablas existen en un proyecto que se expone a internet.
--
-- Que hace
-- --------
-- 1. Inventaria que ve un anonimo ANTES de cambiar nada, para que el cambio
--    sea reversible si aparece un consumidor que no encontramos.
-- 2. Cierra la lectura anonima de las dos tablas y la escritura a todos.
-- 3. No borra ni una fila: los datos siguen ahi por si hay un consumidor
--    legitimo, solo deja de ser legible por cualquiera.
--
-- Si al aplicar esto algo deja de funcionar, el diagnostico es una consulta:
--   select * from public.profiles;   -- con el usuario afectado
-- y la salida esta en el log del servidor. No hace falta deshacer nada.
-- ===========================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. QUE VE UN ANONIMO HOY. Registro, por si hay que revertir.
--    Este bloque es solo lectura: no cambia el estado de la base.
-- ---------------------------------------------------------------------------
do $$
declare
  anon_can_read_profiles  boolean;
  anon_can_read_projects  boolean;
  anon_can_write_profiles boolean;
begin
  select has_table_privilege('anon', 'public.profiles', 'select') into anon_can_read_profiles;
  select has_table_privilege('anon', 'public.projects', 'select') into anon_can_read_projects;
  select has_table_privilege('anon', 'public.profiles', 'insert') into anon_can_write_profiles;

  raise notice 'CRM leakage inventory (before):';
  raise notice '  anon SELECT public.profiles = %', anon_can_read_profiles;
  raise notice '  anon SELECT public.projects = %', anon_can_read_projects;
  raise notice '  anon INSERT public.profiles = %', anon_can_write_profiles;
end $$;

-- ---------------------------------------------------------------------------
-- 2. CERRAR LA LECTURA ANONIMA.
--    revoke ... from anon es lo correcto aqui: apaga el privilegio heredado de
--    la tabla en vez deTaparlo con una politica RLS que alguien podria
--    reescribir. Las politicas las deja public.profiles_read_own / etc.; esta
--    migracion solo retira el acceso del rol anon.
-- ---------------------------------------------------------------------------
revoke all on table public.profiles from anon;
revoke all on table public.projects from anon;

-- El service_role (usado por rr-commander y por la API de automatizacion)
-- conserva el acceso completo: no se toca service_role.
--
-- authenticated conserva lo que ya tuviera. Si alguna de estas tablas
-- necesita lectura autenticada mas adelante, se Documenta y se re-otorga
-- a mano con una politica explicita — no con un revoke global.

-- ---------------------------------------------------------------------------
-- 3. ANONIMO SIGUE SIENDO ANONIMO EN EL RESTO DEL HUB.
--    Las tablas rr_hub_* siguen siendo publicamente legibles, que es el
--    requisito de Wundeer. Este archivo no las toca.
-- ---------------------------------------------------------------------------

commit;

-- ---------------------------------------------------------------------------
-- Verificacion despues de aplicar (ejecutar como postgres):
--
--   -- Debe dar false:
--   select has_table_privilege('anon', 'public.profiles', 'select');
--   select has_table_privilege('anon', 'public.projects', 'select');
--
--   -- Wundeer debe seguir leyendo (debe dar true):
--   select has_table_privilege('anon', 'public.rr_hub_ideas', 'select');
--
--   -- service_role intacto (debe dar true):
--   select has_table_privilege('service_role', 'public.profiles', 'select');
-- ===========================================================================
