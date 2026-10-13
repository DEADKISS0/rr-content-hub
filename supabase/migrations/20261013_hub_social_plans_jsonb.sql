-- Plan de publicación social: agregado JSONB con concurrencia optimista e historial
create table if not exists public.rr_hub_social_plans (
  project_id uuid primary key references public.rr_hub_projects(id) on delete restrict,
  version integer not null check (version > 0),
  posts jsonb not null check (jsonb_typeof(posts) = 'array'),
  pautas jsonb not null check (jsonb_typeof(pautas) = 'array'),
  updated_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rr_hub_social_plan_history (
  project_id uuid not null references public.rr_hub_projects(id) on delete restrict,
  version integer not null check (version >= 0),
  posts jsonb not null,
  pautas jsonb not null,
  changed_by text not null,
  operation text not null check (operation in ('guardar', 'archivar', 'restaurar')),
  created_at timestamptz not null default now(),
  primary key (project_id, version)
);

alter table public.rr_hub_social_plans enable row level security;
alter table public.rr_hub_social_plans force row level security;
alter table public.rr_hub_social_plan_history enable row level security;
alter table public.rr_hub_social_plan_history force row level security;

revoke all on public.rr_hub_social_plans from public, anon, authenticated;
revoke all on public.rr_hub_social_plan_history from public, anon, authenticated;
grant select on public.rr_hub_social_plans to service_role;
grant select on public.rr_hub_social_plan_history to service_role;

create or replace function public.rr_hub_social_plan_commit(
  p_project_id uuid,
  p_expected_version integer,
  p_posts jsonb,
  p_pautas jsonb,
  p_changed_by text,
  p_operation text default 'guardar'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actual public.rr_hub_social_plans%rowtype;
  v_nueva_version integer;
  v_res jsonb;
begin
  if jsonb_typeof(p_posts) != 'array' or jsonb_typeof(p_pautas) != 'array' then
    return jsonb_build_object('ok', false, 'motivo', 'invalido');
  end if;

  select * into v_actual
  from public.rr_hub_social_plans
  where project_id = p_project_id
  for update;

  if not found then
    if p_expected_version != 0 then
      return jsonb_build_object('ok', false, 'motivo', 'conflicto', 'versionActual', 0);
    end if;

    insert into public.rr_hub_social_plan_history (project_id, version, posts, pautas, changed_by, operation)
    values (p_project_id, 0, '[]'::jsonb, '[]'::jsonb, p_changed_by, p_operation);

    insert into public.rr_hub_social_plans (project_id, version, posts, pautas, updated_by, updated_at)
    values (p_project_id, 1, p_posts, p_pautas, p_changed_by, now())
    returning jsonb_build_object(
      'ok', true,
      'plan', jsonb_build_object(
        'projectSlug', p_project_id,
        'version', version,
        'posts', posts,
        'pautas', pautas,
        'updatedAt', updated_at,
        'updatedBy', updated_by
      )
    ) into v_res;

    return v_res;
  end if;

  if v_actual.version != p_expected_version then
    return jsonb_build_object('ok', false, 'motivo', 'conflicto', 'versionActual', v_actual.version);
  end if;

  v_nueva_version := v_actual.version + 1;

  insert into public.rr_hub_social_plan_history (project_id, version, posts, pautas, changed_by, operation)
  values (p_project_id, v_actual.version, v_actual.posts, v_actual.pautas, p_changed_by, p_operation);

  update public.rr_hub_social_plans
  set version = v_nueva_version,
      posts = p_posts,
      pautas = p_pautas,
      updated_by = p_changed_by,
      updated_at = now()
  where project_id = p_project_id
  returning jsonb_build_object(
    'ok', true,
    'plan', jsonb_build_object(
      'projectSlug', p_project_id,
      'version', version,
      'posts', posts,
      'pautas', pautas,
      'updatedAt', updated_at,
      'updatedBy', updated_by
    )
  ) into v_res;

  return v_res;
end;
$$;

revoke all on function public.rr_hub_social_plan_commit(uuid, integer, jsonb, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.rr_hub_social_plan_commit(uuid, integer, jsonb, jsonb, text, text) to service_role;
