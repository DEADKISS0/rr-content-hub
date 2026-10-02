# BLOQUE 04 — Funciones sin documentar

> Fuente: lectura literal en la rama `pausa-visible`, commit `6b836c1` (2026-10-01).
> `main` está en `2bd0f1d`. La rama actual tiene 8 commits por delante de `main`.

---

## 1. Ideas archivadas

**Migración:** `supabase/migrations/20260929_hub_ideas_archivadas.sql`

**Columnas, literal:**
```sql
alter table public.rr_hub_ideas
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.rr_hub_profiles(id) on delete set null;
```

**Índice parcial** (`20260929_hub_ideas_archivadas.sql:33-35`):
```sql
create index if not exists rr_hub_ideas_vivas_idx
  on public.rr_hub_ideas (project_id, status)
  where archived_at is null;
```

**Cómo se archiva:** acción `borrar` (`route.ts:723-766`).
- Solo `PUEDE_BORRAR = ['owner']` (`flow.ts:70`)
- Solo desde `PUEDE_BORRAR_ESTADOS = ['draft', 'internal_review']` (`flow.ts:79-81`)
- Si no está en esos estados, mensaje literal (`route.ts:723`):
  `"${idea.title}" ya no es un borrador: está en ${idea.status}. Se archiva en vez de borrarse, para no perder los votos ni los comentarios.`
- **NO es un `DELETE`.** Comentario del código: *"Un `DELETE` en cascada borra también los votos y
  los comentarios."*

**Evento escrito, literal** (`route.ts:753-759`):
```ts
from_status: idea.status,
to_status: idea.status,
comment: `Borrada del tablero por ${email}`,
```
Con `actor_id: userId` presente. `from_status = to_status` porque archivar no cambia fase.

**Respuesta al cliente, literal** (`route.ts:761-765`):
```ts
borrada: true,
mensaje: `"${idea.title}" está fuera del tablero. La idea y su historial siguen guardados.`,
```

**¿Se puede restaurar? NO ENCONTRADO.** No hay acción `desarchivar`, `restore` ni
`unarchive` en `src/`. `archived_at` se puede poner a `null` por SQL, pero no hay código.
La migración dice en su comentario *"Si el borrado fue un error, se desarchiva"*, pero
**no hay ninguna acción que lo haga**.

**Dónde se ve: NO ENCONTRADO.** No hay vista, página ni filtro de ideas archivadas en `src/`.
`getIdeas` no tiene parámetro de archivadas. El índice parcial `rr_hub_ideas_vivas_idx` existe
pero la vista del tablero filtra por otro lado.

---

## 2. `/[projectSlug]/metricas`

**Archivo:** `src/app/[projectSlug]/metricas/page.tsx` (64 líneas).

**Qué calcula** (`metricas/page.tsx:13-24`): filtra `getIdeas(project.id)` por
`inQueue(idea.status, 'publicaciones')` y de ahí saca:

| Métrica | Cómo se calcula | Campo |
|---|---|---|
| `PUBLICADAS` | `ideas.filter(i => i.status === 'published').length` | — |
| `ORGÁNICO` | publicadas con `content_type === 'organic'` | — |
| `PAUTA` | publicadas con `content_type === 'paid'` | — |
| `REPARTO POR CATEGORÍA` | `Map` por `idea.category \|\| 'Sin categoría'`, top 5 | — |

🔴 **Solo cuenta piezas. NO hay ninguna métrica de rendimiento.** El propio texto de la
página lo admite, literal:
> *"Alcance, interacción y conversión no se miden todavía: ninguna tabla registra ese dato.
> Hasta que exista, esta página solo cuenta piezas, no rendimiento."*

**Filtros: NINGUNO.** No hay selector de fecha, ni de proyecto, ni de estado. Cuenta todo.

**Estado vacío, literal:** `No hay publicaciones registradas todavía. Cuando la primera pieza
salga, aquí se cuenta.`

**Texto de la descripción, literal:**
> *"Cuenta lo que sí se puede contar hoy: cuántas piezas salieron, de qué tipo y de qué
> categoría. El rendimiento (alcance, interacción, conversión) no se mide todavía porque
> ninguna tabla lo registra."*

**Owner declarado:** `MEDIA BUYER · OWNER DEL PROYECTO`. Eyebrow:
`${project.name} · PERFORMANCE_LOOP`.

**Historial, literal del comentario** (`metricas/page.tsx:6-9`):
> *"This page used to be a byte-for-byte copy of `publicaciones` with different copy: same
> queue, same filter, and it computed no metric at all."*

**Columnas que existen y no se usan** (`metricas/page.tsx:32`): `published_url`, `due_at` y
`metrics` — *"MEDIDAS el 2026-10-01: existen y funcionan. Lo que no hay todavía es quién los
carga."*

---

## 3. `/[projectSlug]/roadmap`

**Archivo:** `src/app/[projectSlug]/roadmap/page.tsx` (46 líneas). Datos en
`src/lib/roadmap.ts`.

**Contenido:** el plan de **Wundeer**: 8 pilares
(`TEXTIL`, `CORTE`, `TALLAS`, `GRWM`, `COMUNIDAD`, `PACKS`, `CUIDADO`, `PAUTA`), 3 tracks de
desarrollo y sesiones de graduación **mensuales**.

**🔴 Bug ya corregido, documentado** (`roadmap/page.tsx:12-18`):
> *"MEDIDO 2026-10-01 (auditoría de experiencia de uso): esta página recibía
> `params.projectSlug` y NO LO USABA. `/candilejas/roadmap` servía el plan de WUNDEER."*

**Estado vacío, literal** (`roadmap/page.tsx:26-31`):
- Título: `Este cliente aún no tiene plan.`
- Cuerpo: `No hay un roadmap escrito para este cliente, y no se va a enseñar el de otro. Se
  escribe el suyo —fechas, entregables, responsable— y aquí aparece.`
- Botón: `VOLVER AL TABLERO`

**¿Quién edita? NADIE. NO ENCONTRADO.** El roadmap es un literal de TypeScript en
`src/lib/roadmap.ts`. No hay base de datos, ni API, ni formulario. Para cambiarlo hay que
tocar código y desplegar.

**Fechas calculadas, no escritas** (`roadmap.ts:71`):
```ts
export const ROADMAP_START_ISO = '2026-10-01';
```
Comentario: *"un literal de fecha en un módulo se evalúa en build y cada deploy re-databa el
plan entero sin que nadie lo notara."*

**Cadencia** (`roadmap.ts:16-18`): *"una sola sesión de graduación al mes, no una por
semana"*. Antes eran 22 semanas × 5 piezas = 110 piezas.

---

## 4. `/[projectSlug]/perfil`

**Archivo:** `src/app/[projectSlug]/perfil/page.tsx` (91 líneas).

🔴 **NO HAY NINGÚN CAMPO EDITABLE.** La página es de solo lectura: muestra `v.email` y
`v.rol`, y una lista de permisos. No hay `<form>`, ni `<input>`, ni acción de guardado.

**Estados, dos:**
1. Sin sesión → `Estás mirando el hub sin iniciar sesión. Puedes leer todo, pero crear y
   mover piezas necesita una cuenta.` + botón `INICIAR SESIÓN`
2. Con sesión → `// CORREO`, `// ROL EN {PROYECTO}`, `// QUÉ PUEDES HACER AQUÍ`

**Sin rol** (`perfil/page.tsx:83`):
> `Todavía no tienes un rol asignado en este proyecto. Pídeselo a Dirección y te lo activan.`

🔴 **CONTRADICCIÓN DE ROLES.** El mapa `ETIQUETA` y el mapa `PUEDE` de esta página usan
nombres que **NO existen en `flow.ts`**:

| Clave en `/perfil` | Existe en `flow.ts`? |
|---|---|
| `owner` | sí |
| `creative` | **NO** — el real es `creator` |
| `editor` | sí |
| `camera` | sí |
| `client_approver` | sí |
| `client_editor` | **NO** — no está en `RoleKey` |
| `client_viewer` | sí |
| `media_buyer` | sí |
| `sin_rol` | sí (en `RolProyecto`, no en `RoleKey`) |

Faltan en esta página: `creator`, `model`, `publisher`. Y sobran: `creative`, `client_editor`.

**Consecuencia medida:** alguien con rol `creator` (el rol real, con 3 filas en la base según
el comentario de `project-guard.ts:19-21`) cae en `PUEDE[undefined]` y ve el mensaje de
*"Todavía no tienes un rol asignado"*, aunque sí tenga uno. Exactamente el bug que
`project-guard.ts` dice haber corregido antes.

**El propio `project-guard.ts` lo avisa, literal** (`project-guard.ts:15-24`):
> *"`creative` estaba aquí, pero NINGÚN rol real se llama así: la columna
> `rr_hub_access.role_in_project` guarda `creator` (3 filas) — medido el 2026-09-27. Con el
> typo, un creativo con el rol correcto caía en `sin_rol` y no podía escribir nada."*

O sea: el bug se corrigió en el guard y **quedó sin corregir en `/perfil`**.

---

## 5. Presencia en vivo (`rr_hub_presencia`)

**Tabla** (`20260928_hub_login_presencia.sql:45-50`):
```sql
create table if not exists rr_hub_presencia (
  email text primary key,
  profile_id uuid references rr_hub_profiles (id) on delete set null,
  last_seen_at timestamptz not null default now(),
  sesion_id text
);
```
Comment: `'Sesiones abiertas. Caduca sola: una fila con mas de 15 minutos se considera cerrada.'`

🔴 **CONTRADICCIÓN: el comentario dice 15 minutos; el código usa 5.**
`src/app/api/presencia/route.ts:22`:
```ts
const VENTANA_ONLINE_MS = 5 * 60 * 1000;
```

**Caducidad: 5 minutos** (`presencia/route.ts:22, 87-89`):
```ts
const desde = new Date(Date.now() - VENTANA_ONLINE_MS).toISOString();
const { data, error } = await supabase
  .from('rr_hub_presencia')
  .select('email, profile_id, last_seen_at, sesion_id')
  .gte('last_seen_at', desde)
  .order('last_seen_at', { ascending: false });
```

**Cadencia del latido: NO ENCONTRADO.** El `POST` existe (`presencia/route.ts:29-66`) pero
**no encontré ningún `setInterval` ni hook que lo llame.** El comentario dice *"Cuesta un POST
por navegador abierto"*, pero el que dispara no está en el repo o no lo encontré.

| Dato | Valor |
|---|---|
| Endpoint | `/api/presencia` (POST = latido, GET = quién está) |
| Frecuencia del POST | **NO ENCONTRADO** |
| Ventana de "en línea" | **5 minutos** |
| Identificador | `email` como primary key |
| Exclusión de la propia sesión | `sesion_id` (máx. 80 chars) |
| Errores literales | 401 `Entra con el código de tu cliente.` · 503 `Supabase no configurado.` |

**Respuesta del GET:** `{ ventana_ms, presencia: [{ email, profile_id, last_seen_at, sesion_id }] }`

**Bug ya corregido, literal** (`presencia/route.ts:66-71`):
> *"No existía un GET: el panel de presencia leía la tabla con el cliente anónimo desde el
> navegador, y con el RLS cerrado devolvía `[]`. Es decir, la respuesta era 'nadie' y el panel
> lo pintaba como tal. Una lectura hecha por la persona equivocada no es una lectura: es un
> cero con aspecto de dato."*

---

## 6. Invitaciones (`rr_hub_invites`)

**Tabla** (`20260910_content_hub_isolated.sql:108-114`):
```sql
create table if not exists public.rr_hub_invites (
  email text not null,
  project_id uuid not null references public.rr_hub_projects(id) on delete cascade,
  role_in_project text not null check (role_in_project in ('owner','creator','camera','model','editor','publisher','media_buyer','client_approver','client_viewer')),
  created_at timestamptz not null default now(),
  primary key (email, project_id)
);
```

**RLS, literal** (`:116-118`):
```sql
alter table public.rr_hub_invites enable row level security;
create policy rr_hub_invites_admin on public.rr_hub_invites for all using (public.rr_hub_is_admin()) with check (public.rr_hub_is_admin());
```

**🔴 Flujo completo: NO ENCONTRADO.**
```
grep -rIn 'invite|invita' src/app/api/   → sin resultados
```
🔴 **No hay API de invitaciones.** No hay ruta para crear, listar, aceptar ni borrar una
invitación. La tabla existe con su RLS, pero **no hay código que la use**.

**Expiración: NO EXISTE.** No hay columna `expires_at`. Una invitación vive para siempre.

**Roles asignables:** los 9 del `check`. OJO: el `check` de la tabla es la **fuente** y
coincide con `RoleKey` de `flow.ts`. Aquí sí están los 9 correctos.

**Trigger de primer ingreso** (`20260910_content_hub_isolated.sql:120-122`):
```sql
create trigger rr_hub_auth_user_created after insert on auth.users
for each row execute procedure public.rr_hub_handle_new_user();
```
🔴 **Ese trigger está sobre `auth.users`, y el hub ya no usa Supabase Auth** (la puerta es un
código por cliente desde el 2026-09-28). **NO VERIFICADO** si sigue teniendo efecto: no lo
ejecuté.

`/audit/admin` **muestra** invitaciones pendientes (`audit/admin/page.tsx:49`), pero no las
crea: *"Nada de esto se puede modificar desde aquí."*

---

## 7. `/admin` y `/audit/admin`

### `/admin` — 11 líneas, no hace nada

**Archivo completo, literal** (`src/app/admin/page.tsx`):
```tsx
import { redirect } from 'next/navigation';
import { quienEs } from '@/lib/quien-es';

/** Los accesos viven en /audit/admin, que exige ser administrador. */
export default async function AdminPage() {
  const sesion = await quienEs();
  redirect(sesion?.proyecto ? `/${sesion.proyecto}` : '/login');
}
```

🔴 **`/admin` NO valida que seas admin. NO renderiza nada. Solo redirige.** Con sesión va a
`/{tu cliente}`; sin sesión va a `/login`.

### `/audit/admin` — 136 líneas, solo lectura

**Guard, literal** (`admin-guard.ts:42-57`):
```ts
export async function requireAdmin(): Promise<AdminVerdict> {
  const email = await currentEmail();
  if (!email) return { allowed: false, reason: 'no-session' };
  if (SUPER_ADMIN_EMAILS.includes(email)) return { allowed: true, via: 'super-admin-env', email };

  const supabase = await createClient();
  if (!supabase) return { allowed: false, reason: 'auth-disabled' };

  const { data, error } = await supabase
    .from('rr_hub_profiles')
    .select('global_role')
    .eq('email', email)
    .maybeSingle();

  if (error || !data) return { allowed: false, reason: 'not-admin' };
  if (data.global_role !== 'admin') return { allowed: false, reason: 'not-admin' };
  return { allowed: true, via: 'database', email };
}
```

**Puerta de salida** (`admin-guard.ts:22-30`): `SUPER_ADMIN_EMAILS` es una lista de correos
en variable de entorno. Comentario: *"which is exactly the state production is in right now
(all three access tables are empty, so a strict database-only check would lock everyone out
with no way back in but SQL). Configure it in Vercel, never in the repo."*

🔴 **El que NO es admin recibe 404, no 403** (`audit/admin/page.tsx:25`):
```ts
if (!admin.allowed) notFound();
```
Comentario: *"A page that tells an anonymous visitor 'you are logged in but not an admin' is
giving them a probe to test credentials with."*

**Secciones que muestra** (todas solo lectura):
| Sección | Eyebrow | Origen |
|---|---|---|
| Administradores globales | `[ADMINISTRADORES GLOBALES]` + `{n} CUENTAS` | `roster.profiles` con `global_role = 'admin'` |
| Equipo registrado | `[EQUIPO REGISTRADO]` | `getAuditRoster()` |
| Accesos por proyecto | — | `roster.access` |
| Invitaciones pendientes | — | `settings` |

**Aviso de ventana cerrada, literal** (`audit/admin/page.tsx:47-50`):
> `VENTANA DE AUDITORÍA CERRADA. Lo que ves abajo es una foto de la última vez que estuvo
> abierta: la hora de cada acceso puede no ser la de hoy.`

**Estados vacíos, literales:** `SIN ADMINISTRADORES VISIBLES.`

**🔴 ACCIONES DISPONIBLES: NINGUNA.** No hay un solo `<button>`, `<form>` ni acción de
escritura en las 136 líneas. Es un informe, no un panel de control. El texto lo dice:
*"Nada de esto se puede modificar desde aquí."*

---

## 8. Generador, biblioteca de anuncios, embed de Facebook Ads, portada de idea

### Generador de ideas (origen `asistente`)

**NO es una ruta web. Es un script de Python:**
`scripts/generar-ideas-wundeer.py`

**Cómo declara el origen** (`generar-ideas-wundeer.py:86-94`), literal:
```python
headers={
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json",
    "x-rr-origen": "asistente",
},
```

**Va directo a la Management API de Supabase**, no al hub. Comentario:
*"POST y no DELETE: la Management API responde 201 a un DELETE con cuerpo y no ejecuta nada.
Y un `201 []` no prueba que la consulta corrió, por eso `verificar()` vuelve a preguntar
después de escribir."*

🔴 **Usa un token de la Management API.** Leído de un archivo local (`TOKENS`). **[REDACTADO]**:
no lo imprimí. Está en `scripts/`, y ese directorio está en el repo.

**Verificado por script** (`scripts/verify-writes.mjs:142`):
```js
/["']x-rr-origen["']\s*:\s*["']asistente["']/.test(generador),
```

### Biblioteca de anuncios

**SÍ existe en la rama actual:** `src/lib/ad-library-server.ts`, leída por
`nueva/page.tsx:22-30`. Tabla `rr_hub_ad_library`.
Guard de escritura: el id del anuncio se valida contra el proyecto (`route.ts:1037`).

### Embed de Facebook Ads

**SÍ existe en la rama actual:** `src/components/reference-embed.tsx`,
`src/lib/embed-facebook-ads.test.ts`, `src/lib/embed-estado.test.ts`.
Commits relacionados en la rama actual: `ce44195` *Cada referencia dice su plataforma, y el
anuncio de Facebook trae imagen*, `3010526` *Facebook Ads deja de ser un marco en negro*.

### Portada de idea

🔴 **ESTÁ EN `main` Y EN LA RAMA ACTUAL.** `src/lib/idea-cover.ts` y
`src/lib/idea-cover.test.ts` existen en las dos:
```
git ls-tree --name-only main src/lib/ | grep -i cover
→ src/lib/idea-cover.test.ts
→ src/lib/idea-cover.ts
```
**CONTRADICCIÓN con lo que sugiere el nombre de la rama:** la rama `origin/feat/idea-portada`
existe y tiene commits propios (`756c31a` *Las tarjetas de idea muestran su portada*, `127a99a`
*Las portadas llegan de verdad a la tarjeta*), pero **la funcionalidad ya está en `main`**. La
rama quedó atrás.

**Estado de la rama actual vs `main`:** 8 commits por delante. `main` está en `2bd0f1d`
(*Se puede votar sin abrir la ficha*); el HEAD actual es `6b836c1`
(*Arregla el tablero vacio*).

⚠️ **El mensaje del último commit está pegado, literal:**
`6b836c1 Arregla el tablero vacio queCause mi ultimo cambio`

---

## 9. Modo local (`workspace-client.ts`)

🔴 **NO EXISTE UN MODO LOCAL EN `workspace-client.ts`.** El archivo es `'use client'` y
escribe siempre contra `/api/workspace` y las tablas `rr_hub_*`.

Comentario de cabecera, literal (`workspace-client.ts:1-9`):
> *"Client-side workspace operations backed by Supabase. Every write goes to the `rr_hub_*`
> tables (never the legacy CRM tables) and relies on RLS for authorization. When Supabase env
> vars are absent these helpers report that state so the UI can explain itself instead of
> pretending to persist anything."*

**Lo que SÍ existe es el modo demo, y es otro archivo:** `src/lib/demo-mode.ts`, literal:
```ts
export const DEMO_MODE = process.env.NEXT_PUBLIC_HUB_DEMO === 'true';
```

**Se activa solo con `NEXT_PUBLIC_HUB_DEMO=true`**, y es un interruptor deliberado
(`demo-mode.ts:1-12`):
> *"The demo fixtures are a development convenience, never a production fallback. [...]
> In production that meant: if a single `NEXT_PUBLIC_*` var were renamed or dropped, the hub
> would not fail — it would serve Wundeer's roadmap backed by invented August-2026 ideas, and
> hand the caller an `admin` role. A silent wrong answer is worse than a loud one."*

**Qué NO se comparte en modo demo:** los fixtures (`demoIdeas`, `demoProjects`) son **ficticios
y no se suben a la base**. `SupabaseNotConfiguredError` lanza con el mensaje:
> `Supabase no está configurado. Define NEXT_PUBLIC_SUPABASE_URL y
> NEXT_PUBLIC_SUPABASE_ANON_KEY, o pon NEXT_PUBLIC_HUB_DEMO=true para trabajar con datos
> ficticios.`

Único consumidor: `src/lib/data.ts:5`.

---

## Tabla de cierre

| Dato pedido | Estado | Fuente |
|---|---|---|
| 1. Cómo se archiva | **ENCONTRADO** — acción `borrar`, solo `owner`, 2 estados | `route.ts:723-766`, `flow.ts:70`, `79-81` |
| 1. Cómo se restaura | **NO ENCONTRADO** | sin acción de restore en `src/` |
| 1. Dónde se ven las archivadas | **NO ENCONTRADO** | sin vista ni filtro |
| 2. Métricas de `/metricas` | **ENCONTRADO — solo 3 contadores y top 5** | `metricas/page.tsx:13-24` |
| 2. Rendimiento real | **ENCONTRADO — NO EXISTE** | `metricas/page.tsx:32`, `60-62` |
| 2. Filtros | **ENCONTRADO — ninguno** | `metricas/page.tsx` |
| 3. Roadmap | **ENCONTRADO — literal en código, 8 pilares** | `roadmap.ts`, `ROADMAP_START_ISO:71` |
| 3. Quién lo edita | **ENCONTRADO — NADIE, es código** | sin API ni BD |
| 4. Campos editables de `/perfil` | **ENCONTRADO — NINGUNO** | `perfil/page.tsx` sin `<form>` |
| 4. Roles de `/perfil` | **ENCONTRADO — CONTRADICCIÓN: 2 no existen** | `perfil/page.tsx:6-15` vs `flow.ts` |
| 5. Ventana de presencia | **ENCONTRADO — 5 min, no 15** | `presencia/route.ts:22` vs `20260928...sql:53` |
| 5. Cada cuánto se actualiza | **NO ENCONTRADO** | sin `setInterval` en el repo |
| 6. Flujo de invitaciones | **NO ENCONTRADO — no hay API** | `grep -rIn 'invite' src/app/api/` vacío |
| 6. Expiración de invitación | **ENCONTRADO — NO EXISTE** | `20260910...sql:108-114` |
| 7. `/admin` | **ENCONTRADO — solo redirige, no valida** | `admin/page.tsx` completo |
| 7. `/audit/admin` | **ENCONTRADO — solo lectura, 0 acciones** | `audit/admin/page.tsx:1-136` |
| 7. Validación de admin | **ENCONTRADO — `requireAdmin`, 404 si no** | `admin-guard.ts:42-57`, `audit/admin:25` |
| 8. Generador | **ENCONTRADO — script Python, cabecera `x-rr-origen`** | `scripts/generar-ideas-wundeer.py:86-94` |
| 8. Biblioteca de anuncios | **ENCONTRADO** | `ad-library-server.ts`, `route.ts:1037` |
| 8. Embed Facebook Ads | **ENCONTRADO** | `reference-embed.tsx` |
| 8. Portada de idea | **ENCONTRADO — YA ESTÁ EN `main`** | `git ls-tree main src/lib/ \| grep cover` |
| 9. Modo local en `workspace-client.ts` | **ENCONTRADO — NO EXISTE** | `workspace-client.ts:1-23` |
| 9. Modo demo real | **ENCONTRADO — `NEXT_PUBLIC_HUB_DEMO=true`** | `demo-mode.ts:14` |

**CONTRADICCIONES detectadas (4):**
1. `rr_hub_presencia`: el comentario de la tabla dice *"mas de 15 minutos se considera cerrada"* (`20260928_hub_login_presencia.sql:53`) y el código usa **5** (`presencia/route.ts:22`).
2. `/perfil` usa los roles `creative` y `client_editor`, que **no existen** en `RoleKey`, y omite `creator`, `model` y `publisher` (`perfil/page.tsx:6-15`). Consecuencia: un `creator` real ve *"Todavía no tienes un rol asignado"*.
3. La migración de archivadas dice en su comentario *"Si el borrado fue un error, se desarchiva"*, pero **no hay acción de desarchivar** en el código.
4. La rama `feat/idea-portada` sugiere que la portada está pendiente, pero `idea-cover.ts` **ya está en `main`**.

---
*BLOQUE 4 COMPLETO. Archivo: `docs/qa-insumos/BLOQUE_04_funciones-sin-documentar.md`*
