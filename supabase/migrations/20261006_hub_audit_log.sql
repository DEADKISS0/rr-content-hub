-- Auditoría a nivel de base de datos: cada INSERT/UPDATE/DELETE sobre ideas,
-- votos, accesos y assets deja fila con el ANTES y el DESPUÉS, sin importar
-- quién escribió (el service_role se salta RLS, pero NO se salta triggers).
-- Hace recuperable cualquier cambio y cierra el hueco "sin historial de auditoría".

create table if not exists public.rr_hub_audit_log (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  tabla      text        not null,
  op         text        not null check (op in ('INSERT', 'UPDATE', 'DELETE')),
  row_id     text,
  antes      jsonb,
  despues    jsonb,
  db_role    text        not null default current_user
);

create index if not exists rr_hub_audit_log_tabla_row_idx
  on public.rr_hub_audit_log (tabla, row_id, at desc);

alter table public.rr_hub_audit_log enable row level security;
revoke all on public.rr_hub_audit_log from anon, authenticated;
grant select, insert on public.rr_hub_audit_log to service_role;

create or replace function public.rr_hub_audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  fila_antes   jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  fila_despues jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
begin
  -- El token del votante es un secreto de navegador: no se copia al log.
  if tg_table_name = 'rr_hub_votes' then
    fila_antes   := fila_antes   - 'voter_token';
    fila_despues := fila_despues - 'voter_token';
  end if;

  insert into public.rr_hub_audit_log (tabla, op, row_id, antes, despues)
  values (
    tg_table_name,
    tg_op,
    coalesce(fila_despues ->> 'id', fila_antes ->> 'id'),
    fila_antes,
    fila_despues
  );
  return coalesce(new, old);
end;
$$;

revoke all on function public.rr_hub_audit_trigger() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['rr_hub_ideas', 'rr_hub_votes', 'rr_hub_access', 'rr_hub_assets']
  loop
    execute format('drop trigger if exists rr_hub_audit_%1$s on public.%1$I', t);
    execute format(
      'create trigger rr_hub_audit_%1$s after insert or update or delete on public.%1$I
         for each row execute function public.rr_hub_audit_trigger()', t);
  end loop;
end $$;
