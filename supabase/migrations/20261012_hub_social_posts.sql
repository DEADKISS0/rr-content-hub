-- NX-1028: planificación social — esquema local listo para Supabase.
--
-- CANDADO de la misión: este archivo NO se aplica en remoto. Se escribe aquí
-- para que el día que el conector Supabase quede autorizado solo falte
-- `supabase db push` y la validación remota. Cero escrituras remotas.
--
-- Contrato tomado de docs/plan-publicacion/ARQUITECTURA.md («Contrato futuro
-- con Supabase»), ampliado con lo que la misión NX-1028 exige por código:
-- versionado para control de concurrencia, historial recuperable y archivado
-- sin borrado irreversible.

create table if not exists public.rr_hub_social_posts (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.rr_hub_projects (id) on delete cascade,
  collection      text not null default 'organico' check (collection in ('organico', 'pauta')),
  slot            integer not null check (slot >= 1),
  media_type      text not null default 'foto' check (media_type in ('foto', 'reel', 'carrusel')),
  title           text not null default '',
  caption         text not null default '',
  hashtags        jsonb not null default '[]'::jsonb,
  cta             text,
  media_url       text not null default '',
  cover_url       text not null default '',
  color           text not null default '#be076d',
  status          text not null default 'pendiente' check (status in ('pendiente', 'aprobado', 'cambios')),
  scheduled_for   text,
  client_notes    text not null default '',
  -- Versionado optimista: cada escritura lo incrementa. El cliente manda el
  -- que leyó; si no coincide, la escritura se rechaza con 409 en vez de pisar.
  version         integer not null default 1,
  -- Archivado recuperable: no existe borrado irreversible desde la interfaz.
  archived_at     timestamptz,
  archived_by     text,
  created_by      text not null default 'sistema',
  updated_by      text not null default 'sistema',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (project_id, collection, slot)
);

comment on table public.rr_hub_social_posts is
  'Publicaciones del plan de publicación (orgánico y pauta). Corte vertical NX-1028.';
comment on column public.rr_hub_social_posts.version is
  'Control de concurrencia optimista. Toda escritura lo incrementa; un valor viejo devuelve 409.';
comment on column public.rr_hub_social_posts.archived_at is
  'NULL = viva. Con valor = archivada, recuperable desde la interfaz. Nunca es un borrado físico.';

-- Historial: cada escritura deja copia del estado anterior. Es lo que hace
-- posible «recuperar» sin depender de la papelera del navegador.
create table if not exists public.rr_hub_social_post_history (
  id          bigint generated always as identity primary key,
  post_id     uuid not null references public.rr_hub_social_posts (id) on delete cascade,
  project_id  uuid not null references public.rr_hub_projects (id) on delete cascade,
  snapshot    jsonb not null,
  version     integer not null,
  changed_by  text not null default 'sistema',
  created_at  timestamptz not null default now()
);

create index if not exists rr_hub_social_posts_vivos_idx
  on public.rr_hub_social_posts (project_id, collection, slot)
  where archived_at is null;

create index if not exists rr_hub_social_history_post_idx
  on public.rr_hub_social_post_history (post_id, version desc);

-- Mismo patrón que el resto del hub: el service role escribe saltándose RLS y
-- el navegador no toca estas tablas de ninguna manera.
alter table public.rr_hub_social_posts enable row level security;
alter table public.rr_hub_social_post_history enable row level security;
