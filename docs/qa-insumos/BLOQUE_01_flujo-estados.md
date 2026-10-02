# BLOQUE 01 — Flujo de estados (`src/lib/flow.ts`)

> Fuente: lectura literal del archivo en la rama `pausa-visible`, commit `6b836c1` (2026-10-01).
> Todo lo de abajo sale de `src/lib/flow.ts` y de `src/app/api/workspace/[action]/route.ts`.
> Cero interpretación: donde el código y la documentación no coinciden, va marcado `CONTRADICCIÓN`.

---

## a) Los estados y su etiqueta visible

El tipo tiene **15 estados, no 14**. `src/lib/flow.ts:9-13`:

```ts
export type WorkflowStatus =
  | 'draft' | 'internal_review' | 'voting' | 'pending_approval' | 'needs_changes' | 'approved'
  | 'script_in_progress' | 'pending_script_review' | 'script_approved'
  | 'in_production' | 'raw_uploaded' | 'editing' | 'ready_to_publish'
  | 'published' | 'closed';
```

`CONTRADICCIÓN: el prompt pide 14 estados; el tipo declara 15 (flow.ts:9-13). Además la skill rr-content-hub dice "13 estados agrupados en 5 fases" y el archivo tiene 15 en 6.`

**Etiquetas visibles.** Hay TRES mapas distintos, y no coinciden entre sí:

`STATUS_LABEL` (`flow.ts:122-128`) — el que se exporta como etiqueta canónica:

| Estado | STATUS_LABEL | STATUS_SHORT (flow.ts:596-602) | STATUS_META.label (flow.ts:516-532) |
|---|---|---|---|
| `draft` | `BORRADOR` | `Borrador` | `BORRADOR` |
| `internal_review` | `REVISIÓN INTERNA` | `Revisión interna` | `REVISIÓN INTERNA` |
| `voting` | `EN VOTACIÓN` | `En votación` | `EN VOTACIÓN` |
| `pending_approval` | `ESPERANDO AL CLIENTE` | `Espera cliente` | `ESPERA CLIENTE` |
| `needs_changes` | `AJUSTES SOLICITADOS` | `Ajustes` | `AJUSTES PEDIDOS` |
| `approved` | `IDEA APROBADA` | `Aprobada` | `IDEA APROBADA` |
| `script_in_progress` | `GUIÓN EN CONSTRUCCIÓN` | `Escribiendo guion` | `GUIÓN EN CURSO` |
| `pending_script_review` | `GUIÓN POR APROBAR` | `Guion por aprobar` | `GUIÓN POR APROBAR` |
| `script_approved` | `GUIÓN APROBADO` | `Guion listo` | `GUIÓN APROBADO` |
| `in_production` | `RODAJE EN CURSO` | `Grabando` | `GRABANDO` |
| `raw_uploaded` | `CRUDO CARGADO` | `Crudo subido` | `CRUDO SUBIDO` |
| `editing` | `EN EDICIÓN` | `Editando` | `EDITANDO` |
| `ready_to_publish` | `REVISIÓN FINAL` | `Revisión final` | `REVISIÓN FINAL` |
| `published` | `PUBLICADO` | `Publicado` | `PUBLICADO` |
| `closed` | `CERRADO` | `Cerrado` | `CERRADO` |

⚠️ `pending_approval`, `needs_changes`, `script_in_progress`, `in_production` y `raw_uploaded`
tienen **texto distinto** según el mapa. `CONTRADICCIÓN interna: STATUS_LABEL dice
"ESPERANDO AL CLIENTE" y STATUS_META dice "ESPERA CLIENTE" (flow.ts:124 vs 520).`

`STATUS_META` añade además `icon`, `tone`, `who` y `blurb` por estado (`flow.ts:516-532`).

---

## b) `PHASES` — 6 fases (`flow.ts:102-115`)

| key | label | detail | Estados | Cuántos |
|---|---|---|---|---|
| `idea` | `IDEA` | `Se propone, se revisa y se decide` | `draft`, `internal_review`, `voting`, `pending_approval`, `needs_changes` | 5 |
| `script` | `GUIÓN` | `Se escribe y se aprueba` | `approved`, `script_in_progress`, `pending_script_review`, `script_approved` | 4 |
| `shoot` | `RODAJE` | `Se graba y se sube el crudo` | `in_production`, `raw_uploaded` | 2 |
| `edit` | `EDICIÓN` | `Se monta y se aprueba` | `editing`, `ready_to_publish` | 2 |
| `live` | `PUBLICACIÓN` | `Ya salió a la cuenta` | `published` | 1 |
| `closed` | `DESCARTADAS` | `No salió y no va a salir` | `closed` | 1 |

Suma 15. Ningún estado está en dos fases.

Comentario literal del código sobre `closed` (`flow.ts:108-113`):
> `closed` ESTÁ FUERA DE `live` A PROPÓSITO (Santiago, 2026-09-30: "bloqueamos una idea que no nos gustó y meterse bloqueado se fue a otra categoría que se llama publicado").

---

## c) Grafo de transiciones (18 aristas, `flow.ts:138-203`)

| desde | hacia | label (literal) | note (literal) | roles | owners declarados |
|---|---|---|---|---|---|
| `draft` | `internal_review` | `MIRAR EN REVISIÓN INTERNA` | `La idea entra a revisión interna del equipo.` | `team` | (ninguno) |
| `internal_review` | `voting` | `ABRIR VOTACIÓN` | `El equipo vota la idea antes de mandarla al cliente.` | `team` | `owner, creator, media_buyer` |
| `internal_review` | `pending_approval` | `IR DIRECTO AL CLIENTE` | `Revisión interna superada sin votación; va al cliente.` | `team` | `owner, creator, media_buyer` |
| `voting` | `pending_approval` | `CERRAR VOTACIÓN Y MANDAR` | `Votación cerrada; la idea va al cliente.` | `team` | `owner, creator, media_buyer` |
| `voting` | `internal_review` | `ABRIR DE NUEVO LA REVISIÓN` | `Votación detenida; la idea vuelve a revisión interna.` | `team` | `owner, creator, media_buyer` |
| `pending_approval` | `approved` | `APROBAR IDEA` | `El cliente aprobó la idea.` | `client` | (ninguno) |
| `pending_approval` | `needs_changes` | `SOLICITAR AJUSTES` | `El cliente pidió ajustes antes de continuar.` | `client` | (ninguno) |
| `pending_approval` | `closed` | `ARCHIVAR PROPUESTA` | `El cliente archivó esta propuesta.` | `client` | (ninguno) |
| `needs_changes` | `pending_approval` | `REENVIAR AL CLIENTE` | `Propuesta ajustada y reenviada.` | `team` | (ninguno) |
| `approved` | `script_in_progress` | `INICIAR GUIÓN` | `Idea aprobada; arranca la escritura del guion.` | `team` | (ninguno) |
| `script_in_progress` | `pending_script_review` | `ENVIAR GUIÓN AL CLIENTE` | `Guion enviado para validación.` | `team` | (ninguno) |
| `pending_script_review` | `script_approved` | `APROBAR GUIÓN` | `El cliente aprobó el guion.` | `client` | (ninguno) |
| `pending_script_review` | `script_in_progress` | `PEDIR CAMBIOS AL GUIÓN` | `El cliente pidió cambios en el guion; vuelve a escribirse.` | `client` | (ninguno) |
| `script_approved` | `in_production` | `INICIAR RODAJE` | `Producción confirmada; arranca el rodaje.` | `team` | (ninguno) |
| `in_production` | `raw_uploaded` | `MARCAR CRUDO CARGADO` | `Material crudo cargado y listo para edición.` | `team` | (ninguno) |
| `raw_uploaded` | `editing` | `INICIAR EDICIÓN` | `Edición iniciada sobre el crudo.` | `team` | (ninguno) |
| `editing` | `ready_to_publish` | `MARCAR EDICIÓN LISTA` | `Corte listo para revisión final.` | `team` | (ninguno) |
| `ready_to_publish` | `published` | `APROBAR Y PUBLICAR` | `Revisión final aprobada; pieza publicada.` | `team` | `owner, publisher, media_buyer` |
| `published` | `closed` | `CERRAR FLUJO` | `Pieza cerrada conservando todo su historial.` | `team` | `owner, publisher, media_buyer` |

**Salida por estado:** `draft` 1 · `internal_review` 2 · `voting` 2 · `pending_approval` 3 ·
`needs_changes` 1 · `approved` 1 · `script_in_progress` 1 · `pending_script_review` 2 ·
`script_approved` 1 · `in_production` 1 · `raw_uploaded` 1 · `editing` 1 ·
`ready_to_publish` 1 · `published` 1 · `closed` **0**.

---

## d) `STATUS_OWNERS` — quién responde por cada estado (`flow.ts:211-224`)

| Estado | Owners |
|---|---|
| `draft` | `owner`, `creator` |
| `internal_review` | `owner`, `creator`, `media_buyer` |
| `voting` | `owner`, `creator`, `media_buyer` |
| `pending_approval` | `[]` (vacío) |
| `needs_changes` | `owner`, `creator` |
| `approved` | `owner`, `creator` |
| `script_in_progress` | `owner`, `creator`, `editor` |
| `pending_script_review` | `[]` (vacío) |
| `script_approved` | `owner`, `camera`, `model` |
| `in_production` | `camera`, `model`, `owner` |
| `raw_uploaded` | `editor`, `owner` |
| `editing` | `editor`, `owner` |
| `ready_to_publish` | `owner`, `publisher`, `media_buyer` |
| `published` | `publisher`, `media_buyer`, `owner` |
| `closed` | `[]` (vacío) |

---

## e) La función `allowedTransitions`, copiada literal (`flow.ts:239-255`)

```ts
export function allowedTransitions(role: RoleKey, status: WorkflowStatus): AllowedTransition[] {
  const options = TRANSITIONS[status] ?? [];
  if (!options.length) return [];
  const isOwner = role === 'owner';
  return options
    .filter((option) => {
      if (option.roles === 'all') return true;
      if (isOwner) return true;
      if (option.roles === 'client') return role === 'client_approver';
      // A transition may name its own owners; otherwise it falls back to the
      // owners of the state being left. Using the *source* state alone made
      // `published → closed` unreachable: `closed` has no owners, so only the
      // owner escape hatch could ever fire it.
      return (option.owners ?? STATUS_OWNERS[status]).includes(role);
    })
    .map(({ to, label, note }) => ({ to, label, note }));
}
```

Es **lógica por reglas**, no una tabla. Las reglas, en orden de evaluación:

1. Si el estado no tiene transiciones → `[]`
2. Si la opción tiene `roles: 'all'` → pasa para todos (**ninguna opción actual usa `'all'`**)
3. **Si el rol es `owner` → pasa siempre.** Bocallave universal.
4. Si la opción es `roles: 'client'` → solo `client_approver`
5. Si no: `(option.owners ?? STATUS_OWNERS[status]).includes(role)`

⚠️ **Consecuencia del punto 3:** `owner` ve TODAS las opciones de cualquier estado con
transiciones, incluidas las de cliente. En `pending_approval`, `owner` ve `approved`,
`needs_changes` y `closed`.

---

## f) La matriz 9 roles × 15 estados

Celdas con los destinos permitidos, construida ejecutando la regla de arriba estado por estado.
`—` = sin ninguna opción.

| rol | draft | internal_review | voting | pending_approval | needs_changes |
|---|---|---|---|---|---|
| `owner` | `internal_review` | `voting`, `pending_approval` | `pending_approval`, `internal_review` | `approved`, `needs_changes`, `closed` | `pending_approval` |
| `creator` | `internal_review` | `voting`, `pending_approval` | `pending_approval`, `internal_review` | — | `pending_approval` |
| `camera` | — | — | — | — | — |
| `model` | — | — | — | — | — |
| `editor` | — | — | — | — | `pending_approval` |
| `publisher` | — | — | — | — | — |
| `media_buyer` | — | `voting`, `pending_approval` | `pending_approval`, `internal_review` | — | — |
| `client_approver` | — | — | — | `approved`, `needs_changes`, `closed` | — |
| `client_viewer` | — | — | — | — | — |

| rol | approved | script_in_progress | pending_script_review | script_approved | in_production |
|---|---|---|---|---|---|
| `owner` | `script_in_progress` | `pending_script_review` | `script_approved`, `script_in_progress` | `in_production` | `raw_uploaded` |
| `creator` | `script_in_progress` | `pending_script_review` | — | — | — |
| `camera` | — | — | — | `in_production` | `raw_uploaded` |
| `model` | — | — | — | `in_production` | `raw_uploaded` |
| `editor` | — | `pending_script_review` | — | — | — |
| `publisher` | — | — | — | — | — |
| `media_buyer` | — | — | — | — | — |
| `client_approver` | — | — | `script_approved`, `script_in_progress` | — | — |
| `client_viewer` | — | — | — | — | — |

| rol | raw_uploaded | editing | ready_to_publish | published | closed |
|---|---|---|---|---|---|
| `owner` | `editing` | `ready_to_publish` | `published` | `closed` | — |
| `creator` | — | — | — | — | — |
| `camera` | — | — | — | — | — |
| `model` | — | — | — | — | — |
| `editor` | `editing` | `ready_to_publish` | — | — | — |
| `publisher` | — | — | `published` | `closed` | — |
| `media_buyer` | — | — | `published` | `closed` | — |
| `client_approver` | — | — | — | — | — |
| `client_viewer` | — | — | — | — | — |

**`client_viewer` no puede mover NADA.** Es lo que dice `SOLO_MIRA_EN_EL_VOTEO` (`flow.ts:92`).

⚠️ **`draft` solo tiene un owner pero dos caminos:** la matriz muestra a `owner` y `creator`
pudiendo ir a `internal_review`, porque `STATUS_OWNERS.draft = ['owner','creator']`. Correcto.

---

## g) Condiciones extra que exigen las transiciones

**Server-side, `route.ts:205-229` (acción `transition`) — copiado literal:**

```ts
const to = str(body.toStatus, 40) as WorkflowStatus;
const from = str(body.fromStatus, 40) as WorkflowStatus;
if (!to || !from) return error('Faltan fromStatus o toStatus.', 400);

const permitted = allowedTransitions(role, from).some((move) => move.to === to);
if (!permitted) return error(`El rol ${ROLE_LABEL[role]} no puede pasar de ${from} a ${to}.`, 403);

const { data: current, error: readError } = await supabase
  .from('rr_hub_ideas').select('status').eq('id', ideaId).maybeSingle();
if (readError) return error(readError.message, 500);
if (!current) return error('La idea no existe.', 404);
if (current.status !== from) return error(`La idea ya no está en ${from} (está en ${current.status}). Recarga.`, 409);
```

Controles literales que se aplican a **toda** transición:

| Control | Dónde | Efecto |
|---|---|---|
| `fromStatus` y `toStatus` presentes | `route.ts:207` | 400 `Faltan fromStatus o toStatus.` |
| El rol puede la transición | `route.ts:210-211` | 403 `El rol {X} no puede pasar de {a} a {b}.` |
| La idea existe | `route.ts:216` | 404 `La idea no existe.` |
| **El estado real coincide con el que dice el navegador** | `route.ts:218` | 409 `La idea ya no está en {from} (está en {current}). Recarga.` |
| El `note` es opcional | `route.ts:226` | `comment: str(body.note, 1000) \|\| null` |

⚠️ **NO hay ninguna condición de:** comentario obligatorio, motivo obligatorio, archivo
subido, brief completo ni votos mínimos **en la transición normal**. Los votos mínimos (3) son
de la acción `vote`, no de `transition`.

**Condiciones que sí existen, pero en otras acciones:**

- `script` (`route.ts:232-243`): exige `PUEDE_ESCRIBIR_GUION` (403 `Tu rol no escribe el guion.
  Pídeselo a quien edite la pieza.`) y guion no vacío (400 `El guion está vacío.`). Máximo
  60.000 caracteres. **No genera evento** — comentario literal del código: *"saving a script is
  not a state transition, and a fake one in the timeline is worse than no trace."*
- `vote` (`route.ts:452-453`): *"Solo se vota lo que está abierto a votación"*.
- `vote` (`route.ts:487`): fila desactivada → 403 `Tu fila está desactivada, así que por ahora
  no cuentan tus votos.`
- `borrar` (`route.ts:723`): si el estado no está en `PUEDE_BORRAR_ESTADOS` → mensaje literal
  `"${idea.title}" ya no es un borrador: está en ${idea.status}. Se archiva en vez de borrarse,
  para no perder los votos ni los comentarios.`

---

## h) Cómo se llega a `closed`, si se puede reabrir, y desde qué estados

**Tres caminos hacia `closed`:**

| Desde | Label | Quién | Notas |
|---|---|---|---|
| `pending_approval` | `ARCHIVAR PROPUESTA` | solo `client_approver` + `owner` | `note`: `El cliente archivó esta propuesta.` |
| `published` | `CERRAR FLUJO` | `owner`, `publisher`, `media_buyer` + `owner` | `note`: `Pieza cerrada conservando todo su historial.` |

🔴 **Esa es la lista COMPLETA. `closed` NO tiene entrada desde ningún otro estado.**

En concreto, **no se puede descartar desde** `draft`, `internal_review`, `voting`,
`needs_changes`, `approved`, `script_in_progress`, `pending_script_review`, `script_approved`,
`in_production`, `raw_uploaded`, `editing` ni `ready_to_publish`.

⚠️ `CONTRADICCIÓN: la fase se llama DESCARTADAS con el detalle "No salió y no va a salir"
(flow.ts:114), pero desde 12 de los 15 estados no hay ninguna arista hacia closed. Solo se
cierra lo que ya está en manos del cliente o lo que ya se publicó. Una idea atascada en
editing no se puede descartar por el flujo.`

**¿Se puede reabrir? NO.** `closed` no aparece como `desde` en `TRANSITIONS` — cero salidas.
`esTerminal` lo confirma (`flow.ts:472-474`):

```ts
export function esTerminal(status: string): boolean {
  return status === 'published' || status === 'closed';
}
```

**Estados terminales:** `published` y `closed` (según `esTerminal`). ⚠️ Ojo: `published` **sí**
tiene una salida (a `closed`), así que es terminal "de negocio" pero no de grafo.

---

## i) `needs_changes`

- **Etiqueta canónica** (`STATUS_LABEL:124`): `AJUSTES SOLICITADOS`. En `STATUS_META:521`:
  `AJUSTES PEDIDOS`, `icon: '↺'`, `tone: 'fucsia'`, `who: 'CREATIVA'`,
  `blurb: 'El cliente pidió cambios; la pelota vuelve al equipo.'`
- **Fase:** `idea` (IDEA). `actGroup` → `equipo` (`flow.ts:551-557`).
- **Dueños:** `owner`, `creator`.
- **Salida ÚNICA:** `pending_approval` con label `REENVIAR AL CLIENTE`, `note`:
  `Propuesta ajustada y reenviada.`
- **No tiene vuelta atrás** (no hay arista hacia `draft` ni `internal_review`).

---

## j) Estados inalcanzables y otros hallazgos del grafo

- **Estados sin ninguna salida:** `closed` (y solo `closed`).
- **Estados que nunca son destino de nadie:** `draft`. Nadie puede volver a `draft`; solo se
  llega al crear la idea.
- **`pending_approval` y `pending_script_review` tienen `STATUS_OWNERS = []`** y a la vez son
  `roles: 'client'`. Combinado con la regla 4, el único rol que puede moverlos es
  `client_approver`… **más `owner`**, por el bocallave de la regla 3.
- `waitingOn('closed')` devuelve literalmente `'nadie: flujo cerrado'` (`flow.ts:477`).
- `waitingOn` para los dos estados del cliente devuelve `'el cliente'` (`flow.ts:478`).
- `nextStatus()` (`flow.ts:492-497`) devuelve el primer movimiento de equipo; si solo hay
  opciones de cliente, devuelve la primera.

---

## k) Qué se escribe en `rr_hub_events`

**Tabla** (`supabase/migrations/20260910_content_hub_isolated.sql:57-65`):

```sql
create table if not exists public.rr_hub_events (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.rr_hub_ideas(id) on delete cascade,
  actor_id uuid references auth.users(id),
  from_status text,
  to_status text not null,
  comment text,
  created_at timestamptz not null default now()
);
```

**Columna agregada después:** `actor_label text` —
`20260911_wundeer_collaborative_mode.sql:5`:
```sql
alter table public.rr_hub_events add column if not exists actor_label text;
```

⚠️ **No hay columna `kind`.** El tipo de evento se deduce comparando `from_status` contra
`to_status` (comentario literal en `route.ts:748-752`).

**Inserción de una transición normal** (`route.ts:224-227`):

```ts
const { error: eventError } = await service.from('rr_hub_events').insert({
  idea_id: ideaId, from_status: from, to_status: to,
  comment: str(body.note, 1000) || null, actor_label: ROLE_LABEL[role],
});
```

| Columna | Valor |
|---|---|
| `idea_id` | el id de la pieza |
| `from_status` | estado real leído del servidor |
| `to_status` | estado destino |
| `comment` | `note` del body, máx. 1000 chars, `null` si viene vacío |
| `actor_label` | `ROLE_LABEL[role]` (p. ej. `CREATIVA`, `CLIENTE`, `PAUTA`) |
| `actor_id` | **no se escribe** en `transition` |

**Inserción por votación ganada** (`route.ts:553-557`) — `actor_label` es una etiqueta fija,
no un rol:

```ts
comment: `Aprobada por votación interna: ${aFavor} a favor, ${enContra} en contra (mínimo ${VOTOS_NECESARIOS}).`,
actor_label: 'VOTACIÓN INTERNA',
```

**Inserción por votación perdida** (`route.ts:580-584`):
```ts
comment: `Descartada por votación interna: ${aFavor} a favor, ${enContra} en contra. Vuelve a revisión interna.`,
actor_label: 'VOTACIÓN INTERNA',
```

**Inserción al archivar** (`route.ts:753-759`) — `from_status = to_status`:

```ts
from_status: idea.status,
to_status: idea.status,
comment: `Borrada del tablero por ${email}`,
```

Con `actor_id: userId` sí presente. El comentario del código explica por qué:
*"Como archivar NO cambia la fase, el evento va con la fase igual en ambos lados y el texto dice
qué pasó."*

---

## Tabla de cierre

| Dato pedido | Estado | Fuente |
|---|---|---|
| a) 14 estados con etiqueta | **ENCONTRADO — pero son 15, no 14** | `flow.ts:9-13`, `122-128`, `516-532`, `596-602` |
| b) `PHASES` y estados por fase | **ENCONTRADO — 6 fases, 15 estados** | `flow.ts:102-115` |
| c) Grafo de transiciones `desde \| hacia \| quién` | **ENCONTRADO — 18 aristas** | `flow.ts:138-203` |
| d) Matriz `allowedTransitions` | **ENCONTRADO — lógica copiada + matriz construida** | `flow.ts:239-255` |
| e) Condiciones: comentario, motivo, archivo, brief, votos | **ENCONTRADO — ninguna en `transition`; sí en otras acciones** | `route.ts:205-229`, `232-243`, `487`, `723` |
| f) Cómo se llega a `closed` y si se reabre | **ENCONTRADO — 2 entradas, 0 salidas** | `flow.ts:162`, `198-202`, `472-474` |
| g) `needs_changes`: qué hace y a dónde vuelve | **ENCONTRADO** | `flow.ts:124`, `164-166`, `218`, `521` |
| h) Terminales e inalcanzables | **ENCONTRADO — `closed` sin salida; `draft` sin entrada** | `flow.ts:138-203`, `472-474` |
| i) `rr_hub_events`: columnas y valores | **ENCONTRADO** | `20260910_content_hub_isolated.sql:57-65`, `20260911...sql:5`, `route.ts:224`, `553`, `580`, `753` |
| Estructura de `rr_hub_events` completa | ENCONTRADO | `route.ts:748-752` (no hay columna `kind`) |

**CONTRADICCIONES detectadas (3):**
1. El prompt pide 14 estados; el código declara 15 (`flow.ts:9-13`).
2. La skill `rr-content-hub` dice "13 estados en 5 fases"; el código tiene 15 en 6 (`flow.ts:102-115`).
3. La fase se llama `DESCARTADAS` pero `closed` solo es alcanzable desde 2 de 15 estados (`flow.ts:114` vs `138-203`).

---
*BLOQUE 1 COMPLETO. Archivo: `docs/qa-insumos/BLOQUE_01_flujo-estados.md`*
