-- Santiago, 2026-10-01 — auditoría de seguridad del Content Hub.
--
-- HALLAZGO. Las funciones rr_hub_* que aceptan el código de 4 dígitos son
-- invocables por `anon`, y salta la aplicación entera:
--
--   POST /rest/v1/rpc/rr_hub_equipo_del_cliente  {"p_codigo":"1111"}
--     -> devuelve nombre, correo y rol de todo el equipo de un cliente
--   POST /rest/v1/rpc/rr_hub_cliente_por_codigo  {"p_codigo":"1111"}
--     -> oráculo: dice qué cliente abre cada código
--   POST /rest/v1/rpc/rr_hub_puede_entrar
--     -> recorrido completo sin escribir nada
--
-- MEDIDO: has_function_privilege('anon', ...) sale TRUE en las 8. Postgres da
-- EXECUTE a PUBLIC por defecto, así que cualquiera con la llave anónima —que
-- va en el bundle de cualquier visitante— las llama sin pasar por
-- /api/entrar, que es la única ruta que compara el código con
-- `codigoCorrecto`.
--
-- El diseño de /api/entrar asume que la lista que devuelve esa función "es
-- información que se le da a quien ya tiene el código". La función existe solo
-- para esa ruta, pero Postgres la deja abierta al anónimo.
--
-- La app no es la frontera; la base lo es. Y aquí la base era más laxa que la
-- app.
--
-- Arreglo: EXECUTE solo para service_role, que es el rol con el que corre el
-- servidor. `authenticated` tampoco lo necesita: la app no llama estas
-- funciones directamente, entra por sus propias API routes.

-- ─────────────────────────────────────────────────────────────
-- Inventario, medido antes de revocar
-- ─────────────────────────────────────────────────────────────
-- Las que aceptan un código de cliente y son la vía de entrada:
REVOKE ALL ON FUNCTION public.rr_hub_equipo_del_cliente(text)   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rr_hub_cliente_por_codigo(text)   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rr_hub_puede_entrar(text, text)   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rr_hub_codigo_abre(text)          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rr_hub_entra(text)                FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rr_hub_puede_crear_cuenta(text)   FROM PUBLIC, anon, authenticated;

-- MEDIDO al inventariar, y se había pasado una: esta dice si un correo puede
-- votar. Con la cookie firmada ya no se puede suplantar a nadie, pero es un
-- oráculo de "quién está en la lista" y no la necesita el anónimo.
REVOKE ALL ON FUNCTION public.rr_hub_can_vote_by_email(text)    FROM PUBLIC, anon, authenticated;

-- Las que solo usa el servidor para resolver sesión y rol.
REVOKE ALL ON FUNCTION public.rr_hub_is_admin()                  FROM PUBLIC, anon, authenticated;

-- Lo que sí se concede, y a quien: el service role del servidor. Sin esto, un
-- revoke se traduce en "la app entra y no puede confirmar quién es el usuario".
GRANT EXECUTE ON FUNCTION public.rr_hub_equipo_del_cliente(text)  TO service_role;
GRANT EXECUTE ON FUNCTION public.rr_hub_cliente_por_codigo(text)  TO service_role;
GRANT EXECUTE ON FUNCTION public.rr_hub_puede_entrar(text, text)  TO service_role;
GRANT EXECUTE ON FUNCTION public.rr_hub_codigo_abre(text)         TO service_role;
GRANT EXECUTE ON FUNCTION public.rr_hub_entra(text)               TO service_role;
GRANT EXECUTE ON FUNCTION public.rr_hub_puede_crear_cuenta(text)  TO service_role;
GRANT EXECUTE ON FUNCTION public.rr_hub_can_vote_by_email(text)   TO service_role;
GRANT EXECUTE ON FUNCTION public.rr_hub_is_admin()               TO service_role;

-- ─────────────────────────────────────────────────────────────
-- Lo que sigue abierto, dicho por escrito
-- ─────────────────────────────────────────────────────────────
-- - Sin rate limiting en /api/entrar: 10.000 códigos se prueban en un segundo.
--   Este archivo no lo arregla; reduce lo que se puede enumerar, no el
--   intento. Ese va aparte.
-- - codigoCorrecto() en src/lib/hub-session.ts usa timingSafeEqual y está
--   testeada, pero NINGUNA ruta la importa: /api/entrar delega en el RPC, que
--   compara con `=` normal. Es documentación de una intención que no está
--   vigente, y los tests dan falsa confianza. Se limpia en el código.
