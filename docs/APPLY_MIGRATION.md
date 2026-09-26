# Cómo aplicar las migraciones pendientes

> Resumen del estado en [`SECURITY.md`](./SECURITY.md). Hay **dos**
> migraciones escritas y verificadas estáticamente, ninguna aplicada, y dos
> problemas más que no tienen migración.

| # | Qué resuelve | Archivo | Estado |
|---|---|---|---|
| 1 | Escritura anónima (PATCH 200, INSERT 201) | `20260926_close_anon_write.sql` | **sin aplicar** |
| 2 | Lectura anónima del CRM huérfano | `20260927_crm_public_read_lockdown.sql` | **sin aplicar** |
| 3 | Bucket `rr-content-assets` inexistente | `20260926_close_anon_write.sql` bloque 8 | **sin aplicar** (ya no necesita panel) |
| 4 | `/audit/admin` público | `src/lib/admin-guard.ts` | **código hecho, falta configurar Vercel** |

Aplícalas **en orden**. La 2 no depende de la 1, pero si solo vas a hacer una,
haz la 1: es la que permite escribir sin credenciales. El bucket va dentro de la
migración 1, así que no es un paso aparte.

---

# Migración 1 — cierre de escritura anónima

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

---

# Migración 2 — cierre de lectura del CRM huérfano

## Qué hace

`public.profiles` y `public.projects` son de un CRM compartido con otros
productos que quedó en este proyecto de Supabase. Nadie las consulta: cero
referencias en `src/`, y la búsqueda en `rr-aliados`, `rr-sync`,
`rr-precontratos`, `dev/*`, `snap` y `src` tampoco devuelve nada. El único
cliente con esta URL es `~/.config/rr-commander`, y su `.env` no las usa.

Pero siguen legibles sin sesión, con la publishable key que va en el bundle del
navegador. Son 30 campos, entre ellos `email`, `name`, `avatar_url` y el
pipeline comercial (`valor_total`, `valor_pagado`, `valor_potencial`,
`servicios`, `estado`).

Hace `revoke all on table ... from anon` para las dos: apaga el privilegio
heredado del rol en vez de taparlo con una política RLS que alguien podría
reescribir. **No borra ni una fila** — los datos quedan ahí por si aparece un
consumidor legítimo, solo dejan de ser legibles por cualquiera.

El primer bloque es un inventario: registra qué ve un anónimo *antes* del
cambio, en el log del servidor. Es lo que hace la migración reversible si
aparece un consumidor que no encontramos.

## Por qué también la tienes que aplicar tú

Mismo motivo que la migración 1: hace falta acceso total a la base.

## Pasos

1. Panel de Supabase → SQL Editor → **New query**.
2. Pegar el contenido de `supabase/migrations/20260927_crm_public_read_lockdown.sql`.
3. Run. No debería dar error.
4. Comprobar:

```sql
-- Debe dar false:
select has_table_privilege('anon', 'public.profiles', 'select');
select has_table_privilege('anon', 'public.projects', 'select');

-- Wundeer debe seguir legible (true):
select has_table_privilege('anon', 'public.rr_hub_ideas', 'select');

-- El service_role no se toca (true):
select has_table_privilege('service_role', 'public.profiles', 'select');
```

Y desde fuera, sin credenciales:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co \
SUPABASE_ANON_KEY=<anon key> npm run verify:leak
# esperado: "ok profiles", "ok projects", y TODO OK al final
```

Si alguna vez sale `?? no se pudo comprobar`, la sonda no llegó a ejecutarse:
eso no es un "todo bien", revisa la URL y la key.

## Si algo deja de funcionar

No hace falta revertir nada. El servicio que falle registrará el error de
permisos; basta con buscar la consulta en el log. Y si de verdad hace falta
devolver acceso a una de las dos tablas, se re-otorga con una política
explícita y documentada, no devolviendo el privilegio a `anon` entero.

---

# Los otros dos problemas (sin migración)

## 3. El bucket `rr-content-assets` no existe

`rr_hub_assets` está vacía y el bucket de Storage no se ha creado. La subida de
archivos está rota: el código está, el destino no. Crear el bucket se hace desde
el panel (Storage → New bucket) o por API con la service key. Necesita además
las políticas de Storage que ya están escritas en la migración 1.

## 4. `/audit/admin` es público

Renderiza EQUIPO, ACCESOS e INVITACIONES sin pedir sesión. Ocultar el enlace no
protege la ruta. El arreglo natural es una guarda de rol en
`src/app/audit/admin/page.tsx` reutilizando la comprobación de
`rr_hub_access` que ya existe en el resto de la app. No lo he hecho porque
depende de que haya al menos un `owner` dado de alta: si lo cierro antes de eso,
la única forma de volver a entrar sería por SQL.

