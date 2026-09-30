-- Origen de la idea: la subio una persona o la genero el asistente.
--
-- Santiago, 2026-09-29: "quiero que hagas una categoria para los proyectos donde
-- meteras las ideas que subas tu, para diferenciar las que se pongan manual y las
-- que tu montes".
--
-- Por que una columna nueva y no reutilizar `category`:
--   `category` es la tematica de la pieza (textil, corte, pauta, mesa...). Meter
--   ahi "montada por Hermes" mezcla el QUE con el QUIEN, y las metricas agrupan
--   por categoria: el informe de metricas dejaria de medir formato para medir
--   autor. Ademas el cliente ya escribe ahi sus propias etiquetas.
--
-- Por que no se deduce de `created_by`: las ideas que creo el generador
--ematico llevan la identidad administrativa de la sesion (service role), que no
-- es "Hermes". El origen tiene que ser un hecho declarado en el momento de
-- escribir, no una inferencia que puede mentir.

begin;

-- Valores permitidos. 'manual' = la escribio una persona; 'asistente' = la
-- genero o monto Hermes. default 'manual' para que cualquier alta que no diga
-- nada siga siendo manual: por defecto se presume la intervencion humana.
alter table rr_hub_ideas
  add column if not exists origen text not null default 'manual';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'rr_hub_ideas_origen_check'
  ) then
    alter table rr_hub_ideas
      add constraint rr_hub_ideas_origen_check
      check (origen in ('manual', 'asistente'));
  end if;
end $$;

comment on column rr_hub_ideas.origen is
  'Quien aporto la idea: manual (una persona) o asistente (Hermes). No se infiere de created_by.';

commit;
