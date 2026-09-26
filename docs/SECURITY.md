# Seguridad

Este documento dice qué está cerrado y qué sigue abierto. Si algo de aquí no
coincide con la base de datos, manda la base de datos.

## Lo que está cerrado en el código

Nada de lo de esta sección depende de aplicar una migración. Son cambios en el
repositorio, ya en producción tras cada push.

- **El repositorio es privado.** `DEADKISS0/rr-content-hub` pasó de público a
  privado. Antes cualquiera podía clonar el código y leer su historial.
- **Sin PII en HEAD.** Un correo administrativo estaba commiteado en
  `docs/AUTH_SETUP.md` y en la migración de bootstrap. Se sustituyó por
  `TU-ADMIN@ejemplo.com`. ** sigue en el historial de Git**: rotarlo requiere
  reescribir historia, y no lo he hecho porque rompe los clones de los demás.
- **La service key no llega al navegador.** Vive en un Route Handler, se lee
  desde una variable sin prefijo `NEXT_PUBLIC`, y hay un test que lo comprueba
  (`npm run verify:api`).
- **Comparación en tiempo constante** de la API key en `/api/ideas`
  (`timingSafeEqual`).
- **Headers de seguridad** en `next.config.ts`: CSP, `X-Frame-Options`,
  `X-Content-Type-Options`, `Referrer-Policy` y `Permissions-Policy`.
- **El navegador no decide permisos.** `idea-actions.tsx` recibía `activeRole`
  hardcodeado a `owner`; ahora recibe el rol del servidor y usa
  `client_viewer` por defecto. `transitionIdeaStatus` valida la transición
  contra `allowedTransitions` **en el servidor** antes de escribir.
- **Guardar un guion no inventa un evento.** `saveIdeaScript` insertaba un
  `script_in_progress` en cada guardado, así que el timeline mentía.
- **Sin datos de demostración por accidente.** Una variable de entorno
  ausente devolvía fixtures en vez de fallar. Ahora solo se usan con
  `DEMO_MODE` explícito; en cualquier otro caso lanza.
- **Dependencias sin usar fuera:** `zustand`, `@tanstack/react-query` y
  `lucide-react` no los importaba nadie. Fuera.

## Lo que sigue abierto — necesita a alguien con acceso a la base

Ninguna de estas está cerrada. El SQL está escrito y verificado
estáticamente, pero **no aplicado**, porque no hay service key ni contraseña de
la base del hub, y el token de `~/.sazon-infra` devuelve `403` para este
proyecto.

### 1. Escritura anónima — `supabase/migrations/20260926_close_anon_write.sql`

Comprobado en vivo contra producción antes de escribir el SQL:

| operación anónima | resultado |
|---|---|
| `PATCH` sobre una idea | **200** — escribe |
| `INSERT` de comentario | **201** — escribe |
| `POST` de idea | **201** — escribe |
| `DELETE` | 200 con 0 filas — bloqueado por RLS |

La causa eran dos capas: políticas públicas explícitas de `INSERT`/`UPDATE` a
`anon`, y políticas base `for all` sin destinatario. La migración cierra las dos
y borra las dos filas que dejaron las pruebas de la auditoría del 2026-09-25.

El mismo archivo crea el índice único de `code` (que faltaba y dejaba códigos
duplicados) y cierra la ventana de auditoría, que se aprovisionó con
`expires_at = null` y por tanto nunca caducaba.

### 2. Lectura del CRM — `supabase/migrations/20260927_crm_public_read_lockdown.sql`

`public.profiles` y `public.projects` son de un CRM compartido que quedó
huérfano en este proyecto. **Ningún código las consulta** (verificado en
`src/` y en los repos del equipo), pero siguen legibles sin sesión: 30 campos,
incluidos correos, nombres, avatar de Google y el pipeline comercial completo.

La migración hace `revoke ... from anon` — apaga el privilegio heredado en vez
de taparlo con una política que alguien podría reescribir. No borra filas.

### 3. Bucket `rr-content-assets` no existe

`rr_hub_assets` está vacía y el bucket de Storage no se ha creado. La subida de
archivos está rota: el código está, el destino no.

### 4. `/audit/admin` es público

Renderiza EQUIPO, ACCESOS e INVITACIONES sin pedir sesión. Ocultar el enlace no
es proteger la ruta.

## Cómo comprobarlo tú mismo

```bash
# 1. La fuga en vivo, sin escribir nada. Exit 1 = fuga abierta.
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co \
SUPABASE_ANON_KEY=<anon key> npm run verify:leak

# 2. Lo demás: 5 suites, 77 comprobaciones, sin red.
npm run verify
```

`verify:leak` va aparte de `verify` a propósito: necesita red, y el
`.env.local` apunta al stack local, donde todo responde 200 por los defaults del
emulador. El script se niega a correr si la URL no es la de producción, y
distingue "no legible" de "no pude comprobar" para no dar un falso OK.

## Verificar las políticas a mano

Después de aplicar una migración, como `postgres`:

```sql
-- Debe dar false:
select has_table_privilege('anon', 'public.profiles', 'select');
select has_table_privilege('anon', 'public.rr_hub_ideas', 'insert');

-- Debe seguir dando true:
select has_table_privilege('anon', 'public.rr_hub_ideas', 'select');
select has_table_privilege('service_role', 'public.profiles', 'select');
```

## Lo que no hay que hacer

- **No uses la service key de otro proyecto.** El token de
  `~/.sazon-infra` es de otro Supabase y da 403 aquí. Reutilizarlo, o "arreglar"
  el 403 metiendo la key de otro lado, deja dos productos con acceso al mismo
  conjunto de datos.
- **No pruebes escrituras en producción.** Dos filas que dejó la auditoría
  anterior no se pudieron borrar con la publishable key: el `DELETE` anónimo
  devolvía 200 con 0 filas. Para comprobar que algo funciona, `verify:leak`
  (solo lectura) o una tabla descartable.
- **No confíes en una verificación estática como prueba de nada en la base.**
  `verify:migration` pasa 26/26 sobre el texto del SQL. No demuestra que
  Supabase lo haya aplicado.
