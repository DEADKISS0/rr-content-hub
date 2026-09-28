-- Login del equipo y voto con nombre.
--
-- Contexto (2026-09-28): Santiago decidió encender el acceso. La votación por
-- token opaco servía para una anonymous abierta, pero sin identidad no se puede
-- decir "quién está conectado" ni "quién votó esto", y él pidió exactamente eso.
--
-- Lo que hace esta migración, en tres cosas y sin borrar nada:
--
-- 1. `rr_hub_votes.voter_email` — el voto pasa a poder llevar el correo de quien
--    vota. Sigue siendo opcional (`null`): los votos ya emitidos por token siguen
--    ahí y no se rompen. La unicidad sigue siendo por token, así que el mismo
--    navegador no puede doblar el voto aunque ahora tenga sesión.
--
-- 2. `rr_hub_profiles.last_seen_at` y `is_active` — para poder decir "en línea"
--    o "se conectó hace 3 horas". `is_active` es lo que hace que alguien de la
--    lista desaparezca del roster sin borrar su historial de votos y comentarios.
--
-- 3. `rr_hub_presencia` — quién tiene la app abierta ahora mismo. Es una tabla
--    aparte y no una columna, porque "en línea" es un dato que caduca en minutos
--    (se borra solo a los 15) y meterlo en el perfil ensuciaría el historial.

-- 1. El voto, con identidad opcional ------------------------------------------
alter table rr_hub_votes
  add column if not exists voter_email text;

create index if not exists rr_hub_votes_voter_email_idx
  on rr_hub_votes (voter_email)
  where voter_email is not null;

comment on column rr_hub_votes.voter_email is
  'Correo de quien voto, si estaba con sesion. Null en los votos anonymous por token: el token sigue siendo el permiso minimo.';

-- 2. Presencia en el perfil ---------------------------------------------------
alter table rr_hub_profiles
  add column if not exists last_seen_at timestamptz,
  add column if not exists is_active boolean not null default true;

comment on column rr_hub_profiles.last_seen_at is
  'Ultima vez que se vio la app con esta sesion. Se actualiza al entrar, no en cada navegacion.';

comment on column rr_hub_profiles.is_active is
  'False deja a la persona fuera del roster y del conteo de votos, sin borrar lo que ya hizo.';

-- 3. Presencia: quien esta mirando ahora -------------------------------------
create table if not exists rr_hub_presencia (
  email text primary key,
  profile_id uuid references rr_hub_profiles (id) on delete set null,
  last_seen_at timestamptz not null default now(),
  sesion_id text
);

comment on table rr_hub_presencia is
  'Sesiones abiertas. Caduca sola: una fila con mas de 15 minutos se considera cerrada.';

create index if not exists rr_hub_presencia_last_seen_idx
  on rr_hub_presencia (last_seen_at);

-- 4. Que el correo del voto exista de verdad ----------------------------------
-- Un correo a mano en el cuerpo de la petición sería un voto falsificado: basta
-- con escribir el de otra persona. El CHECK con subconsulta NO es la vía: en
-- Postgres un CHECK no puede consultar otra tabla ("cannot use subquery in
-- check constraint"), y aunque pudiera no vería `is_active` en el momento del
-- INSERT. La comprobación la hace el SERVIDOR en la acción `vote` (route.ts),
-- que es donde está la sesión y donde se puede leer el roster.

-- Las ideas de prueba y la "voting" sin votos: se limpian aparte, con su
-- verificacion. Aqui no se borra nada.
