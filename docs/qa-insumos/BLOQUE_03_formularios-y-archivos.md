# BLOQUE 03 — Formularios, validaciones y archivos

> Fuente: lectura literal en la rama `pausa-visible`, commit `6b836c1` (2026-10-01).
> Archivos: `src/app/[projectSlug]/ideas/nueva/page.tsx`, `src/components/new-idea-form.tsx`,
> `src/lib/workspace-client.ts`, `src/app/api/workspace/[action]/route.ts`,
> `src/app/api/subir/route.ts`, `src/lib/firma-imagen.ts`, `src/lib/flow.ts` y las migraciones citadas.

---

## a) `/[projectSlug]/ideas/nueva` — cada campo

La página de servidor (`nueva/page.tsx`, 54 líneas) solo carga la biblioteca de anuncios y
pasa props a `NewIdeaForm` (`new-idea-form.tsx`, 197 líneas, `'use client'`).

**Definición del estado** (`new-idea-form.tsx:11-12`), literal:
```ts
type FormState = { title: string; type: 'Orgánico' | 'Pauta'; category: string; objective: string; description: string; camera: string; talent: string; edit: string; reference: string; adId: string; adName: string };
const empty: FormState = { title: '', type: 'Orgánico', category: '', objective: '', description: '', camera: '', talent: '', edit: '', reference: '', adId: '', adName: '' };
```

| Campo visible | Etiqueta literal | Tipo | Obligatorio | Límites | Opciones | Mensaje de error literal |
|---|---|---|---|---|---|---|
| código | `// CÓDIGO` | solo lectura | — | — | valor fijo `AUTO` | — (dice `Se genera al guardar`) |
| `title` | `// TÍTULO *` | `input` | **Sí** | cliente: no vacío · servidor: mín. **3** chars, máx. **160** | — | cliente: `Falta el título o el objetivo.` · servidor: `El título necesita al menos 3 caracteres.` |
| `type` | `// TIPO` | `select` | No | — | **`['Orgánico', 'Pauta']`** | — |
| `category` | `// CATEGORÍA` | `input` | No | máx. **80** (servidor) | — | — (vacío → `Sin categoría`) |
| `objective` | `// OBJETIVO *` | `textarea` | **Sí** | cliente: no vacío · servidor: máx. **500** | — | cliente: `Falta el título o el objetivo.` |
| `description` | `// DESCRIPCIÓN / CONCEPTO` | `textarea` | No | máx. **2000** | — | — (vacío → `Sin descripción aún.`) |
| referencia | `// REFERENCIA` | `input` | No | máx. **300** por URL | — | `La referencia debe ser un enlace válido (https://…).` |
| `adId` | selector biblioteca | botón | No | máx. **64** | anuncios del proyecto | — |
| `camera` | `// CÁMARA` | `textarea` | No | máx. **4000** (crear) / **2000** (editar) | — | — |
| `talent` | `// TALENTO / MODELAJE` | `textarea` | No | máx. **4000** / **2000** | — | — |
| `edit` | `// EDICIÓN` | `textarea` | No | máx. **4000** / **2000** | — | — |

⚠️ **Los tres briefs NO son obligatorios**: si el campo queda vacío se usa el texto generado
por `buildIdeaPack` (`new-idea-form.tsx:78-80`):
```ts
cameraBrief: form.camera.trim() || generated.camera,
talentBrief: form.talent.trim() || generated.talent,
editBrief: form.edit.trim() || generated.edit,
```

**Placeholder literales:** `Ej. La textura que se siente` (título), `Producto y tela`
(categoría), `¿Qué debe conseguir esta pieza?` (objetivo),
`Describe la idea en lenguaje claro para el cliente y el equipo...` (descripción),
`O escribe tu propia versión (vacío = usar la generada)` (los 3 briefs).

**Botones y textos literales:** `← VOLVER`, `[NUEVO REGISTRO]`, `CREAR IDEA →` (o
`GUARDANDO…` mientras guarda), `GUARDADO EN EL HUB COMPARTIDO`,
`VER TAMBIÉN EL GUION QUE SE GENERARÁ`, `[LO QUE EL EQUIPO VA A EJECUTAR]`,
`El brief que se genera al guardar`.

🔴 **El botón `CREAR IDEA →` está `disabled` si la referencia no es válida**:
```tsx
<button disabled={saving || !referenceValid} className="btn-brutal" type="submit">
```
(`new-idea-form.tsx:190`). El aviso `La referencia debe ser un enlace válido (https://…).`
solo se ve si se envía de otra forma: **con el botón deshabilitado el usuario no puede
enviar y por lo tanto no ve el error**. `looksLikeUrl` devuelve `true` con campo vacío
(`workspace-client.ts:516`), así que vacío no bloquea.

**Aviso de error, donde vive** (`new-idea-form.tsx:105-109`):
```tsx
<div id="aviso-crear" role="alert" className="anim-pop border-l-4 border-l-mostaza bg-blanco-05 px-4 py-3">
```
`role="alert"` y se hace `scrollIntoView` 40 ms después (`new-idea-form.tsx:93-97`).
Comentario del código: *"Un fallo que aparece 800 px más abajo del botón que lo provocó se lee
como 'no pasa nada'."*

---

## b) Briefs por rol

**Solo hay TRES briefs**, no uno por cada uno de los 9 roles (`route.ts:1083-1085`):
`camera_brief`, `talent_brief`, `edit_brief`.

| Brief | Columna | Quién lo edita después | Quién lo escribe al crear |
|---|---|---|---|
| Cámara | `camera_brief` | cualquiera de `PUEDE_EDITAR` | el creador, o el generado |
| Talento / modelaje | `talent_brief` | cualquiera de `PUEDE_EDITAR` | el creador, o el generado |
| Edición | `edit_brief` | cualquiera de `PUEDE_EDITAR` | el creador, o el generado |
| Guion | `script_content` | **solo `PUEDE_ESCRIBIR_GUION`** | el generador automático |

`PUEDE_EDITAR` (`flow.ts:38-40`) — lista **positiva**:
```ts
export const PUEDE_EDITAR: readonly RoleKey[] = [
  'owner', 'creator', 'camera', 'model', 'editor', 'publisher', 'media_buyer',
] as const;
```
🔴 **Ni `client_approver` ni `client_viewer` pueden editar briefs.** Comentario del código
(`flow.ts:30-36`):
> *"Con esa [lista negativa], `client_approver` —el rol del cliente, cuya función es
> aprobar— podía reescribir el guion y cambiar las referencias de una pieza."*

`PUEDE_ESCRIBIR_GUION` (`flow.ts:42`): `['owner', 'creator', 'editor']`.
Comentario: *"El guion es de quien produce, no de quien aprueba ni de quien solo mira."*

**No existe brief para `publisher` ni `media_buyer`**, aunque ambos estén en `PUEDE_EDITAR`.

---

## c) Validación: cliente vs servidor

🔴 **NO HAY ZOD. NO HAY NINGÚN SCHEMA.**
```
grep -n 'zod' package.json   → sin resultado
find src -name '*schema*' -o -name '*valid*'   → sin resultados
```

**Toda la validación es `if` sueltos.** La función de recorte, usada en todo el servidor
(`route.ts:175`):
```ts
const str = (value: unknown, max = 4000) => (typeof value === 'string' ? value.trim().slice(0, max) : '');
```

**Divide de trabajo medida:**

| Regla | Cliente | Servidor |
|---|---|---|
| título no vacío | sí | — |
| título mín. 3 | no | **sí** (`route.ts:1010`) |
| título máx. 160 | no | **sí** (`str(body.title, 160)`) |
| objetivo no vacío | sí | no |
| URL válida | sí (`looksLikeUrl`) | **sí** (regex `/^https?:\/\//`) |
| referencia máx. 10 | no | **sí** (`.slice(0, 10)`, `route.ts:1013`) |
| slug proyecto existe | no | **sí** (404 `Ese proyecto no existe.`) |
| rol en el proyecto | no | **sí** (401) |
| `contentType` válido | no | **sí**: `body.contentType === 'paid' ? 'paid' : 'organic'` |

**`looksLikeUrl`, literal** (`workspace-client.ts:514-523`):
```ts
export function looksLikeUrl(value: string): boolean {
  const text = value.trim();
  if (!text) return true;
  try {
    const url = new URL(text);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
```

**El servidor filtra distinto y más duro** (`route.ts:1012-1014`):
```ts
const references = Array.isArray(body.referenceUrls)
  ? body.referenceUrls.map((value) => str(value, 300)).filter((value) => /^https?:\/\//.test(value)).slice(0, 10)
  : [];
```
⚠️ En `createIdea` el servidor **descarta silenciosamente** las URLs malas (filter) en vez de
dar error. En la acción `edit` sí da error 400 (`route.ts:311-314`):
```ts
return error(`"${texto}" no es una dirección válida.`, 400);
...
return error(`Solo se aceptan direcciones http o https. "${texto}" es ${parseada.protocol}`, 400);
if (!parseada.host) return error(`"${texto}" no tiene dominio.`, 400);
```

**Colisión de código: 5 reintentos** (`route.ts:1069-1097`):
```ts
for (let attempt = 0; attempt < 5; attempt += 1) {
  // ... calcula max+1 e inserta
  // 23505 = unique violation: another writer took this code, recompute.
  if (insertError?.code !== '23505') return error(insertError?.message ?? 'No se pudo crear la idea.', 500);
}
return error('No se pudo asignar un código libre tras varios intentos.', 409);
```

---

## d) Subida de archivos (`rr_hub_assets`)

🔴 **La ruta real es `/api/subir` (POST)**, no la acción `asset` del workspace.

**Tabla** (`20260910_content_hub_isolated.sql:77-89`), literal:
```sql
create table if not exists public.rr_hub_assets (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.rr_hub_ideas(id) on delete cascade,
  uploaded_by uuid references auth.users(id),
  asset_stage text not null check (asset_stage in ('reference_brief','script','raw','edit_v1','edit_v2','edit_final','publication_evidence')),
  storage_path text,
  external_url text,
  file_name text not null,
  mime_type text,
  version_label text not null default 'v1',
  created_at timestamptz not null default now(),
  check (storage_path is not null or external_url is not null)
);
```

**Las 7 etapas permitidas** (del `check`): `reference_brief`, `script`, `raw`, `edit_v1`,
`edit_v2`, `edit_final`, `publication_evidence`.

**Tipos MIME: la tabla y el código NO coinciden.** 🔴

Bucket (`20260927_hub_pending_security.sql:78-85`):
```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'rr-content-assets', 'rr-content-assets', true, 104857600, -- 100 MB
  array['image/', 'video/', 'application/pdf', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
```

Lista del código (`firma-imagen.ts:41-45`):
```ts
export const TIPOS_DE_IMAGEN = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'image/avif', 'image/heic', 'image/heif',
] as const;
```

| Dónde | Acepta |
|---|---|
| Bucket (`allowed_mime_types`) | `image/`, `video/`, `application/pdf`, `application/msword`, docx |
| `/api/subir` | **solo 7 tipos de imagen** |

**Consecuencia medida, literal del código** (`workspace-client.ts:406-416`):
> *"Storage compara esa columna por igualdad EXACTA, no por prefijo: un `image/` en la lista
> hace que un `image/png` dé 415. Medido el 2026-09-28."*

🔴 **`CONTRADICCIÓN` documentada: el bucket dice `image/` y `video/`, pero el comentario de
`workspace-client.ts:413` registra que con la lista así `video/mp4` y `application/pdf`
daban `415`, y `image/png` daba `403`.** El filtro del bucket es más laxo que el del código,
y los dos no coinciden.

**Tamaño máximo: 100 MB.** Doble verificación: `MAX_BYTES = 100 * 1024 * 1024`
(`subir/route.ts:30`) y `file_size_limit = 104857600` en el bucket. Error 413:
`El archivo supera el máximo de 100 MB.`

**Doble verificación del tipo** (`subir/route.ts:69-95`): primero contra lo declarado, luego
contra la **firma real de los bytes**:
```ts
if (!TIPOS.has(declarado)) {
  return NextResponse.json({ error: 'Solo se admiten imágenes (jpg, png, webp, gif, avif, heic).' }, { status: 400 });
}
...
if (!firmaDeImagen(binario, declarado)) {
  return NextResponse.json({ error: 'Eso no es una imagen, aunque se le diga que lo es.' }, { status: 400 });
}
```
`firmaDeImagen` (`firma-imagen.ts:19-33`) comprueba los primeros bytes: `\x89PNG`, `FFD8FF`,
`GIF8`, `RIFF....WEBP`, y `ftyp` para avif/heic/heif. **Devuelve `false` para cualquier tipo no
listado**, así que un tipo que pase el `Set` pero no tenga firma conocida es rechazado.

**Quién puede subir y en qué estado:** 🔴 **NINGUNA condición de estado.** No hay ninguna
línea en `subir/route.ts` que mire `idea.status`. Se puede subir en cualquier estado,
incluido `published` y `closed`.

**Lo que sí se exige** (`subir/route.ts:34-68`), literal:
1. Cookie de sesión → 401 `Entra con el código de tu cliente para subir archivos.`
2. `projectSlug` del body **igual al de la cookie** → 403 `Ese cliente no es el tuyo.`
3. `ideaId` presente → 400 `Falta la idea.`
4. El tipo está en la lista → 400
5. `bytes` es string no vacío → 400 `No llegó el archivo.`
6. Base64 válido → 400 `El archivo llegó corrupto.`
7. No vacío → 400 `El archivo llegó vacío.`
8. Tamaño → 413
9. Firma real → 400
10. El correo está en `rr_hub_profiles` → 403 `No reconocemos tu correo en la lista del equipo.`

**Versionado: NO hay numeración automática.** `version_label` es texto libre, máximo 60
caracteres, con default `'v1'` (`subir/route.ts:59`):
```ts
const versionLabel = (typeof cuerpo.versionLabel === 'string' ? cuerpo.versionLabel : '').trim().slice(0, 60) || 'v1';
```
🔴 **No hay código que incremente `v1` → `v2`.** El cliente lo manda. Nada impide mandar `v1`
veinte veces.

**Ruta del objeto, armada por el servidor** (`subir/route.ts:110`):
```ts
const ruta = `${projectSlug}/${ideaId}/${stage}/${perfil.id}-${Date.now()}-${nombre}`;
```
Comentario: *"El id sale de la cookie, no del cuerpo. Antes venía en la ruta que armaba el
cliente, o sea que la ruta era su palabra."*

**Subir una versión nueva NO reemplaza nada:** `upload(ruta, binario, { upsert: false, ... })`
(`subir/route.ts:114`). Cada subida es un objeto nuevo con `Date.now()` en el nombre. Se
acumulan.

**Borrado de archivos: NO ENCONTRADO.** No hay ninguna acción que borre de `rr_hub_assets` ni
de `storage.objects`. La política de storage permite `delete` solo a admin
(`20260927_hub_pending_security.sql:98-100`), pero no hay código que la use.

**Fallback en modo abierto:** `SIN_QUIEN` se usa como id de perfil cuando no hay sesión
(`route.ts:874`, `validateAssetPath`).

---

## e) Comentarios (`rr_hub_comments`)

**Tabla** (`20260910_content_hub_isolated.sql:67-75`):
```sql
create table if not exists public.rr_hub_comments (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.rr_hub_ideas(id) on delete cascade,
  author_id uuid references auth.users(id),
  body text not null,
  role_label text not null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
```
Columnas agregadas después: `author_label` (usada en `route.ts:838`).

**Longitud máxima: 4000 caracteres**, literal (`route.ts:836`):
```ts
const text = str(body.body, 4000);
if (!text) return error('El comentario está vacío.', 400);
```

**Quién comenta: los 9 roles.** `PUEDE_COMENTAR` (`flow.ts:44-47`) los incluye **todos**,
incluidos `client_approver` y `client_viewer`:
```ts
export const PUEDE_COMENTAR: readonly RoleKey[] = [
  'owner', 'creator', 'camera', 'model', 'editor', 'publisher', 'media_buyer',
  'client_approver', 'client_viewer',
] as const;
```
Comentario: *"Comentar es de cualquiera del equipo: es la vía para pedir un cambio."*
Si el rol no está: 403 `Tu rol no está en el equipo de este proyecto.`

**Insert, literal** (`route.ts:838-840`):
```ts
await service.from('rr_hub_comments').insert({
  idea_id: ideaId, body: text,
  role_label: ROLE_LABEL[role], author_label: `${ctx.email} · ${ROLE_LABEL[role]}`,
});
```

**Editar un comentario: NO ENCONTRADO.** No hay acción de update del `body`.

**Borrar un comentario: NO ENCONTRADO.** No hay `DELETE` sobre `rr_hub_comments`.

**Resolver: sí, pero no es editar** (`route.ts:847-862`):
```ts
if (!PUEDE_EDITAR.includes(role)) {
  return error('Tu rol no resuelve comentarios. Puedes comentar para pedirlo.', 403);
}
const commentId = str(body.commentId, 64);
if (!commentId) return error('Falta commentId.', 400);
const { error: updateError } = await service
  .from('rr_hub_comments')
  .update({ resolved_at: isResolved(body.resolved) ? new Date().toISOString() : null })
  .eq('id', commentId)
  .eq('idea_id', ideaId);
```
Comentario del código: *"`comment` una rama más arriba sí lo exige; esta se había quedado sin
puerta."* Se puede **desmarcar** mandando `resolved: false` (pone `null`).

**Menciones `@`: NO ENCONTRADO.** No hay código de menciones, ni parser, ni columna. Un `@` en
el cuerpo es texto plano.

---

## f) Referencias y links

**Máximo 10**, `.slice(0, 10)` en `createIdea` (`route.ts:1013`). Sin máximo explícito en la
acción `edit` (solo el límite de 500 caracteres por URL, `route.ts:305`).

**En `createIdea` se filtran en silencio**; en `edit` se rechazan con error. Ver sección c).

**Longitud por URL:** 300 en `createIdea`, 500 en `edit`.

**Protocolos:** solo `http:` y `https:`. En `edit` hay tres errores distintos:
- `"${texto}" no es una dirección válida.` (400)
- `Solo se aceptan direcciones http o https. "${texto}" es ${parseada.protocol}` (400)
- `"${texto}" no tiene dominio.` (400)

**Comentario de seguridad, literal** (`route.ts:310-311`):
> *"Un `javascript:` en la referencia se ejecutaría al pincharla, así que no se guarda aunque
> 'parezca' una URL."*

**Guardar lista vacía SÍ vale** (`route.ts:320`): *"Guardar la lista vacía SÍ vale: es como se
quita una referencia mala."*

🔴 **La UI solo ofrece UN campo de referencia** (`new-idea-form.tsx`, un solo `input`), pero
el servidor acepta hasta 10. No hay interfaz para las otras 9.

---

## g) Campo `origen` (`manual` | `asistente`)

🔴 **El navegador NO lo puede declarar.** Es lo más cuidadosamente protegido del bloque.

**La cabecera** (`route.ts:170-172`):
```ts
export const CABEZA_ORIGEN = 'x-rr-origen';
```

**Dónde se lee y decide** (`route.ts:1066-1067`):
```ts
const declarado = str(ctx.cabeceras.get(CABEZA_ORIGEN), 20);
const origen = declarado === 'asistente' ? 'asistente' : 'manual';
```

**Comentario completo del código** (`route.ts:1049-1064`), literal:
> *"EL ORIGEN NO LO DECLARA EL NAVEGADOR (Santiago, 2026-09-30). Antes era `body.origen ===
> 'asistente' ? 'asistente' : 'manual'`: el cliente mandaba el valor y el servidor se lo creia.
> Eso queria decir que cualquier persona con sesion podia declarar sus propias ideas como
> montadas por Hermes, que es justo la distincion que sirve para separar lo revisado de lo que
> nadie ha mirado. Una insignia que se puede poner a mano no es una insignia. [...] No es
> criptografia: es que para mentir haya que estar en el servidor."*

| Vía | Resultado |
|---|---|
| Formulario manual (`new-idea-form.tsx`) | **no manda la cabecera** → siempre `manual` |
| Generador de ideas | manda `x-rr-origen: asistente` → `asistente` |
| Cualquier otro valor | `manual` |

**El cliente lo documenta** (`workspace-client.ts:380`):
> *"OJO: `origen` NO va en el cuerpo. El servidor lo decide el (ver `CABEZA_ORIGEN`)."*

**Verificado por test:** `src/lib/idea-origen.test.ts:49` comprueba que la línea exacta
`const declarado = str(ctx.cabeceras.get(CABEZA_ORIGEN), 20)` siga existiendo, y `:148-149`
que se use `ctx.cabeceras.get(CABEZA_ORIGEN)`.

---

## Tabla de cierre

| Dato pedido | Estado | Fuente |
|---|---|---|
| a) Campos de `/ideas/nueva` | **ENCONTRADO — 11 campos** | `new-idea-form.tsx:11-12`, `100-197`; `route.ts:993-1103` |
| a) Mensajes de error literales | **ENCONTRADO — 3 del cliente, 2 del servidor** | `new-idea-form.tsx:57-60`, `route.ts:998-1010` |
| b) Briefs por rol | **ENCONTRADO — 3 briefs, no 9** | `route.ts:1083-1085`, `flow.ts:38-42` |
| c) zod / schema | **ENCONTRADO — NO EXISTE NINGUNO** | `grep -n 'zod' package.json` sin resultado |
| c) Validación cliente vs servidor | **ENCONTRADO** | `new-idea-form.tsx:57-60`, `route.ts:1009-1014` |
| d) MIME permitidos | **ENCONTRADO — CONTRADICCIÓN entre bucket y código** | `20260927_hub_pending_security.sql:78-85` vs `firma-imagen.ts:41-45` |
| d) Tamaño máximo 100 MB | **ENCONTRADO** | `subir/route.ts:30`, `20260927...sql:82` |
| d) Versionado de archivos | **ENCONTRADO — texto libre, sin auto-incremento** | `subir/route.ts:59` |
| d) Quién sube y en qué estado | **ENCONTRADO — sin condición de estado** | `subir/route.ts:34-95` |
| d) Borrado de archivos | **NO ENCONTRADO** | sin acción de delete en `src/` |
| e) Longitud de comentarios | **ENCONTRADO — 4000** | `route.ts:836` |
| e) Quién comenta | **ENCONTRADO — los 9 roles** | `flow.ts:44-47` |
| e) Editar / borrar comentario | **NO ENCONTRADO** | sin acción de update/delete del body |
| e) Menciones `@` | **NO ENCONTRADO** | sin código de menciones |
| f) Validación de URL | **ENCONTRADO** | `workspace-client.ts:514-523`, `route.ts:301-320` |
| f) Cantidad máxima de referencias | **ENCONTRADO — 10 en el servidor, 1 en la UI** | `route.ts:1013`, `new-idea-form.tsx` |
| g) Campo `origen` | **ENCONTRADO — cabecera `x-rr-origen`, no body** | `route.ts:172`, `1066-1067` |

**CONTRADICCIONES detectadas (3):**
1. El bucket permite `image/`, `video/`, `application/pdf`, msword y docx, pero `/api/subir` solo acepta 7 tipos exactos de imagen. `workspace-client.ts:413` registra que `video/mp4` y `pdf` dan `415` y `image/png` da `403` con la configuración del bucket.
2. `createIdea` **descarta en silencio** las URLs inválidas (`filter`, `route.ts:1013`), mientras `edit` las **rechaza con 400** (`route.ts:311-314`). Mismo dato, dos comportamientos.
3. La UI ofrece 1 campo de referencia; el servidor acepta hasta 10 (`route.ts:1013`).

---
*BLOQUE 3 COMPLETO. Archivo: `docs/qa-insumos/BLOQUE_03_formularios-y-archivos.md`*
