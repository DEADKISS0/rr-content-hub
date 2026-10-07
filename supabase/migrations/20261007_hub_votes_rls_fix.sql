-- AUDIT 2026-10-07: cerrar rr_hub_votes a anon y escrituras directas.
-- La aplicacion escribe y lee votos exclusivamente con service_role desde la API.

alter table if exists public.rr_hub_votes enable row level security;
alter table if exists public.rr_hub_votes force row level security;

revoke all on table public.rr_hub_votes from anon;
revoke all on table public.rr_hub_votes from authenticated;
grant select, insert, update, delete on table public.rr_hub_votes to service_role;

-- Quitar politicas antiguas que permitian lectura o escritura directa.
drop policy if exists rr_hub_votes_read on public.rr_hub_votes;
drop policy if exists rr_hub_votes_write on public.rr_hub_votes;
drop policy if exists rr_hub_votes_authenticated_read on public.rr_hub_votes;
drop policy if exists rr_hub_votes_service_write on public.rr_hub_votes;

comment on table public.rr_hub_votes is
  'Votos internos. Acceso solo por la API del Hub con service_role; anon y authenticated no acceden directamente.';
