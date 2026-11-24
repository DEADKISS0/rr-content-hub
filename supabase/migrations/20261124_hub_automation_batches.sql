-- Idempotencia para la carga semanal de diez ideas.
--
-- La rutina puede reintentar una petición si pierde la respuesta. Sin una
-- clave persistida, ese reintento crea otras diez ideas y mezcla la revisión
-- del equipo. La combinación proyecto + lote + posición permite devolver el
-- mismo lote sin duplicarlo, pero deja libres las ideas creadas manualmente.

alter table public.rr_hub_ideas
  add column if not exists automation_batch_key text,
  add column if not exists automation_batch_index smallint;

alter table public.rr_hub_ideas
  drop constraint if exists rr_hub_ideas_automation_batch_index_check;

alter table public.rr_hub_ideas
  add constraint rr_hub_ideas_automation_batch_index_check
  check (automation_batch_index is null or automation_batch_index between 0 and 9);

create unique index if not exists rr_hub_ideas_automation_batch_unique
  on public.rr_hub_ideas (project_id, automation_batch_key, automation_batch_index)
  where automation_batch_key is not null;
