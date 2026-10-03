# BLOQUE 07 — Datos de prueba y entorno

> Fuente: lectura literal en la rama `pausa-visible`, commit `6b836c1` (2026-10-01).
> Archivos: `src/lib/demo-data.ts`, `src/lib/demo-mode.ts`, `src/lib/projects.ts`,
> `.env.example`, `.env.local`, `.github/workflows/ci.yml`, `playwright.config.ts`,
> `e2e/*`, `supabase/migrations/20260927_hub_seed_roster.sql`, `scripts/*`.

🔴 **Ningún valor de clave se imprime en este bloque.** Solo nombres de variable y, cuando
hace falta, la URL pública del proyecto (que va en el bundle del navegador por definición).
**[REDACTED]** en todas las claves, tokens y códigos de 4 dígitos.

---

## a) Seeds y datos demo

### `demo-data.ts` — 61 líneas, solo con `NEXT_PUBLIC_HUB_DEMO=true`

**Los 3 proyectos demo, literales** (`demo-data.ts:40-44`):
```ts
export const demoProjects = [
  { id: 'wundeer', name: 'WUNDEER', client_name: 'Wuundeer · Moda', slug: 'wundeer', brand_primary_color: '#be076d', description: 'Contenido orgánico y pauta para la operación crítica de moda.' },
  { id: 'satiro', name: 'SÁTIRO', client_name: 'Sátiro Sushi · Gastronomía', slug: 'satiro', brand_primary_color: '#ded116', description: 'Plataforma gastronómica, contenido y conversión local.' },
  { id: 'boga', name: 'BOGA', client_name: 'BOGA · Marca', slug: 'boga', brand_primary_color: '#973d8f', description: 'Branding, comunicación y contenido de marca.' },
];
```

**Los 9 estados del tipo `Status` demo** (`demo-data.ts:1`):
```ts
export type Status = 'draft' | 'pending_approval' | 'approved' | 'in_production' | 'editing' | 'ready_to_publish' | 'published' | 'needs_changes';
```

🔴 **CONTRADICCIÓN MAYOR: el tipo `Status` del demo tiene 8 estados, y `flow.ts` tiene 15.**
Faltan en el demo: `internal_review`, `voting`, `script_in_progress`, `pending_script_review`,
`script_approved`, `raw_uploaded`, `closed`. El demo no puede representar una idea en votación,
ni en guion, ni descartada.

**Las ideas demo:** 61 líneas, todas con `creator: 'Manuel'` y fechas de agosto 2026. Las 8
primeras van de `O1` a `O8`, todas `content_type: 'organic'`, todas con `reference_url` de
Instagram.

**2 campos que se agregaron después, con su historia** (`demo-data.ts:13-30`):
- `due_at?: string | null` — *"MEDIDO 2026-10-01: la fecha de salida se guardaba, llegaba al
  servidor y se perdía antes de la pantalla."*
- `ad_id?: string | null` — *"`rr_hub_ideas.ad_id` existe desde siempre y el alta la llena
  (`api/workspace/[action]/route.ts:1088`), pero `getIdea` no la pedía."*

**Cómo se activa, literal** (`demo-mode.ts:14`):
```ts
export const DEMO_MODE = process.env.NEXT_PUBLIC_HUB_DEMO === 'true';
```
**Único consumidor:** `src/lib/data.ts:5`.

### 🔴 `demo-data.ts` y el código real NO hablan de los mismos clientes

| Cliente | `demo-data.ts` | `CLIENTES_CONOCIDOS` (`projects.ts:24`) | Seed `20260927` |
|---|---|---|---|
| `wundeer` | sí | **sí** | sí |
| `satiro` | **sí** | **NO** | sí |
| `boga` | **sí** | **NO** | sí |
| `candilejas` | **NO** | **sí** | **NO** |

**CONTRADICCIÓN en dos direcciones:**
1. El modo demo ofrece `satiro` y `boga`, que `isVisibleProject()` rechaza
2. El cliente que sí está en el código (`candilejas`) **no aparece en el seed del roster**: no
   hay ni un solo `insert into rr_hub_access` con `'candilejas'`. Existe en la base (medido el
   2026-10-01, 2 ideas y voting activo) pero **no hay script versionado que lo cree**

### El seed real: `20260927_hub_seed_roster.sql`

**16 personas** (`seed_roster.sql:24-40`), con `global_role`:

| Correo | Nombre | `global_role` |
|---|---|---|
| `santiago1209andres@gmail.com` | Andrés Santiago Rosas Rios | `admin` |
| `andreshadechine.rraliados@gmail.com` | Andrés Felipe Hadechine Licona | `admin` |
| `juanpos1234@gmail.com` | Juan Manuel Mesa Posada | `admin` |
| `rraliadosteam@gmail.com` | RR Aliados | `admin` |
| `samugarc6@gmail.com` | Samuel Garcia Castaño | `member` |
| `Tefaweb000@gmail.com` | Sthefany Diaz | `member` |
| `somewherelek@gmail.com` | Samuel Zuluaga Morales | `member` |
| `jmespitiag@gmail.com` | Juan Martín Espitia González | `member` |
| `jimenez.ochoa.samuel@gmail.com` | Samuel Jiménez Ochoa | `member` |
| `carlosbeltranpardo@gmail.com` | Carlos Beltrán pardo | `member` |
| `benitezestiven122@gmail.com` | Estiven Serna Benítez | `member` |
| `santiagomedinalopez@gmail.com` | Santiago Medina Lopez | `member` |
| `juliandvr24@gmail.com` | Julian David Velasquez Rodriguez | `member` |
| `juansebastianv19@gmail.com` | Juan Sebastian Vargas Cruz | `member` |
| `metriklabopt@gmail.com` | Alejandra Suarez | `member` |
| `maria2002morales@gmail.com` | María Isabel Morales Vargas | `member` |

🔴 **Las 4 filas `admin` son la cuenta compartida `rraliadosteam@gmail.com` más 3 personas.**
Comentario del archivo: *"Los tres directivos quedan como admin."*

**Roles por proyecto, 39 filas** (`seed_roster.sql:59-97`):

| Cliente | `owner` | `creator` | `editor` | `camera` | `media_buyer` | `client_viewer` |
|---|---|---|---|---|---|---|
| `wundeer` | 4 | 3 | 5 | 2 | 1 | 1 |
| `satiro` | 4 | 0 | 0 | 0 | 0 | 6 |
| `boga` | 4 | 0 | 0 | 0 | 0 | 6 |
| `candilejas` | **0** | **0** | **0** | **0** | **0** | **0** |

🔴 **Ningún `client_approver` en ninguna fila.** El rol existe en `RoleKey`, en las
transiciones y en el `check` de `rr_hub_invites`, pero **no hay ni una sola persona con ese rol
en el seed**. Sin `client_approver` nadie puede aprobar nada: las transiciones de
`pending_approval` y `pending_script_review` solo las puede hacer ese rol o `owner`.

🔴 **`satiro` y `boga` no tienen `candilejas` en la lista, y `candilejas` no tiene a nadie.**
Comentario del seed (`:70-71`): *"SATIRO y BOGA: el mismo equipo, solo lectura hasta que haya
piezas. Owner para que la dirección pueda preparar el tablero sin pedir SQL."*

**Definición de cada rol, literal** (`seed_roster.sql:50-57`):
```
owner         → dirección: puede desbloquear cualquier estado
creator       → quien propone ideas y escribe el guion
camera        → camarógrafo/modelo: avanza desde guion aprobado
editor        → edición: crudo, montaje, corte
media_buyer   → pauta: publication
client_viewer → solo lectura
```

**Es idempotente** (`:11-12`): *"se puede volver a aplicar sin duplicar nada"*.

🔴 **El seed depende de `auth.users`, que el hub ya no usa.** Las dos consultas hacen
`join auth.users u on lower(u.email) = lower(v.email)`. El hub entró por código el 2026-09-28
y ya no hay sesión de Supabase Auth. **`NO VERIFICADO` si el seed seguiría funcionando hoy**:
no lo ejecuté (auditoría de solo lectura).

**No hay `supabase/seed*.sql` en el repo.** El roster vive en `migrations/`, no en una carpeta
`seed`.

---

## b) Variables de entorno

**Lista completa de las que el código lee** (comando: `grep -rhoE 'process\.env\.[A-Z_0-9]+' src/ scripts/ e2e/`), **30 variables**:

| Variable | Dónde | Para qué |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `src/lib/supabase/*` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | idem | clave pública del navegador |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `subir/route.ts:93`, `workspace:92` | **requisito fantasma** en workspace |
| `SUPABASE_URL` | `verify-leak.mjs:24` | fallback de la URL |
| `SUPABASE_ANON_KEY` | `verify-leak.mjs:25` | clave para las sondas |
| `SUPABASE_SERVICE_ROLE_KEY` | `workspace:94`, `ideas:21` | escribe, salta RLS |
| `RR_HUB_AUTOMATION_TOKEN` | `ideas:23` | **única ruta**, el `x-api-key` |
| `HUB_SECRET` | `hub-session.ts:81` | **firma HMAC de la cookie** |
| `SUPER_ADMIN_EMAILS` | `admin-guard.ts:23`, `route.ts:45` | lista de emails con `owner` |
| `NEXT_PUBLIC_STORAGE_BUCKET` | `workspace-client.ts:23` | bucket (default `rr-content-assets`) |
| `NEXT_PUBLIC_HUB_DEMO` | `demo-mode.ts:14` | activa fixtures demo |
| `NODE_ENV` | `entrar:207` | decide `secure` de la cookie |
| `HUB_E2E_PORT` | `playwright.config.ts:28` | puerto de los e2e (default 3100) |
| `HUB_E2E_STATE` | `puerta.ts:30` | `storageState` exportado |
| `HUB_E2E_STATE_CANDILEJAS` | e2e | estado de otro cliente |
| `HUB_E2E_CODIGO` | `puerta.ts:30` | código del cliente para entrar |
| `HUB_E2E_CORREO` | `puerta.ts:31` | correo con acceso |
| `HUB_E2E_NOMBRE` | `puerta.ts:32` | nombre de esa persona |
| `HUB_E2E_AUTH` | `biblioteca-anuncios.spec.ts:57` | habilita 2 tests de escritura |
| `HUB_E2E_VOTAR` | `votacion-interna.spec.ts:53` | habilita el test que ESCRIBE votos |
| `HUB_E2E_NOADMIN_STATE` | `hub.spec.ts:328` | sesión de un no-admin |
| `HUB_BASE_URL` | `playwright.config.ts:38` | corre contra un build desplegado |
| `HUB_VOTANTE_A/B/C` | scripts de medición | 3 votantes para medir quórum |
| `CM_SUPABASE_URL` / `CM_SUPABASE_SERVICE_KEY` | scripts | otro proyecto Supabase |
| `DASHWEB_API_URL` / `_BOT_EMAIL` / `_BOT_PASSWORD` / `_BOT_TOKEN` | scripts | CRM DashWeb |
| `FICHA_PROD` | scripts | ficha de producción |
| `RR_COBRANZA_JSON` | scripts | datos de cobranza |
| `RR_TALENTO_CANONICO` | scripts | talento canónico |
| `HOME` | scripts | del sistema |

### 🔴 `.env.example` está 20 días desactualizado

**Fecha del archivo: 11 de septiembre.** La puerta cambió el 28-sep.

**Lo que declara `.env.example` (13 vars):**
| Variable | ¿Existe en el código? |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | sí |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | sí |
| `SUPABASE_SERVICE_ROLE_KEY` | sí |
| `NEXT_PUBLIC_SITE_URL` | **NO** — no aparece en el grep |
| `NEXT_PUBLIC_AUTH_ENABLED` | 🔴 **NO EXISTE** |
| `NEXT_PUBLIC_STORAGE_BUCKET` | sí |
| `INSTAGRAM_APP_ID` / `_SECRET` / `_ACCESS_TOKEN` | **NO** — "Fase 4" |
| `RESEND_API_KEY` | **NO** — "Fase 2" |
| `TWILIO_ACCOUNT_SID` / `_AUTH_TOKEN` / `_WHATSAPP_FROM` | **NO** — "Fase 2" |

**Lo que FALTA y es crítico:**

| Variable ausente | Por qué es crítica |
|---|---|
| 🔴 **`HUB_SECRET`** | **la app NO ARRANCA sin ella.** Es la que firma la cookie |
| 🔴 **`SUPER_ADMIN_EMAILS`** | sin ella y con `rr_hub_access` vacía, nadie puede ser admin |
| 🔴 **`RR_HUB_AUTOMATION_TOKEN`** | sin ella `/api/ideas` devuelve 503 |
| `NEXT_PUBLIC_HUB_DEMO` | sin ella no hay modo demo |
| Las 12 `HUB_E2E_*` y `HUB_BASE_URL` | sin ellas los e2e se saltan |

**El comentario de `.env.example` es PELIGROSO, literal:**
> `# Public mode is the default: unset or anything other than 'true' keeps the hub open
> (browse-only, no credentials). Set to 'true' to restore the Google gate.`

🔴 **Eso describe un mundo que ya no existe.** Dice que el hub está abierto por defecto y que
Google es la alternativa. Hoy: la puerta es un código de 4 dígitos, siempre encendida, y Google
no se usa. Quien clone el repo y siga ese comentario creerá que el hub es público.

### `.env.local` — 5 variables, ninguna de las críticas

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SITE_URL=
NEXT_PUBLIC_STORAGE_BUCKET=
NEXT_PUBLIC_AUTH_ENABLED=
```

🔴 **Faltan las 3 que importan:** `SUPABASE_SERVICE_ROLE_KEY`, `HUB_SECRET` y
`SUPER_ADMIN_EMAILS`. Por eso el dev server devuelve 500 en cualquier ruta con el cliente
`service` — lo dice `playwright.config.ts:40-43`.

---

## c) ¿Existe entorno de preview o base separada?

🔴 **NO HAY `vercel.json`.** Comando: `cat vercel.json` → no existe.

🔴 **NO HAY BASE DE DATOS DE PRUEBAS SEPARADA.** Una sola URL de Supabase para todo.

**Lo que dice `playwright.config.ts` de correr contra local, literal** (`:38-43`):
> *"`HUB_BASE_URL` corre los recorridos contra un build ya desplegado en vez del dev server [...]
> Importa porque el dev server corre sin `SUPABASE_SERVICE_ROLE_KEY`: cualquier ruta que use el
> cliente `service` devuelve 500 ahí y pasa en local."*

**Es decir: la separación es de PROCESO, no de datos.** El dev server y producción apuntan a
la misma base.

**`playwright.config.ts:10-20`, el confessionario, literal:**
> *"Lo que este archivo afirmaba antes, y era falso: 'siempre de lectura, no escriben en la base
> real'. Dos recorridos pulsaban VOTO A FAVOR y GUARDAR sobre piezas reales; con el hub apuntando
> a producción, cada `npx playwright test` movía el estado de una pieza de Wundeer."*

🔴 **Y el problema inverso, medido** (`:22-27`):
> *"al encender la autenticación, las páginas del hub pasaron a pedir sesión y los recorridos se
> ejecutaron sin notion de ella. 38 de 42 dejaron de informar: la puerta redirigía a /login y el
> selector nunca aparecía. Un rojo que dice 'el producto está roto' cuando en realidad dice 'el
> test no sabe entrar' es peor que no tener la prueba."*

**La política actual, literal** (`:29-32`):
> *"· Sin sesión, lo que necesita sesión se SALTA con el motivo escrito. Verde, pero sin mentir
> sobre qué se probó. · Con `HUB_E2E_STATE` apuntando a un storageState exportado por una
> persona con acceso, corre entero. `storageState` nunca se pone por defecto: un archivo de
> sesión en el repo es una sesión de producción versionada."*

**`.github/workflows/ci.yml`** — 5 pasos, todos con valores de mentira (`:13-18`):
```yaml
env:
  NEXT_PUBLIC_SUPABASE_URL: https://placeholder.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY: placeholder-anon-key
```
Comentario: *"el build no debe tocar datos reales en CI. Con esto el cliente de Supabase se
construye y las páginas que consultan datos caen a su estado vacío en vez de tumbar el job."*

🔴 **CI NO corre los e2e.** Solo: `tsc --noEmit`, `npm test`, `npm run verify`, `npm run lint`,
`npm run build`. Los 11 archivos de `e2e/` **no están en CI**.

🔴 **CI tampoco corre `verify:leak`** (ya reportado en bloque 6).

**Motivo del CI, literal** (`ci.yml:4-6`):
> *"Por qué existe: el commit 08b7cd9 se pusheó con JSX roto y dejó CUATRO deploys de producción
> en ERROR sin que nadie lo notara."*

---

## d) Cómo se crea un usuario de prueba para cada uno de los 9 roles

🔴 **NO HAY INTERFAZ PARA CREAR USUARIOS.** Ni alta, ni registro, ni API. Cero.

**El camino real es SQL manual**, y son 3 pasos:

**Paso 1 — el perfil** (`seed_roster.sql:24-46`):
```sql
insert into public.rr_hub_profiles (id, full_name, email, global_role)
select u.id, v.full_name, v.email, ...
from (values ('correo', 'Nombre', true)) as v(email, full_name, admin)
join auth.users u on lower(u.email) = lower(v.email)
```
🔴 **Requiere que el correo YA exista en `auth.users`.** Sin fila ahí, el `join` no devuelve
nada y el perfil no se crea. El seed lo avisa (`:16-17`): *"Los correos que no tenían cuenta en
`auth.users` se crearon aparte, sin contraseña y con `email_confirmed_at` puesto."*

**Paso 2 — el acceso al proyecto** (`seed_roster.sql:58-100`):
```sql
insert into public.rr_hub_access (user_id, project_id, role_in_project)
select u.id, p.id, v.role
from (values ('correo', 'slug', 'rol')) as v(email, project_slug, role)
join auth.users u on lower(u.email) = lower(v.email)
join public.rr_hub_projects p on p.slug = v.project_slug
on conflict (user_id, project_id) do update ...
```

**Paso 3 — `is_team_member` e `is_active`.** 🔴 **NO ESTÁN EN EL SEED.** Se insertan con su
default. `rr_hub_puede_entrar` exige `p.is_team_member AND p.is_active` para dejar entrar, y
`route.ts:483-488` para dejar votar. **`NO ENCONTRADO`** dónde se ponen en `true` por código.

**Los 9 roles y su fórmula, según `flow.ts`:**

| Rol | Para probarlo hace falta | Transiciones que desbloquea |
|---|---|---|
| `owner` | fila en `rr_hub_access` con `owner` | **TODAS**, en cualquier estado (bocallave) |
| `creator` | `creator` en `rr_hub_access` | `draft→internal_review`, guion, `needs_changes→pending_approval` |
| `camera` | `camera` | `script_approved→in_production`, `in_production→raw_uploaded` |
| `model` | `model` | idénticas a `camera` |
| `editor` | `editor` | `script_in_progress→pending_script_review`, `raw_uploaded→editing`, `editing→ready_to_publish` |
| `publisher` | `publisher` | `ready_to_publish→published`, `published→closed` |
| `media_buyer` | `media_buyer` | `internal_review→voting/pending_approval`, `ready_to_publish→published` |
| `client_approver` | `client_approver` | `pending_approval→approved/needs_changes/closed`, `pending_script_review→script_approved` |
| `client_viewer` | `client_viewer` | **ninguna** (solo mira) |

🔴 **Para `owner` no hace falta fila en `rr_hub_access`:** `route.ts:149` y `1006` dan `owner`
a cualquier correo de `SUPER_ADMIN_EMAILS`. Y `admin-guard.ts:47` lo acepta igual. Es la puerta
de salida documentada.

**Alternativa sin SQL: el seed es idempotente.** Se edita el `values` del seed con el correo
nuevo, se aplica por la Management API y queda.

**Para crear la sesión de e2e, sin tocar la base** (`puerta.ts:44-46`):
```
HUB_E2E_CODIGO=<4 dígitos> HUB_E2E_CORREO=<correo> HUB_E2E_NOMBRE="<Nombre>" npx playwright test
node scripts/exportar-estado-e2e.mjs > /tmp/hub-state.json
HUB_E2E_STATE=/tmp/hub-state.json npx playwright test
```
🔴 **`HUB_E2E_CODIGO` es el código real del cliente.** **[REDACTED]** — no se reproduce aquí.
Su valor vive solo en el entorno de quien corre los tests.

---

## e) Cómo se limpian los datos de prueba

**SÍ hay scripts. NO hay base separada: se borra de la real.**

| Script | Qué borra |
|---|---|
| `scripts/borrar-idea-prueba.py` | filas de una idea de prueba |
| `scripts/borrar-huerfanos.py` | (no inspeccionado en detalle) |

**`borrar-idea-prueba.py`, el docstring completo, literal:**
> *"Lo invoca el e2e `la página de creación se abre y el botón responde`, que SÍ crea una pieza
> real en producción. Sin esta limpieza, cada corrida deja una fila más y el contador del tablero
> miente: 26 piezas pasaron a 27 sin que nadie lo hiciera. [...] El SQL llega en un archivo y el
> token por argumento, nunca por línea de comandos: así lo que se ejecuta se puede leer antes
> de correrlo, y el token no queda en el historial del shell."*

🔴 **El borrado es FÍSICO, no lógico.** A diferencia de archivar ideas (que marca
`archived_at`), aquí hay un `DELETE`. Y `rr_hub_ideas` tiene `on delete cascade` a eventos,
comentarios, votos y assets (`20260910_content_hub_isolated.sql:59`, `69`, `79`).

🔴 **Uso:** `borrar-idea-prueba.py <archivo.sql> <access_token>`
**Devuelve 0 si limpió, 1 si algo quedó.** El e2e trata el fallo como fallo de prueba:
*"es preferible una suite roja a una base de clientes con filas de prueba"*.

**Las trampas de la API, literales** (`:12-14`):
> *"1. Ejecuta el SQL con POST. Con DELETE y cuerpo responde 201 y no borra nada. 2. Responde 201
> con `[]` tanto si borró como si no. Un `[]` no significa 'no había nada': significa 'no te lo
> digo'. Por eso el borrado se comprueba con un SELECT, y no con la respuesta del DELETE."*

🔴 **`[REDACTED]`**: el `PROYECTO = "ntgtvtzbjwotuwkiflar"` está hardcodeado en el script
(`:29`). Es la URL pública del proyecto, pero **está en el repo** y así sigue.

**🔴 Los votos que escriben los e2e NO se limpian.** `votacion-interna.spec.ts:51-55`:
```ts
test('votar de verdad: solo con HUB_E2E_VOTAR=1', async ({ page }) => {
  test.skip(!process.env.HUB_E2E_VOTAR,
    'ESCRIBE en rr_hub_votes y puede mover la pieza de estado. Pásale HUB_E2E_VOTAR=1 si lo quieres.',
```
Es el único `skip` con `HUB_E2E_VOTAR`. **`NO ENCONTRADO`** script que borre esos votos.

---

## f) Los 3 proyectos: configuración propia

🔴 **NINGÚN PROYECTO TIENE CONFIGURACIÓN PROPIA.** Ni campos, ni roles, ni flujos propios.

**Lo único que existe por proyecto:**
1. La fila en `rr_hub_projects` (slug, nombre, `brand_primary_color`, `access_code`)
2. Las filas en `rr_hub_access` que dicen quién entra con qué rol
3. Las ideas, que son datos

**El flujo es UNO solo para todos.** `flow.ts` no lee el proyecto en ningún punto: las 15
fases, las 18 aristas y `allowedTransitions()` son globales.

**`CLIENTES_CONOCIDOS`, literal** (`projects.ts:24`):
```ts
export const CLIENTES_CONOCIDOS = ['wundeer', 'candilejas'] as const;
```

🔴 **`CLIENTES_CONOCIDOS` tiene 2, y el seed tiene 3 + 1 en la base.** `satiro` y `boga` están
en la base de datos y en el seed, pero `isVisibleProject('satiro')` devuelve `false`. **`/satiro`
da 400 o 404**, y `/api/ideas?project=satiro` devuelve 400 `Ese cliente no existe.`

**¿Qué se ve según la sesión?** (`projects.ts:36-39`, literal):
> *"La respuesta sale de la cookie, nunca de la URL. `/candilejas` con una cookie de Wundeer da
> 404 a propósito: no es un descuido de rutas, es que el código de Candilejas es otro — y esa es
> la forma de decirlo sin explicarlo."*

| Tabla del bloque | Respuesta medida |
|---|---|
| ¿Configuración por proyecto? | **NO EXISTE** |
| ¿Flujo distinto por proyecto? | **NO — uno global** |
| ¿Campos extra por proyecto? | **NO** |
| ¿Roles por proyecto? | **SÍ — en `rr_hub_access`**, pero el conjunto de roles posibles es el mismo |
| `satiro` y `boga` accesibles por la UI | **NO** — no están en `CLIENTES_CONOCIDOS` |
| `candilejas` con filas en el seed | **NO** |

---

## Tabla de cierre

| Dato pedido | Estado | Fuente |
|---|---|---|
| a) Usuarios del seed | **ENCONTRADO — 16 personas, 4 admin** | `seed_roster.sql:24-40` |
| a) Roles del seed | **ENCONTRADO — 39 filas en 3 proyectos** | `seed_roster.sql:58-97` |
| a) Ideas demo | **ENCONTRADO — 8 ideas de agosto 2026** | `demo-data.ts:46-61` |
| a) Cómo se activa el demo | **ENCONTRADO — `NEXT_PUBLIC_HUB_DEMO=true`** | `demo-mode.ts:14` |
| b) Variables de entorno | **ENCONTRADO — 30 en el código** | grep de `process.env` |
| b) Faltan en `.env.example` | **ENCONTRADO — 3 críticas + 13 de e2e** | tabla b |
| c) `vercel.json` | **NO EXISTE** | `cat vercel.json` |
| c) Base de pruebas separada | **NO EXISTE** | una sola URL |
| c) e2e en CI | **NO CORREN** | `ci.yml` tiene 5 pasos, ninguno e2e |
| d) Crear usuario por rol | **ENCONTRADO — solo SQL manual, 3 pasos** | `seed_roster.sql` |
| d) Interfaz de alta de usuarios | **NO EXISTE** | sin API ni página |
| e) Script de limpieza | **ENCONTRADO — `borrar-idea-prueba.py`** | `scripts/borrar-idea-prueba.py` |
| e) ¿Borrado físico o lógico? | **ENCONTRADO — FÍSICO, con cascade** | script + `20260910...sql:59` |
| e) Limpieza de votos de e2e | **NO ENCONTRADO** | `votacion-interna.spec.ts:51-55` |
| f) Config por proyecto | **ENCONTRADO — NO EXISTE** | `flow.ts` es global |
| f) Los 3 proyectos | **ENCONTRADO — con contradicción en la lista** | `projects.ts:24` vs seed |

**CONTRADICCIONES detectadas (5):**
1. `demo-data.ts` ofrece `satiro` y `boga`; `CLIENTES_CONOCIDOS` solo tiene `wundeer` y `candilejas`. El modo demo enseña clientes que la app rechaza.
2. `candilejas` **no tiene una sola fila en el seed del roster**. Existe en la base (medido el 2026-10-01) pero no hay script versionado que lo cree.
3. El tipo `Status` del demo tiene **8 estados**; `flow.ts` tiene 15. El demo no puede representar una idea en voting, en guion ni descartada.
4. `.env.example` documenta un modo público con Google que **ya no existe**, y **omite `HUB_SECRET`**, sin la cual la app no arranca.
5. `demo-data.ts` tiene los tipos de `Idea` con `creator: 'Manuel'` fijo y fechas fijas: no es parametrizable.

---
*BLOQUE 7 COMPLETO. Archivo: `docs/qa-insumos/BLOQUE_07_datos-y-entorno.md`*
