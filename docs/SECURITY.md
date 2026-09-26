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
  `client_viewer` por defecto.
- **Ninguna escritura sale del navegador.** Las seis mutaciones del workspace
  (transición, guion, comentario, resolver comentario, asset, crear idea)
  escribían directo a Supabase con la anon key. `transitionIdeaStatus` incluso
  documentaba que "un request a mano no puede saltarse estados" — y sí podía:
  la validación estaba en el código que el atacante no tiene que ejecutar.
  Ahora todo pasa por `api/workspace/[action]`, que lee el rol de
  `rr_hub_access` para el usuario de la sesión, relee el estado real de la base
  antes de transicionar, y pone el autor del comentario. El upload a Storage sí
  sigue desde el navegador, a propósito: lleva el token de sesión, y son las
  políticas de `storage.objects` las que deciden.
- **No existe forma de conceder roles desde la app.** `access-admin.tsx` era el
  único que escribía en `rr_hub_access`/`rr_hub_invites`, lo hacía desde el
  cliente y no lo renderizaba ninguna página. Se borró. Los roles se dan por
  SQL, que es el punto.
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

Comprobado en vivo: la API de Storage devuelve `[]`, o sea que **no hay ningún
bucket**, no solo falta el del hub. `uploadAsset()` fallaba siempre con
`NoSuchBucket`, y `getPublicUrl()` sobre un bucket inexistente devuelve una URL
que da 404 en lugar de un error visible.

**Ya está resuelto en la migración 1** (bloque 8): crea el bucket, público, con
tope de 100 MB y los tipos MIME que la app ya aceptaba. Va **después** de las
políticas de storage, y un test comprueba ese orden — al revés, el bucket nace
sin acceso.

Dos arreglos de código en `workspace-client.ts` acompañan al bucket:

- El registro en `rr_hub_assets` ya no se escribe antes de confirmar la subida.
  Antes podía quedar una fila apuntando a un objeto que nunca se subió, que se
  veía como imagen rota en lugar de un error.
- `signedAssetUrl()` comprueba que el objeto exista (listando la carpeta, que es
  barato) en vez de devolver una URL muerta. `getPublicUrl()` nunca falla: solo
  concatena strings.

### 4. `/audit/admin` — cerrado en código, falta configurar

Renderiza EQUIPO, ACCESOS e INVITACIONES a cualquiera que escriba la URL.
Ocultar el enlace no protege la ruta.

**Ya arreglado en el código:** `src/lib/admin-guard.ts` exige
`rr_hub_profiles.global_role = 'admin'` y, si no se cumple, responde **404**, no
403 — un 403 confirma que la ruta existe y sirve para probar credenciales. La
comprobación corre antes de cualquier consulta, así que un intento no autorizado
ni siquiera toca la base. Un rol de proyecto (`role_in_project`) **no** da acceso
admin: un `client_approver` no puede leer el roster de la empresa.

**Lo que falta, y es decisión tuya:** las tres tablas de acceso
(`rr_hub_profiles`, `rr_hub_access`, `rr_hub_invites`) están **vacías** en
producción — comprobado en vivo. No hay ningún admin, y con el control estricto
nadie podría entrar.

Por eso la guarda tiene un escape: `SUPER_ADMIN_EMAILS` en Vercel (correos
separados por coma). Solo se aplica **con sesión iniciada** — sin sesión no hay
contra quién comparar, así que no es una puerta trasera. Configúrala **antes del
próximo deploy** o te quedas fuera:

```bash
# Vercel > Settings > Environment Variables, y redeploy:
SUPER_ADMIN_EMAILS=tu-correo@gmail.com
```

Requisito adicional: `NEXT_PUBLIC_AUTH_ENABLED=true`. Sin autenticación no hay
sesiones, y la guarda no tiene contra qué comprobar.

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
