-- NX-1026 fix-2: columnas que el codigo usa y ninguna migracion crea.
-- CONFIRMADO: src/lib/data.ts (lineas 1112-1113), src/lib/hub-session.ts,
-- src/lib/perfil-votante.ts y las migraciones 20260928_hub_codigo_por_cliente.sql
-- (lineas 124, 147-148), 20260928_hub_correo_sin_mayusculas.sql,
-- 20260928_hub_entrada_por_codigo.sql y 20260928_hub_equipo_predefinido.sql
-- referencian p.is_team_member / p.is_active sobre rr_hub_profiles, pero en todo
-- supabase/migrations/ no existe ni un alter table que las agregue.
-- Sin esta migracion esas cuatro migraciones fallan y el hub no puede votar.
alter table public.rr_hub_profiles
  add column if not exists is_team_member boolean not null default true,
  add column if not exists is_active      boolean not null default true;

comment on column public.rr_hub_profiles.is_team_member is
  'True para cuentas del equipo de RR; false para cuentas de cliente creadas por codigo de acceso.';
comment on column public.rr_hub_profiles.is_active is
  'False desactiva el acceso sin borrar la fila ni su historial de votos.';
