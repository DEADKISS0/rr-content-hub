-- RR Content Hub — v3 de base de datos
-- Fecha: 2026-09-26 · Autor: RR Aliados (asistido)
-- Naturaleza: ADITIVA. No borra tablas, no renombra columnas, no toca datos.
-- Nada de esto se aplicó todavía: ver docs/BACKEND_V3.md (hace falta acceso al
-- proyecto ntgtvtzbjwotuwkiflar; el token MCP del hub no lo alcanza).
--
-- Qué arregla, en orden de importancia:
--   1. `updated_at` nunca se actualizaba → "días en esta etapa" mentía.
--   2. El feed "en vivo" del front se inventaba con Math.random() → ahora hay
--      una vista de actividad real sobre rr_hub_events + rr_hub_comments.
--   3. Latencia de prod (2.6 s en la primera carga del 2026-09-26) → índices
--      por proyecto+estado, índice GIN de búsqueda en español.
--   4. El tablero hacía N+1 consultas → vista rr_hub_board en una sola pasada.

begin;

-- ── 1. updated_at real ───────────────────────────────────────────────────────
create or replace function public.rr_hub_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  if new.updated_at is not distinct from old.updated_at then
    new.updated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists rr_hub_ideas_touch on public.rr_hub_ideas;
create trigger rr_hub_ideas_touch
  before update on public.rr_hub_ideas
  for each row execute function public.rr_hub_touch_updated_at();

-- ── 2. Columnas nuevas (todas opcionales, con default) ───────────────────────
alter table public.rr_hub_ideas
  add column if not exists due_at timestamptz,
  add column if not exists published_url text,
  add column if not exists metrics jsonb not null default '{}'::jsonb,
  add column if not exists cover_asset_id uuid;

-- ── 3. Búsqueda en español (columna generada + índice GIN) ───────────────────
alter table public.rr_hub_ideas
  add column if not exists search_tsv tsvector generated always as (
    setweight(to_tsvector('spanish', coalesce(code, '')), 'A') ||
    setweight(to_tsvector('spanish', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('spanish', coalesce(objective, '')), 'B') ||
    setweight(to_tsvector('spanish', coalesce(category, '')), 'C') ||
    setweight(to_tsvector('spanish', coalesce(description, '')), 'D')
  ) stored;

-- ── 4. Índices de operación ──────────────────────────────────────────────────
create index if not exists rr_hub_ideas_project_status_idx on public.rr_hub_ideas (project_id, status);
create index if not exists rr_hub_ideas_project_updated_idx on public.rr_hub_ideas (project_id, updated_at desc);
create index if not exists rr_hub_ideas_search_idx on public.rr_hub_ideas using gin (search_tsv);
create index if not exists rr_hub_events_idea_created_idx on public.rr_hub_events (idea_id, created_at desc);
create index if not exists rr_hub_comments_idea_created_idx on public.rr_hub_comments (idea_id, created_at desc);
create index if not exists rr_hub_assets_idea_created_idx on public.rr_hub_assets (idea_id, created_at desc);

-- ── 5. Vista del tablero: una pieza, todos sus contadores ────────────────────
-- security_invoker: la vista NO salta RLS, hereda los permisos de quien consulta.
create or replace view public.rr_hub_board
with (security_invoker = true) as
select
  i.id,
  i.project_id,
  i.code,
  i.title,
  i.description,
  i.objective,
  i.content_type,
  i.category,
  i.status,
  i.priority,
  i.created_at,
  i.updated_at,
  i.due_at,
  i.published_url,
  i.metrics,
  i.reference_urls,
  i.camera_brief,
  i.talent_brief,
  i.edit_brief,
  i.script_content,
  i.script_drive_url,
  i.search_tsv,
  greatest(0, floor(extract(epoch from (now() - i.updated_at)) / 86400)::int) as days_in_stage,
  ((case when coalesce(i.camera_brief, '') <> '' then 1 else 0 end) +
   (case when coalesce(i.talent_brief, '') <> '' then 1 else 0 end) +
   (case when coalesce(i.edit_brief, '') <> '' then 1 else 0 end) +
   (case when coalesce(i.script_content, '') <> '' then 1 else 0 end)) as brief_done,
  (select count(*) from public.rr_hub_assets a where a.idea_id = i.id) as asset_count,
  (select count(*) from public.rr_hub_comments c where c.idea_id = i.id and c.resolved_at is null) as open_comments,
  (select count(*) from public.rr_hub_events e where e.idea_id = i.id) as event_count,
  (select max(e.created_at) from public.rr_hub_events e where e.idea_id = i.id) as last_event_at
from public.rr_hub_ideas i;

grant select on public.rr_hub_board to anon, authenticated;

-- ── 6. Feed de actividad real (reemplaza el teatro del front) ────────────────
-- Sin join a rr_hub_profiles a propósito: esa tabla es privada por RLS y un
-- join la dejaría filtrar nombres. Los comentarios ya traen role_label.
create or replace view public.rr_hub_feed
with (security_invoker = true) as
select
  e.id,
  i.project_id,
  e.idea_id,
  'status'::text as kind,
  e.from_status,
  e.to_status,
  coalesce(nullif(e.comment, ''), '') as body,
  coalesce(nullif(btrim(e.actor_label), ''), 'EQUIPO RR')::text as actor_label,
  e.created_at
from public.rr_hub_events e
join public.rr_hub_ideas i on i.id = e.idea_id
union all
select
  c.id,
  i.project_id,
  c.idea_id,
  'comment'::text as kind,
  null::text as from_status,
  null::text as to_status,
  c.body,
  coalesce(nullif(btrim(c.author_label), ''), nullif(btrim(c.role_label), ''), 'RR ALIADOS')::text as actor_label,
  c.created_at
from public.rr_hub_comments c
join public.rr_hub_ideas i on i.id = c.idea_id;

grant select on public.rr_hub_feed to anon, authenticated;

-- ── 7. Búsqueda del servidor ─────────────────────────────────────────────────
create or replace function public.rr_hub_search(
  p_project uuid,
  p_query text,
  p_limit integer default 50
)
returns setof public.rr_hub_board
language sql
stable
security invoker
as $$
  select b.*
  from public.rr_hub_board b
  where b.project_id = p_project
    and (
      coalesce(btrim(p_query), '') = ''
      or b.search_tsv @@ websearch_to_tsquery('spanish', p_query)
    )
  order by b.updated_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;

grant execute on function public.rr_hub_search(uuid, text, integer) to anon, authenticated;

-- ── 8. Realtime de comentarios y eventos (idempotente) ───────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rr_hub_comments'
  ) then
    execute 'alter publication supabase_realtime add table public.rr_hub_comments';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rr_hub_events'
  ) then
    execute 'alter publication supabase_realtime add table public.rr_hub_events';
  end if;
end $$;

commit;
