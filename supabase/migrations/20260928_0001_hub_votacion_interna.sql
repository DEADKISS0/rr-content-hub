-- Votación interna de ideas y estado de revisión interna.
-- 2026-09-28 · para el generador 2x/día de ideas de Wundeer.
--
-- Por qué esto existe: el flujo saltaba de `draft` directo a "esperando al
-- cliente". La idea se creaba y de una vez iba para revisión del cliente, sin que
-- el equipo la mirara. Este parche mete el paso que faltaba: la idea se genera,
-- el equipo la revisa y vota, y solo entonces sale.
--
-- VALIDADO con pglast antes de aplicar (ver `npm run verify:sql`).

-- ---------------------------------------------------------------------------
-- 1. Los dos estados nuevos van en el CHECK, no fuera.
-- ---------------------------------------------------------------------------
-- `internal_review` es la puerta: la idea existe y el equipo la está mirando.
-- `voting` es la misma puerta con la votación abierta.
--
-- Se mete `voting` como estado y no como bandera porque el flujo, los colores y
-- las colas ya leen de `status`: un estado nuevo aparece solo en el tablero si
-- la tabla de fases lo incluye. Una bandera invisible habría exigido tocar
-- media app.

alter table rr_hub_ideas
  drop constraint if exists rr_hub_ideas_status_check;

alter table rr_hub_ideas
  add constraint rr_hub_ideas_status_check check (
    status = any (array[
      -- 01 IDEA
      'draft',
      'internal_review',   -- NUEVO: el equipo la está mirando
      'voting',            -- NUEVO: abierta a votación interna
      'pending_approval',
      'needs_changes',
      'approved',
      'script_in_progress',
      'pending_script_review',
      'script_approved',
      'in_production',
      'raw_uploaded',
      'editing',
      'ready_to_publish',
      'published',
      'closed'
    ]::text[])
  );

-- ---------------------------------------------------------------------------
-- 2. Votos.
-- ---------------------------------------------------------------------------
-- Sin login: la identidad la da un token personal por votante, no la sesión.
-- Un voto anónimo no cuenta para nada, así que cada votante tiene su fila y no
-- se puede votar dos veces por la misma persona.
--
-- `decision` es 'yes' o 'no'. La regla de aprobación es mayoría simple: más
-- 'yes' que 'no'. Se calcula en la API, no con un CHECK ni una vista, porque
-- depende de cuántas personas hay y eso cambia con el roster.

create table if not exists rr_hub_votes (
  id          uuid primary key default gen_random_uuid(),
  idea_id     uuid not null references rr_hub_ideas(id) on delete cascade,
  voter_token text not null,
  decision    text not null check (decision in ('yes', 'no')),
  note        text,
  created_at  timestamptz not null default now(),

  -- Una persona, un voto, por idea. Sin esto, "cargar" dos veces la página
  -- duplicaba el voto y la mayoría simple se distortionaba.
  unique (idea_id, voter_token)
);

-- El conteo de la ficha va por idea; este índice es el que lo sostiene.
create index if not exists rr_hub_votes_idea_idx on rr_hub_votes (idea_id);

-- ---------------------------------------------------------------------------
-- 3. Quién puede votar, sin sesión.
-- ---------------------------------------------------------------------------
-- El token es un valor opaco, no un email ni un nombre: el votante se identifica
-- en la interfaz la primera vez y ya no tiene que volver a hacerlo. Guardar el
-- email aquí sería dato personal de terceros en una tabla pública.

comment on table rr_hub_votes is
  'Votos internos de ideas. Identidad por token opaco, no por sesion: el hub esta abierto.';

comment on column rr_hub_votes.voter_token is
  'Token opaco generado en el navegador. NO es un email ni un user_id: es un identificador de votante.';
