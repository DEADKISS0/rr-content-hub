# BACKEND V3 — qué cambia en la base y cómo aplicarlo

> Estado: **escrito y validado, NO aplicado**
> Fecha: 2026-09-26
> Archivo: `supabase/migrations/20260926_hub_v3_board_feed_search.sql`
> Validación hecha: sintaxis PostgreSQL verificada con `pglast` (libpg_query) — 20 sentencias, 0 errores.

## Por qué existe

Tres problemas reales medidos el 2026-09-26, no supuestos:

1. **`updated_at` nunca se actualizaba.** No había trigger. `rr_hub_ideas.updated_at`
   se quedaba en la fecha de creación, así que cualquier "hace X días" del front
   era en realidad "hace X días que se creó la pieza", no "X días en esta etapa".
2. **Actividad en vivo falsa.** `collaboration-enhanced.tsx` mostraba
   "N persona(s) editando ahora" generado con `Math.random()` y nombres tipo
   `Usuario_47`. Teatro. Nadie estaba editando nada.
3. **Latencia de prod.** Primera respuesta de `https://rr-content-hub.vercel.app`
   en 2.6 s. Sin índices por `project_id`/`status` y con N+1 consultas desde el
   tablero, cada carga paga un scan completo.

## Qué hace la migración

| # | Objeto | Para qué |
|---|--------|----------|
| 1 | `rr_hub_touch_updated_at()` + trigger `rr_hub_ideas_touch` | que `updated_at` sea verdad |
| 2 | columnas `due_at`, `published_url`, `metrics`, `cover_asset_id` | fecha compromiso, link publicado, métricas, portada elegida |
| 3 | `rr_hub_ideas.search_tsv` (generada) + GIN | búsqueda en español con ranking por campo (código > título > objetivo > descripción) |
| 4 | 6 índices | tablero y colas por proyecto+estado, eventos/comentarios/assets por pieza |
| 5 | vista `rr_hub_board` (security_invoker) | una pieza con `days_in_stage`, `brief_done`, `asset_count`, `open_comments`, `event_count`, `last_event_at` en **una** consulta |
| 6 | vista `rr_hub_feed` (security_invoker) | feed unificado evento+comentario; reemplaza el teatro del front |
| 7 | función `rr_hub_search(project, query, limit)` | búsqueda server-side que respeta RLS |
| 8 | realtime de `rr_hub_comments` y `rr_hub_events` | el hilo y el feed se actualizan solos |

Todo es **aditivo**: no borra tablas, no renombra columnas, no toca datos. Ambas
vistas son `security_invoker = true`, o sea que **no saltan RLS**: heredan los
permisos de quien consulta, igual que las tablas base. No hay fuga nueva.

`rr_hub_feed` **no** hace join con `rr_hub_profiles` a propósito: esa tabla solo
la ve su dueño (o admin) por RLS, y un join dejaría nombres personales al aire.
Se usan `rr_hub_events.actor_label` y `rr_hub_comments.author_label`, que ya
existen desde `20260911_wundeer_collaborative_mode.sql`.

## Cómo aplicarlo (elige una)

### Opción A — SQL Editor del panel (la más simple, 30 segundos)
1. Abre el proyecto `ntgtvtzbjwotuwkiflar` en supabase.com.
2. SQL Editor → pega el contenido completo del archivo → Run.
3. Corre las consultas de verificación (abajo).

### Opción B — CLI, sin copiar nada a mano
```bash
supabase login                     # abre el navegador, tú apruebas
supabase link --project-ref ntgtvtzbjwotuwkiflar   # pide la contraseña de la base
supabase db push                   # aplica toda migración pendiente
```

### Opción C — MCP de Supabase
Hoy **no funciona**: el token del MCP solo alcanza `sazon` y `rr-aliados`.
`ntgtvtzbjwotuwkiflar` responde `You do not have permission to perform this
action` (verificado dos veces el 2026-09-26, antes y después de recargar MCP).
Si en algún momento el token tiene acceso al proyecto, la migración se aplica
con `mcp__supabase__apply_migration` sin cambiar una línea.

## Verificación después de aplicar

```sql
-- 1. El trigger existe
select tgname from pg_trigger where tgname = 'rr_hub_ideas_touch';

-- 2. La vista responde y trae los contadores
select code, status, days_in_stage, brief_done, asset_count, open_comments, event_count
from public.rr_hub_board
order by updated_at desc
limit 5;

-- 3. La búsqueda en español funciona (esperado: la macro de textura)
select code, title from public.rr_hub_search('<project_id>', 'textura', 10);

-- 4. Índices creados
select indexname from pg_indexes
where tablename in ('rr_hub_ideas','rr_hub_events','rr_hub_comments','rr_hub_assets')
  and indexname like 'rr_hub%'
order by indexname;

-- 5. updated_at se mueve de verdad: cambia algo y mira la fecha
update public.rr_hub_ideas set priority = priority where code = 'O15';
select code, updated_at from public.rr_hub_ideas where code = 'O15';
```

## Rollback

Nada de esto toca datos, así que revertir es soltar los objetos nuevos:

```sql
drop view if exists public.rr_hub_feed;
drop view if exists public.rr_hub_board;
drop function if exists public.rr_hub_search(uuid, text, integer);
drop trigger if exists rr_hub_ideas_touch on public.rr_hub_ideas;
drop function if exists public.rr_hub_touch_updated_at();
drop index if exists rr_hub_ideas_search_idx, rr_hub_ideas_project_status_idx,
  rr_hub_ideas_project_updated_idx, rr_hub_events_idea_created_idx,
  rr_hub_comments_idea_created_idx, rr_hub_assets_idea_created_idx;
alter table public.rr_hub_ideas
  drop column if exists search_tsv, drop column if exists due_at,
  drop column if exists published_url, drop column if exists metrics,
  drop column if exists cover_asset_id;
```

## Qué ya usa el front sin necesidad de la migración

- **`updated_at`** se selecciona en `getIdeas()` (`src/lib/data.ts`) y alimenta
  "hace N días" en cada tarjeta. Sin el trigger la fecha es de creación, con el
  trigger es de verdad — el front no cambia ni una línea.
- **Completitud del brief** (`INFO 2/5`) se calcula desde las columnas que ya
  existen (`camera_brief`, `talent_brief`, `edit_brief`, `script_content`,
  `reference_urls`).
- **"Último movimiento"** en la ficha de la pieza lee `rr_hub_events` con
  `loadTimeline()`, que ya existía, y ahora también escucha el realtime de esa
  tabla. Si no hay movimiento, no muestra nada: cero invención.

## Lo que falta para cerrar el rediseño del back

1. **Aplicar la migración** (opción A o B, arriba).
2. Decidir si la escritura anónima de Wundeer se mantiene cerrada
   (`20260925_anon_write_lockdown.sql` sin aplicar) o se refuerza.
3. Portada real por pieza: `cover_asset_id` apunta a `rr_hub_assets`, pero el
   flujo de "elegir portada" todavía no tiene UI. Mientras tanto el front usa la
   portada procedural (`src/components/ui/cover.tsx`), que no depende de subidas.
