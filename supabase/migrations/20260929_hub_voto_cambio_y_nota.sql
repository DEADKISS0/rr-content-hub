-- ---------------------------------------------------------------------------
-- Votación interna: la tercera opción y las notas.
--
-- Santiago, 2026-09-29: "aún no pueda votar sí o no, o un apartado para poner
-- [que] podría ser pero cambiándole tal cosa".
--
-- Antes el voto era de dos: a favor o en contra, y quien no estuviera de acuerdo
-- con la idea tal como estaba no tenía dónde decirlo dentro de la votación. Se
-- abstuvía, o votaba en contra y bloqueaba, o se iba al chat. Las tres cosas
-- pierden información que la votación debería guardar.
--
-- Ahora hay cuatro formas de responder, y ninguna es "quedarse fuera":
--
--   yes    → sale si gana
--   no     → no sale
--   change → ni sí ni no: hay que cambiar algo. Frena la votación y devuelve la
--            idea a revisión interna con lo que la persona escribió.
--   note   → comentario sin bloquear. Aporta contexto y no cuenta como voto.
--
-- `change` y `note` NO cuentan para el mínimo de tres: son de otra naturaleza.
-- Un "cambiar esto" no es un sí. Si contara, tres personas pidiendo cambios
-- moverían la pieza igual que tres aprobaciones, que es justo lo contrario de
-- lo que significa.
-- ---------------------------------------------------------------------------

alter table rr_hub_votes
  drop constraint if exists rr_hub_votes_decision_check;

alter table rr_hub_votes
  add constraint rr_hub_votes_decision_check
  check (decision in ('yes', 'no', 'change', 'note'));

comment on column rr_hub_votes.decision is
  'yes = sale, no = no sale, change = ni sí ni no, hay que cambiar algo (frena la votación), note = comentario sin bloquear.';

-- `change` y `note` son inútiles sin texto. Este lo hace cierto en la base, no
-- solo en el formulario: la interfaz puede estar rota y el dato entra igual.
alter table rr_hub_votes
  drop constraint if exists rr_hub_votes_change_needs_note;

alter table rr_hub_votes
  add constraint rr_hub_votes_change_needs_note
  check (
    decision not in ('change', 'note')
    or (note is not null and length(btrim(note)) > 0)
  );

-- Índice para el caso nuevo: "qué voting está frenada por un cambio pedido".
-- Es la consulta que hace el tablero al abrirse, así que no puede ser un
-- barrido de la tabla.
create index if not exists rr_hub_votes_change_idx
  on rr_hub_votes (idea_id)
  where decision = 'change';
