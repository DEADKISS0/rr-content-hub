-- RR Content Hub — roster inicial del equipo (2026-09-27)
--
-- Por qué existe: `rr_hub_access` estaba VACÍA en producción. La regla de
-- autorización del hub es "tu rol en esta tabla", así que la consecuencia era
-- literal: iniciar sesión y recibir 401 igual, sin salida salvo por este script.
-- El formulario de creación no estaba roto — no había a quién decirle que sí.
--
-- Es reproducible e idempotente: se puede volver a aplicar sin duplicar nada.
-- La fuente de verdad del roster es el directorio de DashWeb; si alguien entra
-- o sale del equipo, se actualiza AQUÍ y se vuelve a correr.
--
-- Para aplicarla:
--   POST https://api.supabase.com/v1/projects/<ref>/database/query
--   body: {"query": "<contenido de este archivo>"}
--
-- Los correos que no tenían cuenta en `auth.users` se crearon aparte, sin
-- contraseña y con `email_confirmed_at` puesto: nadie puede entrar con una
-- contraseña inventada, solo con magic link o Google.

-- 1. Perfiles. `global_role` gobierna `/audit/admin`; el rol de proyecto vive
--    en la tabla siguiente. Los tres directivos quedan como admin.
insert into public.rr_hub_profiles (id, full_name, email, global_role)
select u.id, v.full_name, v.email,
       case when v.admin then 'admin' else 'member' end
from (values
  ('santiago1209andres@gmail.com',        'Andrés Santiago Rosas Rios',   true),
  ('andreshadechine.rraliados@gmail.com', 'Andrés Felipe Hadechine Licona', true),
  ('juanpos1234@gmail.com',               'Juan Manuel Mesa Posada',     true),
  ('rraliadosteam@gmail.com',             'RR Aliados',                  true),
  ('samugarc6@gmail.com',                 'Samuel Garcia Castaño',       false),
  ('Tefaweb000@gmail.com',                'Sthefany Diaz',                false),
  ('somewherelek@gmail.com',              'Samuel Zuluaga Morales',      false),
  ('jmespitiag@gmail.com',                'Juan Martín Espitia González', false),
  ('jimenez.ochoa.samuel@gmail.com',      'Samuel Jiménez Ochoa',        false),
  ('carlosbeltranpardo@gmail.com',        'Carlos Beltrán pardo',        false),
  ('benitezestiven122@gmail.com',         'Estiven Serna Benítez',       false),
  ('santiagomedinalopez@gmail.com',       'Santiago Medina Lopez',       false),
  ('juliandvr24@gmail.com',               'Julian David Velasquez Rodriguez', false),
  ('juansebastianv19@gmail.com',          'Juan Sebastian Vargas Cruz',  false),
  ('metriklabopt@gmail.com',              'Alejandra Suarez',            false),
  ('maria2002morales@gmail.com',          'María Isabel Morales Vargas', false)
) as v(email, full_name, admin)
join auth.users u on lower(u.email) = lower(v.email)
on conflict (id) do update
  set full_name = excluded.full_name,
      email = excluded.email,
      global_role = excluded.global_role,
      updated_at = now();

-- 2. Rol por proyecto. El rol no es un adorno: `allowedTransitions()` en
--    `src/lib/flow.ts` decide con él qué transiciones existen. Por eso los roles
--    NO se inventan: cada uno sale del puesto real en DashWeb.
--
--    owner         → dirección: puede desbloquear cualquier estado
--    creator       → quien propone ideas y escribe el guion
--    camera        → camarógrafo/modelo: avanza desde guion aprobado
--    editor        → edición: crudo, montaje, corte
--    media_buyer   → pauta: publication
--    client_viewer → solo lectura
insert into public.rr_hub_access (user_id, project_id, role_in_project)
select u.id, p.id, v.role
from (values
  -- WUNDEER (proyecto vivo)
  ('santiago1209andres@gmail.com',        'wundeer', 'owner'),
  ('andreshadechine.rraliados@gmail.com', 'wundeer', 'owner'),
  ('juanpos1234@gmail.com',               'wundeer', 'owner'),
  ('rraliadosteam@gmail.com',             'wundeer', 'owner'),
  ('samugarc6@gmail.com',                 'wundeer', 'creator'),
  ('Tefaweb000@gmail.com',                'wundeer', 'creator'),
  ('somewherelek@gmail.com',              'wundeer', 'creator'),
  ('jmespitiag@gmail.com',                'wundeer', 'editor'),
  ('jimenez.ochoa.samuel@gmail.com',      'wundeer', 'editor'),
  ('carlosbeltranpardo@gmail.com',        'wundeer', 'editor'),
  ('benitezestiven122@gmail.com',         'wundeer', 'editor'),
  ('santiagomedinalopez@gmail.com',       'wundeer', 'editor'),
  ('juliandvr24@gmail.com',               'wundeer', 'camera'),
  ('juansebastianv19@gmail.com',          'wundeer', 'camera'),
  ('metriklabopt@gmail.com',              'wundeer', 'media_buyer'),
  ('maria2002morales@gmail.com',          'wundeer', 'client_viewer'),
  -- SATIRO y BOGA: el mismo equipo, solo lectura hasta que haya piezas.
  -- Owner para que la dirección pueda preparar el tablero sin pedir SQL.
  ('santiago1209andres@gmail.com',        'satiro', 'owner'),
  ('andreshadechine.rraliados@gmail.com', 'satiro', 'owner'),
  ('juanpos1234@gmail.com',               'satiro', 'owner'),
  ('rraliadosteam@gmail.com',             'satiro', 'owner'),
  ('samugarc6@gmail.com',                 'satiro', 'client_viewer'),
  ('somewherelek@gmail.com',              'satiro', 'client_viewer'),
  ('jmespitiag@gmail.com',                'satiro', 'client_viewer'),
  ('juliandvr24@gmail.com',               'satiro', 'client_viewer'),
  ('juansebastianv19@gmail.com',          'satiro', 'client_viewer'),
  ('metriklabopt@gmail.com',              'satiro', 'client_viewer'),
  ('santiago1209andres@gmail.com',        'boga', 'owner'),
  ('andreshadechine.rraliados@gmail.com', 'boga', 'owner'),
  ('juanpos1234@gmail.com',               'boga', 'owner'),
  ('rraliadosteam@gmail.com',             'boga', 'owner'),
  ('samugarc6@gmail.com',                 'boga', 'client_viewer'),
  ('somewherelek@gmail.com',              'boga', 'client_viewer'),
  ('jmespitiag@gmail.com',                'boga', 'client_viewer'),
  ('juliandvr24@gmail.com',               'boga', 'client_viewer'),
  ('juansebastianv19@gmail.com',          'boga', 'client_viewer'),
  ('metriklabopt@gmail.com',              'boga', 'client_viewer')
) as v(email, project_slug, role)
join auth.users u on lower(u.email) = lower(v.email)
join public.rr_hub_projects p on p.slug = v.project_slug
on conflict (user_id, project_id) do update
  set role_in_project = excluded.role_in_project;
