-- Alta de administradores iniciales del RR Content Hub.
-- Correos: santiago1209andres@gmail.com, rraliadosteam@gmail.com, juanpos1234@gmail.com
-- Estos perfiles reciben rol 'admin' en global_role, que les permite acceder a
-- /audit/admin y gestionar accesos de otros usuarios.

INSERT INTO rr_hub_profiles (email, global_role, created_at, updated_at)
VALUES
  ('santiago1209andres@gmail.com', 'admin', now(), now()),
  ('rraliadosteam@gmail.com',      'admin', now(), now()),
  ('juanpos1234@gmail.com',        'admin', now(), now())
ON CONFLICT (email) DO UPDATE SET
  global_role = 'admin',
  updated_at  = now();
