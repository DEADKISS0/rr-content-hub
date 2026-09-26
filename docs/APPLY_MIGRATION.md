# Cómo aplicar la migración que cierra la escritura anónima

## Qué hace

Cierra las dos capas que permitían escribir sin credenciales, y conserva la
lectura pública de Wundeer:

1. Las políticas `for insert to anon` / `for update to anon` de
   `20260911_wundeer_collaborative_mode.sql`.
2. Las políticas base de `20260910_content_hub_isolated.sql`, declaradas como
   `for all` **sin** `to authenticated` — que por eso también las cumplía `anon`.

## Por qué tienes que aplicarla tú

Requiere una llave con acceso total a la base (`SUPABASE_SERVICE_ROLE_KEY` o el
password de la DB). Vive en Vercel como secreto, y esa API no resuelve secretos.
Por eso no la aplico desde el terminal.

## Pasos

1. Abre https://supabase.com/dashboard y entra al proyecto
   **`ntgtvtzbjwotuwkiflar`** (el que termina en `.supabase.co` en las variables
   de Vercel).
2. Menú **SQL Editor** → **New query**.
3. Copia el contenido de
   `supabase/migrations/20260926_close_anon_write.sql`.
4. **Run**.

El archivo es idempotente: aplicarlo dos veces no rompe nada.

## Qué puedes ver si algo falla

| Error | Causa | Qué hacer |
|---|---|---|
| `must be owner of table` | La sesión no es `postgres` | Usa el usuario por defecto del proyecto |
| `relation "rr_hub_ideas" does not exist` | Proyecto equivocado | Revisa el paso 1 |
| `policy ... already exists` | Hay otra sesión con políticas | Refresca y revisa con el SELECT de abajo |

Ninguna de las sentencias destructivas corre si falla una anterior: el archivo
es una transacción implícita y Postgres la revierte entera.

## Verificar que funcionó

Pega esto en el SQL Editor. Todas deben dar `0`:

```sql
-- 1. Ninguna escritura anonima sobrevive
select tablename, policyname, cmd, roles
  from pg_policies
 where schemaname = 'public'
   and 'anon' = any(roles)
   and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL');
-- esperado: 0 filas

-- 2. La lectura anonima sigue viva
select tablename, cmd
  from pg_policies
 where schemaname = 'public' and 'anon' = any(roles)
 order by 1, 2;
-- esperado: 4 filas, todas `SELECT`
--   rr_hub_comments | SELECT
--   rr_hub_events    | SELECT
--   rr_hub_ideas     | SELECT
--   rr_hub_projects  | SELECT

-- 3. La ventana de auditoria quedo cerrada
select enabled, expires_at from public.rr_hub_audit_settings where id = true;
-- esperado: enabled = false, expires_at con fecha (ya no null)

-- 4. Las filas de prueba se borraron
select count(*) from public.rr_hub_ideas
 where title = 'RR-AUDIT-PROBE-DELETE-ME';   -- esperado: 0
select count(*) from public.rr_hub_comments
 where body = 'probe-hermes';                 -- esperado: 0
```

Y desde fuera, en `https://rr-content-hub.vercel.app/wundeer/ideas`, la vista de
anónimo debe seguir mostrando las ideas: solo se cerró la escritura.

## Si después quieres devolver la escritura

1. `NEXT_PUBLIC_AUTH_ENABLED=true` en Vercel y redeploy.
2. Dar de alta a la persona en `rr_hub_access` con su `role_in_project`.
3. Revertir el punto 3 de `20260926_close_anon_write.sql` (los pares
   `*_read` / `*_write`), que es lo único que hay que deshacer.

## Nota sobre el orden

Esta migración está fechada `20260926` y va después de `20260925_anon_write_lockdown`,
que quedó absorbida aquí. Aplícala una sola vez, a esta. El archivo de la 20260925
ya no está en el repo: su contenido y el de esta están fusionados, sin políticas
duplicadas.
