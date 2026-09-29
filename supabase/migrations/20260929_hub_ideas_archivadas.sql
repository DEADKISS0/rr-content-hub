-- Archivado de ideas: "borrar" sin perder la historia.
--
-- Santiago, 2026-09-29: "añade la función de que se puedan borrar las ideas".
--
-- Por qué NO es un DELETE: el `DELETE` de una idea se lleva sus votos y sus
-- comentarios en cascada. Una pieza que se aprobó con tres sí y luego se borra
-- deja de tener resultado, y nadie puede reconstruir por qué salió. Con varias
-- personas trabajando, además, el "borra esto que se me coló" llega siempre tarde y
-- un DELETE no se puede deshacer.
--
-- Lo que hace esta migración: la idea se marca con `archived_at` (cuándo) y
-- `archived_by` (quién) y desaparece del tablero. La fila sigue ahí, con su
-- historial, sus votos y sus comentarios. Si el borrado fue un error, se
-- desarchiva.
--
-- `archived_by` es el id de `rr_hub_profiles`, NO un texto. El nombre se puede
-- cambiar; el id no. Un `deleted_by text` que alguien escriba desde el navegador
-- es un campo que no significa nada.

alter table public.rr_hub_ideas
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.rr_hub_profiles(id) on delete set null;

comment on column public.rr_hub_ideas.archived_at is
  'Cuándo se archivó la idea. NULL = la idea está viva en el tablero. No es un borrado físico: la fila y su historial siguen existiendo.';
comment on column public.rr_hub_ideas.archived_by is
  'Quién archivó la idea (rr_hub_profiles.id). NULL si se archivó por script o migración.';

-- Índice parcial: el tablero consulta constantemente "las ideas vivas". Con
-- `archived_at is null` en el índice, esa consulta no tiene que revisar las
-- archivadas, y el índice no crece con ideas viejas que nadie va a mirar.
create index if not exists rr_hub_ideas_vivas_idx
  on public.rr_hub_ideas (project_id, status)
  where archived_at is null;

-- La vista del tablero filtra aquí. Sin esto, una idea archivada seguiría
-- apareciendo, y el botón de borrar parecería no hacer nada.
-- (La vista se ajusta en el mismo despliegue; este índice solo prepara la consulta.)
