-- Portada de la idea: el archivo de referencia (brief) que se muestra en la tarjeta.
-- 2026-09-28 · proyecto Wundeer
--
-- Por qué esto existe: `rr_hub_ideas` no tenía ninguna columna de imagen, así que
-- la tarjeta no tenía de dónde sacar una portada real y pintaba siempre el arte
-- de marca procedural. Pero la imagen YA EXISTE y ya está cableada: vive en
-- `rr_hub_assets` con `asset_stage = 'reference_brief'`, y la API la sube y la
-- registra. Lo que faltaba era el puntero desde la idea hasta esa fila.
--
-- Se modela como una columna `cover_asset_id` y NO como un join directo en el
-- cliente, por dos razones:
--
--   1. La tarjeta pinta UN archivo concreto, no "el último que se subió". Si el
--      cliente hiciera el join por `created_at`, dos tarjetas distintas podrían
--      romperse en cuanto una idea recibiera un brief nuevo, y nadie podría
--      volver a la portada anterior. Con la columna, la portada elegida es un
--      dato explícito y la app lo puede cambiar a mano.
--   2. `rr_hub_assets` está protegida por RLS y la idea no. Guardar el id en la
--      idea no abre ningún camino nuevo a los archivos: la URL la sigue
--      firmando el servidor, igual que hoy.
--
-- `on delete set null`: si se borra el archivo de portada, la idea sobrevive y
-- vuelve a su arte de marca. Perder la portada no puede borrar una idea.

-- ---------------------------------------------------------------------------
-- 1. La columna
-- ---------------------------------------------------------------------------
-- `add column if not exists` para que la migración sea reejecutable: aplicarla
-- dos veces no debe fallar ni duplicar nada.

alter table public.rr_hub_ideas
  add column if not exists cover_asset_id uuid
  references public.rr_hub_assets(id) on delete set null;

comment on column public.rr_hub_ideas.cover_asset_id is
  'Portada de la idea: apunta al asset reference_brief elegido. Null = se usa el arte de marca.';

-- ---------------------------------------------------------------------------
-- 2. Índice
-- ---------------------------------------------------------------------------
-- La app lista ideas por proyecto y pinta la portada de cada una. Sin este
-- índice, cada fila de la lista hace un escaneo secuencial de rr_hub_assets para
-- resolver su portada.

create index if not exists rr_hub_ideas_cover_asset_idx
  on public.rr_hub_ideas (cover_asset_id);

-- El helper (el punto 3) busca por `idea_id + asset_stage` ordenado por fecha.
-- Este es el índice que sostiene esa búsqueda.

create index if not exists rr_hub_assets_idea_stage_created_idx
  on public.rr_hub_assets (idea_id, asset_stage, created_at desc);

-- ---------------------------------------------------------------------------
-- 3. El helper: la portada de una idea
-- ---------------------------------------------------------------------------
-- Devuelve la fila del asset `reference_brief` más reciente de la idea, o `null`
-- si no tiene ninguno.
--
-- Dos reglas que la función hace cumplir, para que el llamador no tenga que
-- repetirlas:
--
--   - Si la idea YA tiene `cover_asset_id` guardado, ese manda. La elección
--     explícita le gana al "último subido", que es solo el valor por defecto.
--   - Si no hay elección guardada, cae al `reference_brief` más reciente. Es el
--     mismo criterio que usaba la UI a mano y deja de ser un comportamiento
--     invisible para pasar a ser una regla escrita.
--
-- `security definer` + `set search_path` para que no dependa de las políticas
-- del cliente que la llame: es la misma defensa que usa el resto del hub para
-- no confiar en el `search_path` de quien llama.

create or replace function public.rr_hub_idea_cover(p_idea_id uuid)
returns table (
  asset_id   uuid,
  file_name  text,
  mime_type  text,
  external_url text,
  storage_path text
)
language sql
stable
security definer
set search_path = public
as $$
  -- `security definer` salta las políticas de RLS de las tablas que lee, así que
  -- esta función NO puede devolver la fila sin volver a comprobar la
  -- autorización a mano. Si no, cualquier `anon` que llamara al RPC del hub
  -- público (ver docs/AUDIT_2026-09-26.md) se llevaría el `storage_path` de
  -- los briefs de ideas de otros proyectos. Estas dos condiciones son las
  -- MISMAS que usan las políticas `rr_hub_assets_read` y `rr_hub_ideas_read`
  -- de 20260926_close_anon_write.sql, copiadas a mano porque una función
  -- definer no las evalúa.
  select a.id, a.file_name, a.mime_type, a.external_url, a.storage_path
  from public.rr_hub_assets a
  where (
      public.rr_hub_is_admin()
      or exists (
        select 1
        from public.rr_hub_ideas i
        join public.rr_hub_access acc on acc.project_id = i.project_id
        where i.id = a.idea_id and acc.user_id = auth.uid()
      )
    )
    and a.id in (
      -- Rama 1: la portada elegida a mano. Como máximo una fila, porque
      -- `cover_asset_id` es una columna y la idea tiene una sola fila.
      with elegida as (
        select i.cover_asset_id as id
        from public.rr_hub_ideas i
        where i.id = p_idea_id and i.cover_asset_id is not null
      ),
      -- Rama 2: sin portada elegida, el reference_brief más reciente. El
      -- `limit 1` va DENTRO del CTE, no sobre el union: aplicado al final
      -- cortaría la fila de la rama 1 sin avisar.
      reciente as (
        select b.id
        from public.rr_hub_assets b
        where b.idea_id = p_idea_id
          and b.asset_stage = 'reference_brief'
        order by b.created_at desc, b.id desc
        limit 1
      )
      select id from elegida
      union all
      select id from reciente where not exists (select 1 from elegida)
    );
$$;

comment on function public.rr_hub_idea_cover(uuid) is
  'Portada de una idea: el cover_asset_id elegido, o el reference_brief mas reciente. Null si no hay.';

-- El `grant` es SOLO para `authenticated`, nunca `anon`. La función lleva la
-- comprobación de autorización dentro a propósito (es `security definer` y no
-- hereda las políticas), pero negar el permiso a `anon` es la segunda
-- barrera: aunque alguien aflojara esa comprobación, el RPC seguiría fuera del
-- alcance del hub público, que según `docs/AUDIT_2026-09-26.md` sí expone
-- lecturas a `anon`.
grant execute on function public.rr_hub_idea_cover(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Aviso sobre la URL
-- ---------------------------------------------------------------------------
-- El helper devuelve `storage_path`, NO una URL lista para pintar. El bucket es
-- privado: la URL de una hora la firma el servidor, igual que hoy con
-- `getAuditAssets`. Devolver una URL firmada desde una función de tabla dejaría
-- una URL con caducidad embebida en el medio, y el llamador no podría saber
-- cuándo caduca. Quien llame a esta función sigue necesitando el paso de
-- firma. Esto es intencional: es el mismo contrato que el hub ya usa.
