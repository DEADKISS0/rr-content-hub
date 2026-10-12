-- NX-1026 fix-5: tabla que el codigo usa y ninguna migracion crea.
-- CONFIRMADO: src/lib/ad-library-server.ts selecciona
-- 'id, name, platform, format, external_url, cover_url, objective, copy_text,
--  brand, audience, metrics_note' filtrando por project_id y active, pero en
-- supabase/migrations/ solo aparecen 'drop policy' y 'revoke' sobre
-- public.rr_hub_ad_library: nadie la crea. Sin esta migracion,
-- 20260928_hub_rls_por_codigo.sql falla y el selector de anuncios esta roto.
create table if not exists public.rr_hub_ad_library (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.rr_hub_projects(id) on delete cascade,
  name text not null,
  platform text,
  format text,
  external_url text,
  cover_url text,
  objective text,
  copy_text text,
  brand text,
  audience text,
  metrics_note text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.rr_hub_ad_library enable row level security;

comment on table public.rr_hub_ad_library is
  'Catalogo de piezas de anuncios ya usadas, por proyecto. El selector de ideas nuevas lo lee; el servidor lo escribe via service_role.';
