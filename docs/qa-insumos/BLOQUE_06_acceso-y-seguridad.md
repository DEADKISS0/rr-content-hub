# BLOQUE 06 — Acceso, middleware y seguridad

> Fuente: lectura literal en la rama `pausa-visible`, commit `6b836c1` (2026-10-01).
> Archivos: `src/proxy.ts`, `src/lib/supabase/middleware.ts`, `src/lib/public-rutas.ts`,
> `src/lib/hub-session.ts`, `src/lib/mode.ts`, `src/lib/admin-guard.ts`, `scripts/verify-leak.mjs`
> y las 3 migraciones de cierre.

---

## a) `proxy.ts` y el matcher

**El archivo se llama `proxy.ts`, no `middleware.ts`** — está en `src/proxy.ts`.

**Contenido completo, literal** (1 línea de código):
```ts
import { updateSession } from '@/lib/supabase/middleware'; import type { NextRequest } from 'next/server';
export function proxy(request: NextRequest){return updateSession(request)}
export const config={matcher:['/((?!_next/static|_next/image|favicon.ico).*)']};
```

🔴 **CRÍTICO: el `matcher` no excluye `_next/webpack-hmr`, `_next/data` ni las imágenes de
Next. Solo excluye `_next/static`, `_next/image` y `favicon.ico`.** Todo lo demás, incluidos
los endpoints de `/api/*` y los assets de la PWA, pasa por `updateSession`.

**Matcher exacto:** `['/((?!_next/static|_next/image|favicon.ico).*)']`

### `updateSession` — el guard real (`src/lib/supabase/middleware.ts`)

**Orden de decisión, literal:**

| # | Condición | Resultado |
|---|---|---|
| 1 | `esPublica(path)` | `NextResponse.next()` — pasa |
| 2 | `sesion` válida (cookie firmada) | `NextResponse.next()` — pasa |
| 3 | `path.startsWith('/api/')` | **401** JSON `{ error: 'Entra con el código de tu cliente para poder hacer eso.' }` |
| 4 | `path === '/'` | `NextResponse.next()` — pasa (la portada es pública) |
| 5 | resto | **307** redirect a `/login?next={path}` |

**El redirect, literal:**
```ts
const url = request.nextUrl.clone();
url.pathname = '/login';
url.search = '';
url.searchParams.set('next', path);
return NextResponse.redirect(url);
```

**Por qué 401 y no 307 en las APIs** (`middleware.ts:52-55`):
> *"Una API no tiene a dónde mandar a nadie: un 307 es para el navegador y `fetch` no lo
> sigue, así que el cliente solo lee 'failed to fetch'. Que responda 401 con su mensaje."*

🔴 **`url.search = ''` borra TODOS los query params antes de poner `next`.** Solo sobrevive
`next=path`. Los params originales se pierden.

### Rutas públicas (`src/lib/public-rutas.ts`)

```ts
const PUBLICAS = ['/login', '/api/entrar', '/offline', '/manifest.webmanifest', '/sw.js'];
const PREFIJOS_PUBLICOS = ['/app/'];

export function esPublica(path: string): boolean {
  if (PREFIJOS_PUBLICOS.some((p) => path.startsWith(p))) return true;
  return PUBLICAS.some((p) => path === p || path.startsWith(`${p}/`));
}
```

| Ruta pública | Por qué, literal |
|---|---|
| `/login` | la puerta |
| `/api/entrar` | *"si cayera en la rama de 'sin sesión' devolvería 401 a la única llamada que puede crear la sesión"* |
| `/offline` | página de PWA sin conexión |
| `/manifest.webmanifest` | PWA: sin esto no aparece el botón de instalar |
| `/sw.js` | service worker |
| `/app/*` | iconos de la PWA |

**Comentario que explica por qué está en archivo aparte** (`public-rutas.ts:9-16`):
> *"POR QUE ESTA EN SU PROPIO ARCHIVO Y NO EN EL PROXY. Dos veces se ha tried fixarlo aqui y
> las dos veces el arreglo se quedaba en el proxy sin que nada lo comprobara. [...] Un test que
> mira texto no ve un bug de comparacion."*

**Comparación de prefijos, literal:**
| Lista | Comparación | Por qué |
|---|---|---|
| `PUBLICAS` | `path === p \|\| path.startsWith(\`${p}/\`)` | si el prefijo acabara en `/`, buscaría `/app//` |
| `PREFIJOS_PUBLICOS` | `path.startsWith(p)` a secas | los que ya terminan en `/` |

**Y `'/'` NO está en la lista** (`public-rutas.ts:29-30`): *"Y NO se pone '/' aqui: abriria el
hub entero sin sesion."* La portada pasa por la regla 4 del guard.

🔴 **Nota importante: `esPublica` compara con `startsWith`, así que `/logins`, `/api/entrar/x`
y `/aplicaciones` también pasan.** `/aplicaciones` empieza por `/app`... no, no: `PREFIJOS_PUBLICOS`
es `'/app/'` con barra, y `PUBLICAS` exige `===` o `startsWith('/login/')`. **Pero `/app` a secas
NO es público** y devuelve 307. Ese es el fix deliberado del doble slash.

---

## b) La cookie de sesión

**Nombre:** `hub_sesion` (`hub-session.ts:70`: `const COOKIE = 'hub_sesion';`)

**Contenido de `SesionHub`** (`hub-session.ts:56-67`):
```ts
export type SesionHub = {
  nombre: string;   // Nombre de la persona, tal como aparece en rr_hub_profiles.full_name
  email: string;    // Correo de esa persona. No es una cuenta: es cómo se le reconoce.
  proyecto: string; // Slug del cliente. wundeer, candilejas, …
  desde: string;    // Momento de la entrada, para la presencia del tablero
};
```

**Atributos, literales** (`entrar/route.ts:203-210` y `cambiar-cliente/route.ts:147-154`,
idénticos en las dos):
```ts
respuesta.cookies.set(NOMBRE_COOKIE, valor, {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge,
});
```

| Atributo | Valor |
|---|---|
| `httpOnly` | **`true`** |
| `sameSite` | **`'lax'`** |
| `secure` | `NODE_ENV === 'production'` |
| `path` | `'/'` |
| `maxAge` | `30 * 24 * 60 * 60` = **2.592.000 s = 30 días** (`DIAS = 30`, `hub-session.ts:102`) |

🔴 **`secure` es condicional.** En desarrollo es `false`, así que la cookie viaja en claro por
HTTP local. En producción es `true`.

🔴 **`sameSite: 'lax'`, no `'strict'`.** Con `lax`, un click desde otro sitio manda la cookie
en la primera petición de navegación.

**Firma, literal** (`hub-session.ts:105-107`):
```ts
function firmar(carga: string): string {
  return createHmac('sha256', firma()).update(carga).digest('base64url');
}
```
Formato: `{base64url(JSON)}. {base64url(HMAC)}`

### Si caduca o está manipulada

**`leerSesion`, literal** (`hub-session.ts:130-137`):
```ts
export function leerSesion(valor: string | undefined | null): SesionHub | null {
  if (!valor) return null;
  const partes = valor.split('.');
  if (partes.length !== 2) return null;
  const [carga, firma] = partes;
```
- Sin cookie → `null`
- Formato distinto de 2 partes → `null`
- Firma inválida → `null`
- **Nunca lanza.** Comentario: *"una cookie inválida es lo mismo que no tener cookie, que es no
  haber entrado."*

**Comparación en tiempo constante** (`hub-session.ts:139-141`):
> *"Comparación en tiempo constante: si comparamos con `===`, el tiempo que tarda en responder
> dice cuántos caracteres correctos lleva la firma."*

🔴 **La caducidad NO se comprueba en `leerSesion`.** No hay `Date.now()` contra `desde` en
ningún punto de la validación. La cookie es válida **30 días** desde que se firmó, y después
de eso sigue siendo criptográficamente válida: `maxAge` solo la borra el navegador, no el
servidor. **Un `hub_sesion` robado antes de los 30 días sirve para siempre**, hasta que
cambie `HUB_SECRET`.

**NO VERIFICADO** si hay poda por `desde` en otro sitio: `grep` de `sesion.desde` da el
comentario de `SesionHub` y nada más.

### `HUB_SECRET` — obligatoria, sin default

`hub-session.ts:80-89`, literal:
```ts
function claveFirma(): string {
  const s = process.env.HUB_SECRET;
  if (!s || s.length < 32) {
    throw new Error(
      'HUB_SECRET no está configurado o es demasiado corto. Sin esta clave no se ' +
        'puede firmar la sesión: la app NO debe arrancar con una clave por defecto ' +
        'porque esa clave terminaría publicada.',
    );
  }
  return s;
}
```

**Mínimo 32 caracteres. Si falta o es corta, la app NO ARRANCA.**

🔴 **[REDACTED]** — el valor del literal histórico que había aquí no se reproduce. Ya no está
en el código. Historia documentada, literal (`hub-session.ts:68-78`):
> *"esta línea era un `??` con un LITERAL de 26 caracteres escrito justo aquí, y `HUB_SECRET` no
> existía en las variables de Vercel. El `??` ganaba siempre, así que la app firmaba las
> sesiones con una clave publicada en el repo, el README y este archivo. Eso abría la puerta
> entera sin código: cualquiera que copiara el literal podía fabricar una cookie válida para
> cualquier correo y cualquier cliente. Y como la autoridad sale de la cookie, elegir un correo
> de `SUPER_ADMIN_EMAILS` daba `owner`: lectura de todos los guiones, escritura y `borrar`."*

---

## c) `rr_hub_puede_entrar` y los demás RPC

**`rr_hub_puede_entrar`, literal** (`20260928_hub_codigo_por_cliente.sql:133-150`):
```sql
create or replace function public.rr_hub_puede_entrar(p_codigo text, p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.rr_hub_projects pr
      join public.rr_hub_access a on a.project_id = pr.id
      join public.rr_hub_profiles p on p.id = a.user_id
     where pr.access_code = p_codigo
       and lower(p.email) = lower(coalesce(p_email, ''))
       and p.is_team_member
       and p.is_active
  );
$$;
```

**Devuelve un solo `boolean`.** Comment literal:
> `'La puerta, en una sola respuesta: codigo correcto, persona con acceso a ESE cliente, del
> equipo y activa. Las tres, o no entra.'`

| Caso | Devuelve | Lo que ve quien llama |
|---|---|---|
| Las 3 condiciones se cumplen | `true` | 200 + cookie |
| Código incorrecto | `false` | 401 `Ese código no abre ningún cliente, o no tienes acceso a él.` |
| Correo que no existe | `false` | **el mismo 401** |
| Perfil con `is_team_member = false` | `false` | **el mismo 401** |
| Perfil con `is_active = false` | `false` | **el mismo 401** |

🔴 **`security definer` + `set search_path = public`.** La función corre con los permisos del
dueño. El `search_path` está fijado, que es lo correcto.

**Los otros 2 RPC del login:**

`rr_hub_cliente_por_codigo(p_codigo)` — devuelve el slug del cliente.
Comentario (`entrar/route.ts:127-128`): *"`rr_hub_cliente_por_codigo` no filtra por nada más, así
que el código no se puede usar para recorrer clientes."*

`rr_hub_equipo_del_cliente(p_codigo)` — devuelve `{ nombre, correo }` de todos los del cliente.

🔴 **Los 3 eran invocables por `anon` hasta el 2026-10-01.** Ver sección d).

---

## d) Las 3 migraciones de cierre del 2026-10-01

### `20261001_hub_vistas_rls.sql` — cierra 3 fugas

**Fuga 1, literal** (`:5-10`):
> *"rr_hub_accesos_legibles y rr_hub_catalogo NO tenían `security_invoker=true`. Postgres
> ejecutaba sus permisos con el dueño (postgres), así que el RLS de las tablas base NO se
> aplicaba. MEDIDO: anon leía 60 filas de rr_hub_access — user_id, project_id,
> role_in_project y email de las 60 asignaciones de los 4 clientes, incluidos los roles owner."*

**Arreglo, literal** (`:33-39`):
```sql
ALTER VIEW public.rr_hub_accesos_legibles SET (security_invoker = true);
ALTER VIEW public.rr_hub_catalogo         SET (security_invoker = true);

REVOKE ALL ON public.rr_hub_accesos_legibles FROM anon;
REVOKE ALL ON public.rr_hub_catalogo         FROM anon;
```

**Fuga 2** — `rr_hub_audit_settings` (`:47-55`):
```sql
REVOKE INSERT, UPDATE, DELETE ON public.rr_hub_audit_settings FROM anon;
```
**SELECT se conserva** a propósito: *"La policy `rr_hub_audit_settings_read` tiene `using (true)`
para anon, o sea que la lectura era intencional."*

**Fuga 3** — `rr_hub_invites` (`:61-64`):
```sql
REVOKE ALL ON public.rr_hub_invites FROM anon;
```
Motivo literal: *"Un anónimo podía inventarse un owner."*

**Lo que NO cierra, escrito por el propio archivo** (`:66-77`):
- Las funciones `rr_hub_*` ejecutables por anon → otro archivo
- 🔴 **El bucket `rr-content-assets` es `public = true` a propósito**: *"cualquier persona con
  la URL puede leer un guion. No es un bug; es una decisión que hay que saber que se tomó."*
- 🔴 **`SUPER_ADMIN_EMAILS` está en texto plano** en variables de Vercel y en migraciones
  versionadas: *"conviene sacarla de los archivos"*

**Regla que este archivo rompe a propósito, literal** (`:22-27`):
> *"los dos migrations de lockdown anteriores (20260927 línea 43, 20260930 línea 42) dicen por
> escrito 'NO toca rr_hub_*'. Ese perímetro excluido es exactamente donde estaban las fugas.
> verify-leak.mjs tampoco las veía: solo pregunta '¿puedo leer esta tabla?', sobre diez tablas
> con nombre fijo."*

### `20261001_hub_rpc_lockdown.sql` — cierra el oráculo del código

**Hallazgo, literal** (`:3-24`):
```
POST /rest/v1/rpc/rr_hub_equipo_del_cliente  {"p_codigo":"1111"}
  -> devuelve nombre, correo y rol de todo el equipo de un cliente
POST /rest/v1/rpc/rr_hub_cliente_por_codigo  {"p_codigo":"1111"}
  -> oráculo: dice qué cliente abre cada código
POST /rest/v1/rpc/rr_hub_puede_entrar
  -> recorrido completo sin escribir nada
```
> *"MEDIDO: has_function_privilege('anon', ...) sale TRUE en las 8. Postgres da EXECUTE a PUBLIC
> por defecto [...] La app no es la frontera; la base lo es. Y aquí la base era más laxa que la
> app."*

**Arreglo, literal** (`:26-29`):
> *"EXECUTE solo para service_role, que es el rol con el que corre el servidor. `authenticated`
> tampoco lo necesita: la app no llama estas funciones directamente, entra por sus propias API
> routes."*

🔴 **Esto es lo que explica el 401 de `rr_hub_catalogo` que reporté en el bloque 1:** la vista
ahora es `security_invoker` + `REVOKE ALL FROM anon`. Cerrado a propósito.

### `20260930_crm_anon_lockdown.sql` — el CRM heredado

**Lo que estaba abierto, literal** (`:9-17`):
```
tabla                 filas legibles sin sesion
prospects                        22   (29 columnas: telefono, whatsapp, correo)
outreach_sequences               63   (plantillas de contacto comercial)
knowledge                        21   (incluye "Servicios y precios")
demos                            17
activities                        2
```
> *"En `pg_class.relacl` aparece `anon=arwdDxtm` — las siete letras del CRUD completo — y hay
> policies `cmd = ALL` con `qual = true`. O sea: no solo se leia, tambien se escribia."*

**Lo que hace:** inventaría antes, cierra lectura y escritura en las 6, **no borra ninguna
fila**, no toca `rr_hub_*`, no toca `verticals`.

**Por qué no se había visto, literal** (`:21-32`):
> *"`scripts/verify-leak.mjs` existe, pero en dos fallos propios: 1. NO estaba en `npm run verify`
> (que es lo que corre CI). Nunca ha corrido solo. 2. Su `MUST_BE_PRIVATE` decia `['profiles',
> 'projects']`, que NO son las tablas de este CRM. Preguntar por nombres inexistentes da `ok` sin
> haber medido nada: una confianza falsa, que es peor que no tener verificador."*

---

## e) La batería de sondas: qué existe y qué NO

🔴 **NO EXISTE una "batería de 13 sondas".** Comandos usados:
```
grep -rIn '13 sondas|trece sondas' . --include=*.md --include=*.mjs --include=*.py --include=*.ts
→ sin resultados
grep -n 'sonda' scripts/verify-leak.mjs
→ sin resultados (verify-leak no usa la palabra "sonda")
```

**Lo que existe de verdad son 3 verificadores, no 1:**

| Script | Líneas | Qué hace | ¿Cuántas sondas? |
|---|---|---|---|
| `scripts/verify-leak.mjs` | 159 | **10 tablas**: 5 del hub + 5 del CRM | 10 |
| `scripts/verify-api.mjs` | 54 | métodos y rutas del API | **NO ENCONTRADO** (grep de "sonda" vacío) |
| `scripts/verify-admin.mjs` | — | guard de admin | — |

**`verify:leak` NO está en `npm run verify`** (`package.json:12`):
```json
"verify": "npm run verify:writes && npm run verify:states && npm run verify:flow && npm run verify:api && npm run verify:admin && npm run verify:migration && npm run verify:roadmap",
```
Comentario literal de `package.json:11`:
> *"verify corre sin red (estatico + dominio). verify:leak va aparte a proposito: necesita la URL
> y la anon key de PRODUCCION, y el .env.local apunta al stack local."*

### Las 10 sondas de `verify-leak.mjs` — descritas, NO ejecutadas

**Las 5 del hub** (`MUST_BE_PRIVATE_HUB`, `verify-leak.mjs:47-49`):
```js
const MUST_BE_PRIVATE_HUB = [
  'rr_hub_ideas', 'rr_hub_projects', 'rr_hub_comments', 'rr_hub_events', 'rr_hub_assets',
];
```

**Las 5 del CRM** (`MUST_BE_PRIVATE`, `verify-leak.mjs:66-68`):
```js
const MUST_BE_PRIVATE = [
  'prospects', 'activities', 'knowledge', 'outreach_sequences', 'demos',
];
```

| # | Sonda | Request | Resultado esperado | Cómo lo decide |
|---|---|---|---|---|
| 1 | `rr_hub_ideas` | `GET /rest/v1/rr_hub_ideas?select=*&limit=1` | **no legible** | `PGRST205` → no existe · `42501` → sin permiso |
| 2 | `rr_hub_projects` | idem | **no legible** | ídem |
| 3 | `rr_hub_comments` | idem | **no legible** | ídem |
| 4 | `rr_hub_events` | idem | **no legible** | ídem |
| 5 | `rr_hub_assets` | idem | **no legible** | ídem |
| 6 | `prospects` | idem | **no legible** | ídem |
| 7 | `activities` | idem | **no legible** | ídem |
| 8 | `knowledge` | idem | **no legible** | ídem |
| 9 | `outreach_sequences` | idem | **no legible** | ídem |
| 10 | `demos` | idem | **no legible** | ídem |

🔴 **Solo 10 sondas, todas de LECTURA.** No hay ninguna sonda de escritura. El script lo dice
(`verify-leak.mjs:6-7`): *"Este script no muta nada a proposito. Las dos filas de prueba que dejo
una auditoria anterior se limpiaron con la migracion, no desde aqui."*

🔴 **Falta `rr_hub_votes`, `rr_hub_profiles`, `rr_hub_access`, `rr_hub_invites`,
`rr_hub_presencia`, `rr_hub_ad_library` y las 2 vistas.** Con lo que se sabía el 2026-09-30,
las 3 fugas del 2026-10-01 estaban **justo en las que el script no miraba**.

**Guardas del script, literales:**
- **Falla si la URL no es producción** (`verify-leak.mjs:31-35`):
  ```js
  const PRODUCTION_HOST = 'ntgtvtzbjwotuwkiflar.supabase.co';
  if (!url.includes(PRODUCTION_HOST)) { console.error(...); process.exit(2); }
  ```
- **Un fallo de red NO cuenta como cerrado** (`verify-leak.mjs:81-96`): distingue
  `missing` / `denied` de `unknown`, y si hay `unknown > 0` sale con código 2:
  > *"Un 'todo bien' aqui seria falso. Revisar la URL y la anon key."*
- **Fuga = salida 1**, mensaje: `${n} tabla(s) del CRM siguen publicas.`

🔴 **Ningún código de acceso real se imprime.** La URL del proyecto Supabase sí aparece en el
script como constante, pero es pública por definición (va en el bundle del navegador).
**[REDACTED]**: los códigos de 4 cifras de los clientes no se reproducen aquí.

---

## f) Comportamiento con `NEXT_PUBLIC_AUTH_ENABLED=false`

🔴 **ESA VARIABLE NO EXISTE. `AUTH_ENABLED` es una constante, no una variable de entorno.**

`src/lib/mode.ts`, completo:
```ts
export const AUTH_ENABLED = true;
export const PUBLIC_MODE = false;
```

**Comentario literal completo** (`mode.ts:1-21`):
> *"Ya no hay modo público. Antes `AUTH_ENABLED` era un interruptor entre 'todo abierto' y 'login
> de Google'. Desde el 2026-09-28 la puerta es un código de cuatro dígitos por cliente, y eso no
> se apaga: el código se comprueba siempre, en el servidor, y sin él no hay cookie, y sin cookie
> no se entra. El interruptor se conserva con este valor porque hay código que lo lee para
> decidir si ensaya o no [...] - `AUTH_ENABLED` siempre vale `true`: la puerta está encendida.
> - `PUBLIC_MODE` siempre vale `false`: no existe el modo abierto."*

🔴 **Consecuencia medida en el código: `ctx.abierto` es SIEMPRE `false`.**
`route.ts:120` lo fija literal:
```ts
return { supabase: service, service, userId: perfil.id, email: sesion.email, abierto: false,
```
Y las dos ramas que dependen de él (`route.ts:201-202` y `route.ts:1000-1001`) son **código
muerto**: la ruta de "modo abierto" con `role: 'owner'` nunca se alcanza.

| Variable | Estado |
|---|---|
| `NEXT_PUBLIC_AUTH_ENABLED` | **NO EXISTE** en el código |
| `AUTH_ENABLED` | constante `true`, no se lee del entorno |
| `PUBLIC_MODE` | constante `false` |
| `ctx.abierto` | siempre `false` (fijado literal en `route.ts:120`) |

---

## g) Mensajes de error visibles, por caso

| Caso | Dónde | HTTP | Mensaje literal |
|---|---|---|---|
| **Código incorrecto** | `entrar/route.ts:78` | 401 | `Ese código no abre ningún cliente.` |
| **Código que no abre nada** (mismo texto) | `entrar/route.ts:78` | 401 | `Ese código no abre ningún cliente.` |
| **Límite de intentos** (mismo texto a propósito) | `rate-limit.ts:39` | 401 | `Ese código no abre ningún cliente.` |
| **Persona sin acceso a ese cliente** | `entrar/route.ts:181-184` | 401 | `Ese código no abre ningún cliente, o no tienes acceso a él.` |
| **RPC falla** | `entrar/route.ts:130, 163, 178` | 500 | `No pudimos comprobar el código.` |
| **Sin configuración de Supabase** | `entrar/route.ts:112` | 500 | `El sistema de acceso no está configurado.` |
| **Nombre no en la lista** | `entrar/route.ts:180` | 401 | ⚠️ **NO DISTINGUIDO** — mismo 401 que el anterior |
| **Usuario sin proyectos** | `cambiar-cliente/route.ts:127` | 403 | `No tienes acceso a ese cliente. Se lo pides a quien administra el hub.` |
| **Proyecto sin acceso** | `cambiar-cliente/route.ts:127` | 403 | mismo texto |
| **Sin sesión (API)** | `middleware.ts:57-60` | 401 | `Entra con el código de tu cliente para poder hacer eso.` |
| **Sesión caducada o manipulada** | `middleware.ts:46-60` | 307 | redirect a `/login?next={path}` (navegador) · 401 (API) |
| **Sin sesión en otra ruta** | `workspace/pieza`, `subir`, `archivo`, `presencia` | 401 | `Entra con el código de tu cliente.` |
| **No es admin** | `audit/admin/page.tsx:25` | **404** | `notFound()` — sin mensaje, página de "no encontrado" |
| **Sin rol en el proyecto** | `cambiar-cliente/route.ts:100, 94` | 403 | `Tu correo no está en la lista del equipo.` / `Tu cuenta existe pero no eres del equipo.` |
| **Fila desactivada** | `cambiar-cliente/route.ts:103` | 403 | `Tu fila está desactivada, así que no puedes cambiar de cliente.` |

🔴 **"Nombre no en la lista" NO tiene mensaje propio.** `rr_hub_puede_entrar` devuelve un solo
`boolean` y el paso 2 devuelve el 401 genérico. No hay forma de que el usuario sepa si falló
el código, el correo o el rol.

🔴 **La sesión caducada da 307, no un mensaje.** El usuario ve la pantalla de login sin
explicación de por qué.

---

## Tabla de cierre

| Dato pedido | Estado | Fuente |
|---|---|---|
| a) `matcher` del proxy | **ENCONTRADO** | `src/proxy.ts` (archivo completo) |
| a) Rutas públicas | **ENCONTRADO — 5 exactas + 1 prefijo** | `public-rutas.ts:18`, `33` |
| a) A dónde redirige y con qué código | **ENCONTRADO — 307 a `/login?next=`** | `middleware.ts:65-70` |
| b) Nombre de la cookie | **ENCONTRADO — `hub_sesion`** | `hub-session.ts:70` |
| b) Atributos | **ENCONTRADO — httpOnly, lax, condicional, 30 días** | `entrar/route.ts:203-210` |
| b) Qué pasa si caduca | **ENCONTRADO — nada, el servidor no comprueba la edad** | `leerSesion`, `hub-session.ts:130-137` |
| b) Qué pasa si está manipulada | **ENCONTRADO — `null`, sin lanzar** | ídem |
| c) `rr_hub_puede_entrar` | **ENCONTRADO — SQL literal** | `20260928_hub_codigo_por_cliente.sql:133-150` |
| c) Los 4 casos de retorno | **ENCONTRADO — los 4 dan `false` → mismo 401** | `entrar/route.ts:180-185` |
| d) `hub_vistas_rls` | **ENCONTRADO — cierra 3 fugas** | `20261001_hub_vistas_rls.sql:33-64` |
| d) `hub_rpc_lockdown` | **ENCONTRADO — cierra 8 funciones a anon** | `20261001_hub_rpc_lockdown.sql:3-29` |
| d) `crm_anon_lockdown` | **ENCONTRADO — cierra 6 tablas del CRM** | `20260930_crm_anon_lockdown.sql:9-17` |
| e) Batería de 13 sondas | **NO EXISTE — hay 10 sondas de lectura** | `verify-leak.mjs:47-68` |
| e) `verify:leak` en CI | **ENCONTRADO — NO está en `npm run verify`** | `package.json:11-12` |
| f) `AUTH_ENABLED=false` | **ENCONTRADO — la variable no existe** | `mode.ts:22-23` |
| f) `ctx.abierto` | **ENCONTRADO — siempre `false`, código muerto** | `route.ts:120` |
| g) Mensajes por caso | **ENCONTRADO — 15 casos** | tabla final |

**CONTRADICCIONES detectadas (3):**
1. El prompt pide "la batería de 13 sondas": **no existe**. Hay 10 sondas, todas de lectura, en un script que **no corre en CI** y que **no mira las 7 tablas donde estaban las fugas** que se cerradas el 2026-10-01.
2. `AUTH_ENABLED` es una constante compilada, no una variable de entorno. Poner `NEXT_PUBLIC_AUTH_ENABLED=false` no hace nada: no hay código que la lea.
3. La cookie tiene `maxAge: 30 días` pero **`leerSesion` no comprueba la fecha**. El navegador borra la cookie, el servidor no: un valor robado sigue valiendo criptográficamente para siempre mientras `HUB_SECRET` no cambie.

---
*BLOQUE 6 COMPLETO. Archivo: `docs/qa-insumos/BLOQUE_06_acceso-y-seguridad.md`*
