-- Santiago, 2026-10-01 — auditoría de seguridad del Content Hub.
--
-- Tres fugas medidas ANTES de este archivo, con la llave anónima (anon):
--
--   1. rr_hub_accesos_legibles y rr_hub_catalogo NO tenían
--      `security_invoker=true`. Postgres ejecutaba sus permisos con el dueño
--      (postgres), así que el RLS de las tablas base NO se aplicaba.
--      MEDIDO: anon leía 60 filas de rr_hub_access — user_id, project_id,
--      role_in_project y email de las 60 asignaciones de los 4 clientes,
--      incluidos los roles owner.
--
--   2. rr_hub_audit_settings e rr_hub_invites tenían INSERT/UPDATE/DELETE
--      abiertos a anon. MEDIDO: los cuatro had_table_privilege en true. Un
--      anónimo podía apagar el interruptor de auditoría y escribir
--      invitaciones.
--
--   3. Las funciones rr_hub_* que aceptan el código de 4 dígitos eran
--      ejecutables por anon, saltándose /api/entrar entero.
--
-- Este archivo cierra 1 y 2. La 3 se cierra en 20261001_hub_rpc_lockdown.sql.
--
-- Regla que se rompe aquí a propósito: los dos migrations de lockdown
-- anteriores (20260927 línea 43, 20260930 línea 42) dicen por escrito
-- "NO toca rr_hub_*". Ese perímetro excluido es exactamente donde estaban
-- las fugas. verify-leak.mjs tampoco las veía: solo pregunta "¿puedo leer
-- esta tabla?", sobre diez tablas con nombre fijo.

-- ─────────────────────────────────────────────────────────────
-- 1. Las vistas que se saltaban el RLS
-- ─────────────────────────────────────────────────────────────
-- `security_invoker=true` hace que la vista se lea con los permisos del que
-- pregunta, no con los del dueño. Con eso, el RLS de rr_hub_access vuelve a
-- mandar y anon se queda en cero filas.

ALTER VIEW public.rr_hub_accesos_legibles SET (security_invoker = true);
ALTER VIEW public.rr_hub_catalogo         SET (security_invoker = true);

-- Y de paso: la lectura se le cierra a anon. Estas vistas solo existen para
-- la app autenticada y para el service role del servidor.
REVOKE ALL ON public.rr_hub_accesos_legibles FROM anon;
REVOKE ALL ON public.rr_hub_catalogo         FROM anon;

-- ─────────────────────────────────────────────────────────────
-- 2. rr_hub_audit_settings: dejar de ser escribible por cualquiera
-- ─────────────────────────────────────────────────────────────
-- La policy `rr_hub_audit_settings_read` tiene `using (true)` para anon, o sea
-- que la lectura era intencional. La escritura NO: nada en la app escribe esta
-- tabla desde el cliente; la escribe el servidor con el service role.
--
-- Se conserva SELECT para no romper la lectura que ya se usa, y se quita lo
-- demás. Si algún día hace falta escribir desde el cliente, se abre con
-- intención, no por herencia de permisos.
REVOKE INSERT, UPDATE, DELETE ON public.rr_hub_audit_settings FROM anon;

-- ─────────────────────────────────────────────────────────────
-- 3. rr_hub_invites: invitaciones pendientes de los 4 clientes
-- ─────────────────────────────────────────────────────────────
-- email + project_id + role_in_project. Con escritura abierta, anon podía
-- inventarse un owner. Hoy ninguna ruta autoriza con esta tabla (las
-- migraciones lo dicen), pero una escalada obvia no se deja abierta por
-- "todavía no se usa".
REVOKE ALL ON public.rr_hub_invites FROM anon;

-- ─────────────────────────────────────────────────────────────
-- 4. Lo que este archivo NO cierra, dicho por escrito
-- ─────────────────────────────────────────────────────────────
-- - Las funciones rr_hub_* ejecutables por anon (otro archivo).
-- - El bucket rr-content-assets es public=true a propósito: los archivos de
--   Wundeer se comparten. Aceptable por diseño, pero cualquier persona con la
--   URL puede leer un guion. No es un bug; es una decisión que hay que saber
--   que se tomó.
-- - SUPER_ADMIN_EMAILS está en texto plano en variables de Vercel y en
--   migraciones versionadas. Con la cookie firmada ya arreglada no abre nada
--   por sí sola, pero conviene sacarla de los archivos.
