-- Rate limiting persistente para el RR Content Hub.
-- Solo el backend con service_role puede leer o modificar esta tabla.

create table if not exists public.rr_hub_rate_limit (
  ip text not null,
  path text not null,
  count integer not null default 0 check (count >= 0),
  window_start timestamptz not null default now(),
  primary key (ip, path)
);

alter table public.rr_hub_rate_limit enable row level security;
alter table public.rr_hub_rate_limit force row level security;
revoke all on table public.rr_hub_rate_limit from anon, authenticated;
grant select, insert, update, delete on table public.rr_hub_rate_limit to service_role;

-- Incremento atomico: evita perder intentos cuando llegan solicitudes paralelas.
create or replace function public.rr_hub_rate_limit_failure(
  p_ip text,
  p_path text,
  p_window_seconds integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.rr_hub_rate_limit (ip, path, count, window_start)
  values (p_ip, p_path, 1, now())
  on conflict (ip, path) do update
  set count = case
        when rr_hub_rate_limit.window_start + make_interval(secs => p_window_seconds) <= now() then 1
        else rr_hub_rate_limit.count + 1
      end,
      window_start = case
        when rr_hub_rate_limit.window_start + make_interval(secs => p_window_seconds) <= now() then now()
        else rr_hub_rate_limit.window_start
      end;
end;
$$;

revoke all on function public.rr_hub_rate_limit_failure(text, text, integer) from public, anon, authenticated;
grant execute on function public.rr_hub_rate_limit_failure(text, text, integer) to service_role;

comment on table public.rr_hub_rate_limit is
  'Contador persistente de solicitudes fallidas por IP y ruta. Acceso exclusivo del backend.';
