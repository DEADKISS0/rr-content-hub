# BLOQUE 05 — API completa

> Fuente: lectura literal en la rama `pausa-visible`, commit `6b836c1` (2026-10-01).
> Comando: `find src/app/api -name route.ts` → **9 rutas**, 1.960 líneas en total.
> Todas con `export const dynamic = 'force-dynamic'`.

## Índice de las 9 rutas

| # | Ruta | Archivo | Líneas | Métodos | Auth |
|---|---|---|---|---|---|
| 1 | `/api/entrar` | `entrar/route.ts` | 215 | POST, DELETE | **ninguna** (es la puerta) |
| 2 | `/api/cambiar-cliente` | `cambiar-cliente/route.ts` | 157 | POST | cookie firmada |
| 3 | `/api/quien-soy` | `quien-soy/route.ts` | 46 | GET | cookie firmada |
| 4 | `/api/workspace/[action]` | `workspace/[action]/route.ts` | **1103** | POST | cookie firmada |
| 5 | `/api/workspace/pieza` | `workspace/pieza/route.ts` | 51 | GET | cookie firmada |
| 6 | `/api/ideas` | `ideas/route.ts` | 176 | GET, POST | **`x-api-key`** |
| 7 | `/api/subir` | `subir/route.ts` | 162 | POST | cookie firmada |
| 8 | `/api/archivo` | `archivo/route.ts` | 65 | GET | cookie firmada |
| 9 | `/api/presencia` | `presencia/route.ts` | 95 | GET, POST | cookie firmada |

🔴 **Solo 2 de 9 no usan la cookie.** `/api/entrar` es la puerta y `/api/ideas` usa
`x-api-key` con `timingSafeEqual`.

---

## 1. `/api/entrar` — la puerta, 2 pasos

**Firma de `POST`** (`entrar/route.ts:79`): `(request: Request)`. Body:
`{ codigo?: string; correo?: string; nombre?: string }`

### Paso 1 — `POST {codigo}` sin `correo`

Solo mira, no entra. Devuelve el cliente y la lista de personas con acceso.

```ts
const { data: personas, error: errorPersonas } = await service.rpc('rr_hub_equipo_del_cliente', {
  p_codigo: codigo,
});
```
(`entrar/route.ts:148-152`)

**Respuesta 200** (`entrar/route.ts:158-165`):
```ts
{
  cliente: { slug: proyecto.slug, nombre: proyecto.name },
  personas: [{ nombre, correo }, ...],
}
```

🔴 **Este paso devuelve la lista de correos con acceso de ese cliente.** El comentario lo
justifica (`entrar/route.ts:23-26`): *"sin código no se llega aquí"*. Pero cualquiera con el
código de un cliente obtiene la lista completa de correos de su equipo.

### Paso 2 — `POST {codigo, correo, nombre}`

```ts
const { data: puede, error: errorPuerta } = await service.rpc('rr_hub_puede_entrar', {
  p_codigo: codigo,
  p_email: correo,
});
```
(`entrar/route.ts:174-177`)

**El nombre se ignora y se vuelve a pedir a la base** (`entrar/route.ts:189-196`):
```ts
const { data: real } = await service
  .from('rr_hub_profiles')
  .select('full_name')
  .ilike('email', correo)
  .maybeSingle();
const nombre = real?.full_name ?? String(cuerpo.nombre ?? '');
```
Comentario: *"Si alguien teclea un nombre que no es el suyo, entra con el de verdad, y la ficha
dice la verdad."*

**Cookie emitida** (`entrar/route.ts:203-210`), literal:
```ts
respuesta.cookies.set(NOMBRE_COOKIE, valor, {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge,
});
```

### `DELETE` — salir

```ts
export async function DELETE() {
  const respuesta = NextResponse.json({ ok: true });
  respuesta.cookies.set(NOMBRE_COOKIE, '', { path: '/', maxAge: 0 });
  return respuesta;
}
```
(`entrar/route.ts:211-215`)

### 🔴 Rate limit — SÍ existe, medido 2026-10-01

`src/lib/rate-limit.ts` + `entrar/route.ts:48-100`.

| Parámetro | Valor | Fuente |
|---|---|---|
| Intentos permitidos | **`INTENTOS_MAXIMOS = 8`** | `rate-limit.ts:25` |
| Ventana | **`VENTANA_MS = 15 * 60 * 1000`** (15 min) | `rate-limit.ts:28` |
| Atribución | `x-forwarded-for`, primera IP | `entrar/route.ts:63` |
| Almacenamiento | `Map` en memoria, en `globalThis` | `entrar/route.ts:48` |
| Poda | entradas vencidas, en cada intento | `entrar/route.ts:69-73` |
| Al entrar bien | `intentos.delete(origen)` — la cuenta se borra | `entrar/route.ts:199` |

🔴 **El límite responde 401, no 429** (`rate-limit.ts:38-41`):
```ts
export const RESPUESTA_LIMITE = {
  status: 401,
  cuerpo: { error: 'Ese código no abre ningún cliente.' },
} as const;
```
Comentario: *"El mensaje NO dice 'demasiados intentos' con un número: eso le confirma a un
atacante que el límite existe y cuánto le queda. [...] un 429 distinguible es un oráculo."*

**Pero sí manda `Retry-After`** (`entrar/route.ts:92`):
```ts
respuesta.headers.set('Retry-After', String(espera));
```
⚠️ La cabecera delata que hay límite aunque el cuerpo no lo diga. Y `console.warn` escribe
en el log: `[entrar] ${origen} lleva ${registro?.fallos} intentos sin entrar`.

**El límite se comprueba ANTES de tocar la base** (`entrar/route.ts:82`).

### Todos los errores de `/api/entrar`

| Código | Condición | Mensaje literal |
|---|---|---|
| 401 | límite excedido, o código inválido, o cliente no existe | `Ese código no abre ningún cliente.` |
| 401 | sin acceso a ese cliente | `Ese código no abre ningún cliente, o no tienes acceso a él.` |
| 400 | — (el código inválido devuelve 401, no 400) | — |
| 500 | sin service client | `El sistema de acceso no está configurado.` |
| 500 | error de RPC | `No pudimos comprobar el código.` |
| 503 | — | — |

**Normalización del código** (`entrar/route.ts:105`): `replace(/\D/g, '').slice(0, 4)`.
Deben ser exactamente 4 dígitos.

🔴 **Todo error de código da 401.** No hay forma de distinguir "código equivocado" de
"cliente existe pero no tienes acceso" — y esa es la decisión de diseño, explícita.

---

## 2. `/api/cambiar-cliente`

**Body:** `{ proyecto?: string }`. Sin código.

| Código | Condición | Mensaje literal |
|---|---|---|
| 401 | sin sesión | `Entra con el código de tu cliente para poder cambiar.` |
| 400 | falta destino | `Falta el cliente al que quieres pasar.` |
| 404 | slug no conocido | `Ese cliente no existe.` |
| 200 | mismo cliente (no-op) | `{ success: true, proyecto, rol: null }` |
| 500 | error de perfil | mensaje crudo |
| 403 | correo no está en la lista | `Tu correo no está en la lista del equipo.` |
| 403 | no es del equipo | `Tu cuenta existe pero no eres del equipo.` |
| 403 | fila desactivada | `Tu fila está desactivada, así que no puedes cambiar de cliente.` |
| 403 | sin acceso a ese cliente | `No tienes acceso a ese cliente. Se lo pides a quien administra el hub.` |
| 503 | sin service client | `El sistema de acceso no está configurado.` |

**Respuesta 200** (`cambiar-cliente/route.ts:136-143`): `{ success, proyecto, rol, desde, nombre }`

**Cookie: mismos atributos que `/api/entrar`** (`cambiar-cliente/route.ts:147-154`).
Comentario: *"si se firmara con otro lifetimes o sin `secure`, la sesión que naciera aquí
duraría lo que durase la que se creó en la puerta, que es justo lo que se quiere evitar."*

**Lo que NO hace** (`cambiar-cliente/route.ts:31-34`): no acepta código, no amplía permisos,
no deja el rol anterior pegado. El rol nuevo es el de ESE cliente.

⚠️ **Bug ya corregido, documentado** (`cambiar-cliente/route.ts:78-86`):
> *"La primera versión filtraba `rr_hub_access` solo por proyecto, SIN `user_id`. Devolvía todas
> las filas de los dos clientes y `find()` cogía la primera. Medido el 2026-09-29: tu correo
> es `owner` en los cuatro clientes, la fila que le tocó fue la de otra persona, y la API
> respondió `rol: creator` sin que nadie lo notara. Un permiso que se concede a la persona
> equivocada es peor que un permiso que falta: se ve funcionar."*

---

## 3. `/api/quien-soy`

**Solo GET.** Sin parámetros.

| Código | Condición | Mensaje literal |
|---|---|---|
| 401 | sin cookie | `No has entrado.` |

**Respuesta 200** (`quien-soy/route.ts:40-45`): `{ email, nombre, proyecto, id }`

**No devuelve el rol** (`quien-soy/route.ts:11-16`):
> *"No devuelve el rol ni el cliente. La barra lateral no los necesita, y devolverlos sería
> darle a cualquier página una respuesta con la que decidir cosas que en realidad decide
> `rr_hub_access`."*

⚠️ **Contradicción con el comentario:** dice *"No devuelve el rol ni el cliente"* y sí
devuelve `proyecto` y `id`.

---

## 4. `/api/workspace/[action]` — 1103 líneas, 10 acciones

**Todas POST.** El action va en el **path**, no en el body:
`route.split('/').pop()` (`route.ts:181`).

**Las 10 acciones** (`grep -nE "action === '"`):

| # | Action | Línea | Requiere rol | 403 literal |
|---|---|---|---|---|
| 1 | `create-idea` | 191 | cualquiera con acceso | `unauthorized()` |
| 2 | `roster` | 192, 246 | cualquiera con acceso | `unauthorized()` |
| 3 | `transition` | 204 | según `allowedTransitions` | `El rol ${ROLE_LABEL[role]} no puede pasar de ${from} a ${to}.` |
| 4 | `script` | 232 | `PUEDE_ESCRIBIR_GUION` | `Tu rol no escribe el guion. Pídeselo a quien edite la pieza.` |
| 5 | `update` | 271 | `PUEDE_EDITAR` | `Tu rol no edita la pieza. Puedes comentar para pedir el cambio.` |
| 6 | `vote` | 418 | **ninguno por rol** | ver bloque 2 |
| 7 | `borrar` | 699 | `PUEDE_BORRAR` + estado | mensaje de estado (§3 bloque 1) |
| 8 | `assign` | 768 | solo `owner` | `Solo el owner puede asignar responsable. Tu rol es ${ROLE_LABEL[role]}.` |
| 9 | `comment` | 829 | `PUEDE_COMENTAR` | `Tu rol no está en el equipo de este proyecto.` |
| 10 | `resolve-comment` | 846 | `PUEDE_EDITAR` | `Tu rol no resuelve comentarios. Puedes comentar para pedirlo.` |
| — | `asset` | 864 | cualquiera con acceso | `validateAssetPath` |
| — | *desconocida* | 887 | — | 404 `Acción desconocida.` |

**`context()` — requisitos** (`route.ts:90-124`):
```ts
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceKey) {
  return { response: error('El servidor no tiene la configuración de Supabase.', 500) as NextResponse };
}
```
🔴 **Exige `NEXT_PUBLIC_SUPABASE_ANON_KEY` aunque no la use.** El comentario (`route.ts:99-101`)
dice que ya no hay cliente anónimo. La variable es un requisito fantasma: si falta, esta
ruta devuelve 500 aunque el service client esté bien.

**Body:** JSON plano. `ideaId` obligatorio salvo en `create-idea` y `roster` (`route.ts:197-198`).
JSON inválido → 400 `Cuerpo JSON inválido.`

---

## 5. `/api/workspace/pieza`

**Solo GET.** Query: `?ideaId=<uuid>`.

| Código | Condición | Mensaje literal |
|---|---|---|
| 401 | sin cookie | `Entra con el código de tu cliente.` |
| 400 | sin ideaId | `Falta la idea.` |
| 404 | la idea no es del cliente | `Esa pieza no es de tu cliente.` |
| 500 | sin service client | `El servidor no tiene la configuración de Supabase.` |

**Respuesta 200:** `{ comentarios, assets, timeline }`

**Validación cruzada** (`pieza/route.ts:32-41`): la idea tiene que pertenecer al cliente de la
cookie. Comentario: *"Sin esto, entrar con 1111 y pedir el id de una idea de Candilejas
devolvería sus comentarios."*

**No comprueba rol** (`pieza/route.ts:15-17`): *"leer la ficha no es escribirla"*.

---

## 6. `/api/ideas` — la única con `x-api-key`

**`runtime = 'nodejs'`** (`:6`), necesario para `timingSafeEqual` de `node:crypto`.

**Auth, literal** (`ideas/route.ts:27-31`):
```ts
function authorized(request: NextRequest, token: string) {
  const value = request.headers.get('x-api-key');
  if (!value || value.length !== token.length) return false;
  return timingSafeEqual(Buffer.from(value), Buffer.from(token));
}
```

**Variables que exige** (`ideas/route.ts:19-25`):
```ts
function configured() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = process.env.RR_HUB_AUTOMATION_TOKEN;
  return url && serviceKey && token ? { url, serviceKey, token } : null;
}
```
🔴 **`RR_HUB_AUTOMATION_TOKEN` es la única variable de todo el API que solo usa esta ruta.**
🔴 **[REDACTADO]**: el valor del token no se imprime. Vive en el entorno, no en el repo.

**`GET`** — query `?project=<slug>`, default `wundeer`.
| Código | Condición | Mensaje literal |
|---|---|---|
| 503 | sin config | `La automatización no está configurada todavía.` |
| 401 | key inválida | `API key inválida.` |
| 400 | slug no visible | `Ese cliente no existe.` |
| 404 | slug no está en la base | `${slug} no existe en la base.` |
| 500 | error de lectura | `No se pudieron consultar las ideas.` |

**Respuesta 200:** `{ project, count, ideas: [{ id, code, title, description, objective, content_type, category, status, priority, reference_urls, created_at, updated_at }] }`

**`POST`** — body `Payload` (`ideas/route.ts:9-18`):
`{ project_slug?, title?, description?, objective?, content_type?, category?, reference_urls?, priority? }`

🔴 **Validación completa, con límites declarados** (`ideas/route.ts:37`):
```ts
const LIMITS = { title: [3, 160], description: [0, 2000], objective: [0, 500], category: [1, 80], references: 10 } as const;
```
Mensajes literales: `title debe tener entre 3 y 160 caracteres.`,
`description debe tener entre 0 y 2000 caracteres.`, `objective debe tener entre 0 y 500
caracteres.`, `category debe tener entre 1 y 80 caracteres.`,
`reference_urls admite maximo 10 elementos.`, `Cada reference_urls debe ser una URL http(s)
válida.`

| Código | Condición | Mensaje literal |
|---|---|---|
| 400 | JSON inválido | `El cuerpo debe ser JSON válido.` |
| 400 | validación | (los 6 de arriba) |
| 404 | slug no en la base | `${slug} no existe en la base.` |
| 409 | 5 colisiones de código | `No se pudo asignar un codigo libre tras varios intentos.` |
| 201 | éxito | `{ success: true, idea: { id, code, title, status } }` |

**Evento escrito** (`ideas/route.ts:170-173`):
```ts
await setup.supabase.from('rr_hub_events').insert({
  idea_id: idea.id, to_status: 'draft', comment: 'Idea creada mediante la API de automatización.', actor_label: 'Automatización API',
});
```

⚠️ **CONTRADICCIÓN de límites con la ruta del hub:**
| Campo | `/api/ideas` | `/api/workspace` `create-idea` |
|---|---|---|
| `title` | 3–160 | 3–160 (`str(body.title, 160)`) |
| `description` | 0–2000 | 2000 |
| `objective` | 0–500 | 500 |
| `category` | **1–80** | 80 |
| references | **10, con error si excede** | **10, se truncan en silencio** |
| `priority` | acepta `high`/`normal` | **no lo acepta** |

🔴 **`priority` solo existe en `/api/ideas`.** El formulario del hub no puede crear una idea
prioritaria.

🔴 **Esta ruta NO exige la cabecera `x-rr-origen`**, pero usa service role y escribe directo.
Una idea creada por aquí queda siempre `origen = 'manual'`, porque la cabecera no viaja y el
servidor decide (`route.ts:1066`). El generador Python, en cambio, escribe por la Management
API, no por aquí.

---

## 7. `/api/subir`

**Solo POST.** Body JSON con el archivo en **base64** (`subir/route.ts:46-49`):
`{ projectSlug, ideaId, stage, fileName, mimeType, bytes, versionLabel }`

| Código | Condición | Mensaje literal |
|---|---|---|
| 401 | sin cookie | `Entra con el código de tu cliente para subir archivos.` |
| 503 | sin service client | `El servidor no tiene la configuración de Supabase.` |
| 400 | JSON inválido | `Cuerpo JSON inválido.` |
| 403 | slug != cookie | `Ese cliente no es el tuyo.` |
| 400 | sin ideaId | `Falta la idea.` |
| 400 | MIME no permitido | `Solo se admiten imágenes (jpg, png, webp, gif, avif, heic).` |
| 400 | sin bytes | `No llegó el archivo.` |
| 400 | base64 corrupto | `El archivo llegó corrupto.` |
| 400 | vacío | `El archivo llegó vacío.` |
| 413 | > 100 MB | `El archivo supera el máximo de 100 MB.` |
| 400 | firma no coincide | `Eso no es una imagen, aunque se le diga que lo es.` |
| 403 | correo no en perfiles | `No reconocemos tu correo en la lista del equipo.` |
| 500 | error de storage | `No se pudo guardar el archivo: ${error.message}` |
| 500 | falló la fila | `El archivo subió pero no se pudo registrar. Avisa a Dirección.` |
| 200 | éxito | `{ success, path, fileName, mimeType, versionLabel }` |

🔴 **El body es JSON con base64, no `multipart`.** Comentario (`subir/route.ts:45-48`):
> *"No es la forma más eficiente de mover bytes, y es la única que sobrevive a un despliegue
> de Vercel donde `request.formData()` y el límite de 4.5 MB no alcanzan."*

**Variable de entorno:** ninguna explícita; usa `createServiceClient()`.

---

## 8. `/api/archivo`

**Solo GET.** Query: `?path=<ruta>`.

| Código | Condición | Mensaje literal |
|---|---|---|
| 401 | sin cookie | `Entra con el código de tu cliente.` |
| 400 | sin path, o > 300 chars | `Falta la ruta del archivo.` |
| 403 | path no empieza por `{sesion.proyecto}/` | `Ese archivo no es de tu cliente.` |
| 400 | path con `..` | `Ruta no válida.` |
| 500 | sin service client | `El servidor no tiene la configuración de Supabase.` |
| 500 | error de storage | mensaje crudo |
| 200 | éxito | `{ existe: boolean, path }` |

**Usa `.list()` con `search`, no `getPublicUrl`** (`archivo/route.ts:53-57`).

---

## 9. `/api/presencia`

**POST** = latido. Body: `{ sesionId?: string }` (máx. 80 chars).

**GET** = quién está. Sin parámetros.

| Código | Condición | Mensaje literal |
|---|---|---|
| 401 | sin cookie (ambas) | `Entra con el código de tu cliente.` |
| 503 | sin service client | `Supabase no configurado.` |
| 500 | error de upsert o de lectura | mensaje crudo |
| 200 | POST | `{ ok: true }` |
| 200 | GET | `{ ventana_ms, presencia: [...] }` |

**`VENTANA_ONLINE_MS = 5 * 60 * 1000`** (`presencia/route.ts:22`).

**Upsert** (`presencia/route.ts:56-61`): `{ onConflict: 'email' }`.

---

## Todas las variables de entorno que exige la API

| Variable | Rutas que la exigen | `[REDACTED]` |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | entrar, cambiar-cliente, quien-soy, workspace, workspace/pieza, ideas, subir, archivo, presencia | valor |
| `SUPABASE_SERVICE_ROLE_KEY` | **workspace, ideas** | valor |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **workspace** (y no la usa) | valor |
| `RR_HUB_AUTOMATION_TOKEN` | **ideas** | valor |
| `SUPER_ADMIN_EMAILS` | workspace, admin-guard | valor |
| `HUB_SECRET` | entrar, cambiar-cliente (firma de cookie) | valor |
| `NODE_ENV` | entrar, cambiar-cliente (para `secure`) | — |

🔴 **`HUB_SECRET` es obligatoria y no tiene valor por defecto** (`hub-session.ts:80-89`):
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
🔴 **Si falta, la app NO ARRANCA.** Es un throw en el primer uso de la firma.

**Historial grave, ya corregido, literal** (`hub-session.ts:68-78`):
> *"MEDIDO 2026-10-01 (auditoría de seguridad): esta línea era un `??` con un LITERAL de 26
> caracteres escrito justo aquí, y `HUB_SECRET` no existía en las variables de Vercel. El `??`
> ganaba siempre, así que la app firmaba las sesiones con una clave publicada en el repo, el
> README y este archivo. Eso abría la puerta entera sin código [...] elegir un correo de
> `SUPER_ADMIN_EMAILS` daba `owner`."*

🔴 **[REDACTED]**: el valor del literal anterior no se reproduce. Ya no está en el código.

**Atributos de la cookie, literales** (`hub-session.ts:107`, `entrar/route.ts:203-210`):
- Nombre: **`hub_sesion`** (`const COOKIE = 'hub_sesion'`, `hub-session.ts:70`)
- `httpOnly: true`
- `sameSite: 'lax'`
- `secure: process.env.NODE_ENV === 'production'`
- `path: '/'`
- `maxAge: 30 * 24 * 60 * 60` (`DIAS = 30`, `hub-session.ts:102`)
- Firma: `createHmac('sha256', claveFirma())`, base64url
- Formato: `{base64url}.{firma}`

**Validación de la cookie** (`leerSesion`): si no hay, si no tiene exactamente 2 partes
separadas por `.`, o si la firma no valida con `timingSafeEqual` → `null`. **Nunca lanza.**

---

## Tabla de cierre

| Dato pedido | Estado | Fuente |
|---|---|---|
| Lista de todos los `route.ts` | **ENCONTRADO — 9 rutas** | `find src/app/api -name route.ts` |
| `/api/entrar` 2 pasos | **ENCONTRADO** | `entrar/route.ts:79-210` |
| Rate limit del login | **ENCONTRADO — 8 intentos / 15 min** | `rate-limit.ts:25-28` |
| `/api/cambiar-cliente` | **ENCONTRADO** | `cambiar-cliente/route.ts:39-157` |
| `/api/quien-soy` | **ENCONTRADO** | `quien-soy/route.ts:20-46` |
| `/api/workspace/[action]` | **ENCONTRADO — 10 acciones + `asset`** | `route.ts:191-887` |
| `/api/workspace/pieza` | **ENCONTRADO** | `pieza/route.ts:20-51` |
| `/api/ideas` con `x-api-key` | **ENCONTRADO** | `ideas/route.ts:19-31`, `125-176` |
| `/api/subir` | **ENCONTRADO** | `subir/route.ts:33-162` |
| `/api/archivo` | **ENCONTRADO** | `archivo/route.ts:25-65` |
| `/api/presencia` | **ENCONTRADO** | `presencia/route.ts:28-95` |
| Métodos por ruta | **ENCONTRADO** | tabla índice |
| Autenticación por ruta | **ENCONTRADO — 7 cookie, 1 api-key, 1 abierta** | índice |
| Códigos de respuesta | **ENCONTRADO — tabla completa por ruta** | cada sección |
| Variables de entorno | **ENCONTRADO — 7 listadas** | tabla final |

**CONTRADICCIONES detectadas (3):**
1. `/api/quien-soy` dice en su comentario *"No devuelve el rol ni el cliente"* (`quien-soy/route.ts:13-16`) y devuelve `proyecto` e `id`.
2. `/api/workspace` exige `NEXT_PUBLIC_SUPABASE_ANON_KEY` (`route.ts:90-95`) aunque su comentario dice que ya no hay cliente anónimo. Es un requisito fantasma: sin ella, 500.
3. Los límites difieren entre `/api/ideas` y `create-idea`: `category` es 1–80 en una y 0–80 en la otra; las referencias **excedentes dan error** en `/api/ideas` y **se truncan en silencio** en el hub. Y `priority` solo existe en `/api/ideas`.

---
*BLOQUE 5 COMPLETO. Archivo: `docs/qa-insumos/BLOQUE_05_api-completa.md`*
