-- Alta de administradores iniciales del RR Content Hub.
-- Correos: santiago1209andres@gmail.com, rraliadosteam@gmail.com, juanpos1234@gmail.com
-- Estos perfiles reciben rol 'admin' en global_role, que les permite acceder a
-- /audit/admin y gestionar accesos de otros usuarios.

-- NX-1026 fix-6: el seed original insertaba perfiles sin id, pero
-- rr_hub_profiles.id es FK a auth.users(id) sin default, asi que en una base
-- limpia (sin esas cuentas en auth.users) el INSERT lanza not-null sobre id.
-- Ademas el propio repo documenta en 20260928_hub_cuentas_sin_identidad.sql que
-- preaprovisionar cuentas NO es un INSERT en auth.users: hay que crearlas por
-- la API de administracion con service_role. Por eso el seed ahora solo
-- promueve a admin los perfiles cuya cuenta YA existe en auth.users, y avisa
-- cuales faltan en vez de romper la migracion.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('santiago1209andres@gmail.com'),
      ('rraliadosteam@gmail.com'),
      ('juanpos1234@gmail.com')
    ) AS t(email)
  LOOP
    IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = lower(r.email)) THEN
      INSERT INTO rr_hub_profiles (id, email, global_role, created_at, updated_at)
      SELECT u.id, lower(r.email), 'admin', now(), now()
        FROM auth.users u WHERE lower(u.email) = lower(r.email)
      ON CONFLICT (id) DO UPDATE SET global_role = 'admin', updated_at = now();
      RAISE NOTICE 'admin promovido: %', r.email;
    ELSE
      RAISE NOTICE 'admin PENDIENTE (cuenta inexistente en auth.users): % — crearla por la API de administracion con service_role y re-ejecutar', r.email;
    END IF;
  END LOOP;
END $$;
