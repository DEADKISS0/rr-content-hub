-- Las dos filas que dejo la auditoria del 2026-09-25/26. Se quedan visibles
-- en Wundeer porque el DELETE anonimo esta bloqueado por RLS a proposito: por
-- eso se borran aqui, con una sesion que pueda escribir.
--
--   RR-AUDIT-PROBE-DELETE-ME  idea      draft   code = null
--   probe-hermes              comentario
--
-- El DELETE anonimo devuelve HTTP 200 con 0 filas afectadas, o sea que la
-- clave publica no puede limpiarlas. Solo la service key o el SQL Editor.

begin;

delete from public.rr_hub_comments where body = 'probe-hermes';

-- La idea se identifica por su titulo y no por id: el id cambia entre entornos,
-- y por titulo el borrado es idempotente. El filtro `code is null` evita tocar
-- una idea real que por casualidad se llamara igual.
delete from public.rr_hub_ideas
 where title = 'RR-AUDIT-PROBE-DELETE-ME'
   and code is null;

commit;

-- Verificacion: ambas consultas deben devolver 0.
--   select count(*) from public.rr_hub_ideas   where title = 'RR-AUDIT-PROBE-DELETE-ME';
--   select count(*) from public.rr_hub_comments where body = 'probe-hermes';
--
-- rr_hub_ideas deberia bajar de 26 a 25 filas.
