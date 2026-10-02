# BLOQUE 02 — Votación

> Fuente: lectura literal en la rama `pausa-visible`, commit `6b836c1` (2026-10-01).
> Fuentes: `src/lib/flow.ts`, `src/app/api/workspace/[action]/route.ts`,
> `src/lib/workspace-client.ts`, `src/components/idea-voting.tsx` y las migraciones citadas.
> Grep de arranque: `grep -rIn "vote\|voto\|voting" src/ supabase/migrations/` → **378 coincidencias**.

---

## a) La API de votos

🔴 **No existe una ruta `/api/votos`.** Todos los votos pasan por la acción `vote` dentro de
la ruta catch-all:

| Dato | Valor literal | Fuente |
|---|---|---|
| Ruta | `/api/workspace/vote` (POST) | `src/app/api/workspace/[action]/route.ts:418` |
| Método | `POST` únicamente | `route.ts:180` |
| Body | `{ ideaId, voterToken, decision, note }` | `route.ts:419-437` |
| Autenticación | Sesión por correo + fila en `rr_hub_profiles` con `is_team_member` e `is_active` | `route.ts:471-489` |

**Códigos de respuesta, todos literales de `route.ts`:**

| Código | Condición | Mensaje literal |
|---|---|---|
| 400 | falta token | `Falta el token de votante.` |
| 400 | `decision` no es una de las 4 | `La respuesta debe ser "yes", "no", "change" o "note".` |
| 400 | `change` o `note` sin texto | `Pedir un cambio sin decir cuál no sirve de nada. Escribe qué hay que cambiar.` / `La nota va vacía. Escribe lo que quieras que sepas.` |
| 401 | sin correo de sesión | `Para votar tienes que entrar con tu correo. El voto es del equipo, no de un clic anónimo.` |
| 403 | correo no está en la lista del equipo | `Ese correo no está en la lista del equipo.` |
| 403 | `is_team_member = false` | `Tu cuenta existe pero no eres del equipo. Pídeselo a quien administra el hub.` |
| 403 | `is_active = false` | `Tu fila está desactivada, así que por ahora no cuentan tus votos.` |
| 404 | la idea no existe | `La idea no existe.` |
| 409 | la idea no está en `voting` | `Esta idea no está en votación (está en ${idea.status}).` |
| 500 | error de base | mensaje crudo de Supabase |
| 500 | no hay salida en la tabla | `La votación no tiene salida a revisión del cliente.` / `La votación no tiene salida de vuelta a revisión interna.` |

**Respuesta 200** (`route.ts:613-634`): `{ success, decision, aFavor, enContra, gano, estado,
votacion, faltan, minimo, cambiosPedidos, detalle }`.

`estado` NO es un estado hardcodeado: se relee de la base. Si la votación no decidió,
`estado` devuelve el estado real en el que sigue la idea (`route.ts:619-625`).

---

## b) Quién puede votar

**La respuesta corta: NO se consulta el rol.** La condición es de correo, no de rol.

Comment literal del código (`route.ts:458-470`):
> *"El correo NUNCA se lee del cuerpo. `body.voterEmail` no se mira: escribir el de otra
> persona sería votar en su nombre con una línea de código."*

Los tres requisitos, comprobados contra la base (`route.ts:471-489`):
1. `email` de sesión no nulo
2. fila en `rr_hub_profiles` con `ilike('email', email)` → `is_team_member` verdadero
3. esa misma fila con `is_active` verdadero

| Rol | ¿Puede votar? | Fuente |
|---|---|---|
| `owner` | **Sí**, si su correo está en la lista del equipo | `route.ts:475-489` — no hay filtro por rol |
| `creator` | **Sí**, con la misma condición | ídem |
| `camera` | **Sí**, con la misma condición | ídem |
| `model` | **Sí**, con la misma condición | ídem |
| `editor` | **Sí**, con la misma condición | ídem |
| `publisher` | **Sí**, con la misma condición | ídem |
| `media_buyer` | **Sí**, con la misma condición | ídem |
| `client_approver` | **NO ENCONTRADO** — no hay excepción a su favor | `route.ts:471-489` |
| `client_viewer` | **NO ENCONTRADO** — no hay excepción a su favor | ídem |

🔴 **`client_viewer` y `client_approver` están en la lista para "solo mirar el voto"**
(`SOLO_MIRA_EN_EL_VOTEO = ['client_viewer']`, `flow.ts:92`) pero **la ruta no consulta el rol
en ningún momento**: cualquier fila de `rr_hub_profiles` marcada `is_team_member` y
`is_active` puede emitir un voto, sea del rol que sea.

⚠️ **CONTRADICCIÓN entre la constante y la ruta:** `SOLO_MIRA_EN_EL_VOTEO` dice que
`client_viewer` solo mira, pero `route.ts:418-489` no lee `RoleKey` en ningún punto de la
acción `vote`. El nombre de la constante sugiere un filtro que la ruta no aplica.

**¿Puede votar el autor de la idea? NO ENCONTRADO.** No hay ninguna línea en `route.ts` que
compare `voterEmail` contra el autor de la idea. El autor puede votar como cualquier otro
miembro del equipo.

**Efecto colateral medido:** cada voto actualiza `last_seen_at` del votante
(`route.ts:492-495`), así que votar cuenta como "estar en línea".

---

## c) Quórum

**`VOTOS_NECESARIOS = 3`** (`flow.ts:276`). La regla literal:

```ts
export function ganoLaVotacion(aFavor: number, enContra: number): boolean {
  if (aFavor < VOTOS_NECESARIOS) return false;
  return aFavor > enContra;
}

export function perdioLaVotacion(aFavor: number, enContra: number): boolean {
  if (enContra < VOTOS_NECESARIOS) return false;
  return enContra > aFavor;
}
```
(`flow.ts:292-309`)

**El mínimo aplica a los DOS lados.** Tres sí gana, tres no pierde.

**Las 4 decisiones literales** (`flow.ts:386`):
```ts
export type DecisionVoto = 'yes' | 'no' | 'change' | 'note';
```
`DECISIONES_VOTO = ['yes', 'no', 'change', 'note']` (`flow.ts:396`)
`DECISIONES_QUE_DECIDEN = ['yes', 'no']` (`flow.ts:399`)

| Decisión | Significado literal (comentario del código, `flow.ts:376-379`) | ¿Cuenta para el quórum? | ¿Frena? |
|---|---|---|---|
| `yes` | `sale si gana` | **Sí** | No |
| `no` | `no sale` | **Sí** | No |
| `change` | `ni sí ni no: hay que cambiar algo. Frena la votación.` | **No** | **Sí** |
| `note` | `comentario sin bloquear. Aporta y no cuenta.` | **No** | No |

**El estado cambia SOLO, automáticamente, sin que nadie lo pulse.** No hay botón de "cerrar
votación". El motor aplica el movimiento dentro de la propia acción `vote`, y solo escribe el
evento si la actualización realmente ocurrió (`route.ts:540-558`).

🔴 **El freno de `change` no necesita quórum** (`route.ts:588-610`):
```ts
if (frenaLaVotacion(decision) && hayCambioPedido(cambiosPedidos)) {
```
y `hayCambioPedido(cambios) { return cambios > 0; }` (`flow.ts:412-414`).
**Un solo `change` manda la pieza de vuelta a revisión interna, aunque haya cuatro sí.**

Literal del comentario que explica por qué:
> *"A diferencia de `gano` y `perdio`, esto no depende de un recuento de mínimos: basta con que
> alguien haya pedido un cambio."*

**Estados de la votación** (`flow.ts:321-327`): `ganada` | `perdida` | `esperando`.
`esperando` ≠ empate. `votosParaDecidir` (`flow.ts:330-332`) devuelve cuántos faltan por el
lado más cerca: `max(0, min(3 - aFavor, 3 - enContra))`.

---

## d) Doble voto

🔴 **La restricción está en la BASE, y es la única que realmente manda.** Constraint literal
(`20260928_hub_votacion_interna.sql:58-69`):

```sql
create table if not exists rr_hub_votes (
  id          uuid primary key default gen_random_uuid(),
  idea_id     uuid not null references rr_hub_ideas(id) on delete cascade,
  voter_token text not null,
  decision    text not null check (decision in ('yes', 'no')),
  note        text,
  created_at  timestamptz not null default now(),

  -- Una persona, un voto, por idea. Sin esto, "cargar" dos veces la página
  -- duplicaba el voto y la mayoría simple se distortionaba.
  unique (idea_id, voter_token)
);
```

**El `voter_token` NO es una persona.** Se genera en el navegador y vive en `localStorage`
(`workspace-client.ts:204-235`):

```ts
const LLAVE_VOTANTE = 'rr-hub-votante-v1';

export function tokenVotante(): string {
  if (typeof window === 'undefined') return '';
  const guardado = window.localStorage.getItem(LLAVE_VOTANTE);
  if (guardado) return guardado;
  // crypto.randomUUID() -> fallback getRandomValues -> cadena derivada
  ...
  window.localStorage.setItem(LLAVE_VOTANTE, token);
  return token;
}
```

Comentario literal que prohíbe usarlo como identidad:
> *"NUNCA un nombre, un email o un id de usuario, porque eso sería dato personal de una
> tercera persona en una tabla pública."*

⚠️ **Por lo tanto: el `unique (idea_id, voter_token)` impide DOS VOTOS EN UN MISMO
NAVEGADOR, no dos votos de una misma persona.** La misma persona en el celular y en el
computador tiene dos tokens distintos y vota dos veces. Y borrando `localStorage` se crea
uno nuevo. `votacion.test.ts:13` lo dice:
> *"probar desde acá es que Postgres respete el `unique (idea_id, voter_token)`, y..."*

**Lo que SÍ ata el voto a una persona** son las 3 verificaciones contra `rr_hub_profiles` de
`route.ts:471-489`, más la columna `voter_email` que se escribe con el correo de la SESIÓN
(`route.ts:505`), nunca del body. `20260928_hub_login_presencia.sql:23-31`:
```sql
alter table rr_hub_votes
  add column if not exists voter_email text;
comment on column rr_hub_votes.voter_email is
  'Correo de quien voto, si estaba con sesion. Null en los votos anonymous por token: el token sigue siendo el permiso minimo.';
```
Pero 🔴 **`voter_email` NO tiene constraint de unicidad.** No hay
`unique (idea_id, voter_email)`. La protección contra el doble voto es solo de token.

**¿Se puede cambiar el voto? SÍ.** `route.ts:500-509` hace **upsert**:
```ts
const { error: voteError } = await service.from('rr_hub_votes').upsert(
  { idea_id: ideaId, voter_token: token, decision,
    voter_email: votanteEmail,
    note: decision === 'change' || decision === 'note' ? nota : null },
  { onConflict: 'idea_id,voter_token' },
);
```
Comentario literal: *"Upsert en vez de insert: cambiar la respuesta es legítimo, duplicarla no."*
Y en la UI: *"Puedes cambiar tu voto: el último vale."* (`idea-voting.tsx:201-202`)

**¿Se puede RETIRAR el voto? NO ENCONTRADO.** No hay ninguna acción `unvote` ni `DELETE`
sobre `rr_hub_votes` en `src/`. `DELETE` está revocado incluso para `authenticated`
(`20260928_hub_cierra_escalada.sql:73`).

**Nota sobre el `note`:** si cambias de `change` a `yes`, la nota anterior se manda a `null`
explícitamente (`route.ts:506`), para que no quede pegada a un "sí".

---

## e) Fecha límite o cierre de votación

🔴 **NO EXISTE.** Comandos usados:
```
grep -rIn "deadline\|expira" src/lib/flow.ts src/app/api/workspace/
```
→ sin resultados en la lógica de votación.

No hay columna de fecha límite en `rr_hub_votes` (migración `20260928_hub_votacion_interna.sql:58-69`).
No hay `expires_at`, ni `closed_at`, ni `votos_hasta`. La votación queda abierta
**indefinidamente** hasta que 3 sí, 3 no, o un `change` la muevan. También se puede cerrar a
mano con la transición `voting → internal_review` (`flow.ts:150-153`), que no tiene requisito
de votos.

---

## f) Política RLS de `rr_hub_votes` — literal

**RLS encendida** (`20260928_hub_cierra_escalada.sql:64`):
```sql
alter table public.rr_hub_votes enable row level security;
```

**Privilegios** (`20260928_hub_cierra_escalada.sql:72-75`):
```sql
revoke all on table public.rr_hub_votes from anon;
revoke insert, update, delete on table public.rr_hub_votes from authenticated;
grant select on table public.rr_hub_votes to authenticated;
grant select, insert, update, delete on table public.rr_hub_votes to service_role;
```

| Operación | `anon` | `authenticated` | `service_role` |
|---|---|---|---|
| SELECT | revocado | **permitido** | permitido |
| INSERT | revocado | **revocado** | permitido |
| UPDATE | revocado | **revocado** | permitido |
| DELETE | revocado | **revocado** | permitido |

🔴 **Revocación posterior que lo cierra más** (`20260928_hub_rls_por_codigo.sql:84`):
```sql
revoke all on public.rr_hub_votes     from anon, authenticated;
```

**Políticas, literales** (`20260928_hub_cierra_escalada.sql:77-90`):
```sql
drop policy if exists rr_hub_votes_read on public.rr_hub_votes;
create policy rr_hub_votes_read on public.rr_hub_votes
  for select to authenticated
  using (true);

drop policy if exists rr_hub_votes_write on public.rr_hub_votes;
-- El voto entra por la API, que usa service role tras comprobar el roster. El
-- cliente no escribe aquí: si lo hiciera, la restricción de "un voto por
-- persona y token" sería solo una sugerencia.
create policy rr_hub_votes_write on public.rr_hub_votes
  for all to authenticated
  using (false)
  with check (false);
```

| Política | Operación | Rol | USING | WITH CHECK |
|---|---|---|---|---|
| `rr_hub_votes_read` | SELECT | `authenticated` | `true` | — |
| `rr_hub_votes_write` | ALL | `authenticated` | `false` | `false` |

⚠️ **La política de escritura es `using (false) with check (false)`: el cliente NUNCA
escribe.** Todo voto entra por la API con `service_role`, que ya checked el roster.

⚠️ **CONTRADICCIÓN documentada en la propia migración** (`20260928_hub_cierra_escalada.sql:66-71`):
> *"RLS no basta por sí solo: mientras `anon` tenga el privilegio de tabla, la petición pasa el
> primer filtro y llega a las políticas. Sin privilegio, se queda en la puerta."*

**Comment de la tabla** (`20260928_hub_votacion_interna.sql:81-85`):
> `'Votos internos de ideas. Identidad por token opaco, no por sesion: el hub esta abierto.'`
>
> `'Token opaco generado en el navegador. NO es un email ni un user_id: es un identificador de votante.'`

---

## g) Qué ve la UI

Componente: `src/components/idea-voting.tsx`. Los 4 botones, con su texto literal:

| Botón | Icono `IconName` | Texto literal | Ayuda literal |
|---|---|---|---|
| 1 | `pulgar-arriba` | `SÍ, SALE` | `Tu sí. Hacen falta ${VOTOS_NECESARIOS} para que decida.` |
| 2 | `pulgar-abajo` | `NO` | `No sale. No es lo mismo que pedir un cambio.` |
| 3 | `si-pero` | `SÍ, PERO CÁMBIALE ALGO` | `Ni sí ni no. Vuelve a revisión interna para aplicar tu cambio.` |
| 4 | `nota` | `DEJAR UNA NOTA` | `Aporta sin contar como voto ni detener la votación.` |

**Etiquetas del campo de texto** (`idea-voting.tsx`): `// QUÉ HAY QUE CAMBIAR` (cuando
`change`) y `// TU NOTA PARA EL EQUIPO` (cuando `note`).

**Emojis por persona** (`idea-voting.tsx:338-343`), literales:
```ts
const TONO_EMOJI: Record<DecisionVoto, { icono: IconName; clase: string; titulo: string }> = {
  yes:    { icono: 'pulgar-arriba', clase: 'text-orquidea',   titulo: 'Sí, que sale' },
  no:     { icono: 'pulgar-abajo',  clase: 'text-blanco-50',  titulo: 'No' },
  change: { icono: 'si-pero',       clase: 'text-mostaza',    titulo: 'Sí, pero cámbiale algo' },
  note:   { icono: 'nota',          clase: 'text-blanco-30',  titulo: 'Nota, no cuenta como voto' },
};
```
Con `aria-label="Votos de cada persona"` en el contenedor (`idea-voting.tsx:183`).
Comentario que explica la decisión: *"Un '3' no dice si son tres pulgares o tres cambios
pedidos; tres manos sí."*

**El contador va con palabras además de cifras** (`idea-voting.tsx:157-172`):
- lado a favor: `a favor` / `sale si gana`
- lado en contra: `en contra` / `deja la idea parada`
- línea de incompletud: `· FALTAN {faltan}` en color mostaza

**Textos literales de respuesta al votar** (`idea-voting.tsx:116-135`):
- `Tu nota quedó con el equipo. No cuenta como voto ni detiene la votación.`
- `Tu voto quedó registrado. Falta${faltanAhora === 1 ? '' : 'n'} ${faltanAhora} voto${faltanAhora === 1 ? '' : 's'} para que la votación decida ...`

**Texto de la guía de flujo** (`src/components/flow-guide.tsx:175`):
> `Una idea sale al cliente cuando hay {VOTOS_NECESARIOS} votos a favor.`

Y (`flow-guide.tsx:196`):
> `interna para aplicar lo que pediste. No cuenta como voto en contra: no la tira, la devuelve. Y ...`

🔴 **La rama `voto-en-tarjeta` NO está en la rama actual.** Existe como referencia remota:
`remotes/origin/voto-en-tarjeta`. **NO VERIFICADO** si está mergeada: el comando
`git log --all --oneline -S 'voto-en-tarjeta'` devolvió vacío, y no hice merge ni checkout.
En la rama actual la votación vive **solo dentro de la ficha de la idea**
(`idea-voting.tsx`), no en la tarjeta del tablero.

Hay un test que **verifica que la tarjeta NO vota**: `src/lib/votar-sin-abrir-la-ficha.test.ts:95-96`
```ts
expect(rapido).not.toMatch(/voterToken:/);
expect(panel).not.toMatch(/voterToken:/);
```

---

## Tabla de cierre

| Dato pedido | Estado | Fuente |
|---|---|---|
| a) Ruta, método, auth, body, códigos | **ENCONTRADO** — `/api/workspace/vote`, POST | `route.ts:180`, `418-634` |
| b) Quién puede votar por rol | **ENCONTRADO — la ruta NO consulta el rol** | `route.ts:471-489`, `flow.ts:92` |
| c) Quórum y las 4 decisiones | **ENCONTRADO — 3, ambos lados, cambio solo** | `flow.ts:276`, `292-309`, `386-399` |
| d) Constraint anti-doble-voto | **ENCONTRADO — `unique (idea_id, voter_token)`** | `20260928_hub_votacion_interna.sql:68` |
| d) ¿Cambiar voto? ¿Retirarlo? | **ENCONTRADO — cambiar sí; retirar NO ENCONTRADO** | `route.ts:500-509` |
| e) Fecha límite de votación | **ENCONTRADO — NO EXISTE** | grep `deadline\|expira` sin resultado |
| f) RLS de `rr_hub_votes` | **ENCONTRADO — SELECT sí, escritura por API** | `20260928_hub_cierra_escalada.sql:64-90`, `20260928_hub_rls_por_codigo.sql:84` |
| g) Qué ve la UI | **ENCONTRADO — 4 botones, emoji por persona** | `idea-voting.tsx:157-343` |
| g) Rama `voto-en-tarjeta` | **NO VERIFICADO si está mergeada** | `remotes/origin/voto-en-tarjeta` existe; no hice checkout ni merge |

**CONTRADICCIONES detectadas (3):**
1. `SOLO_MIRA_EN_EL_VOTEO = ['client_viewer']` (`flow.ts:92`) sugiere un filtro por rol que la ruta `vote` **no aplica**: basta con estar en `rr_hub_profiles` con `is_team_member` e `is_active`.
2. La restricción `unique (idea_id, voter_token)` es **por navegador, no por persona**: la misma persona en dos dispositivos vota dos veces. No existe `unique (idea_id, voter_email)`.
3. El comentario de `rr_hub_votes` dice *"Identidad por token opaco, no por sesion: el hub esta abierto"* (`20260928_hub_votacion_interna.sql:82`), pero la ruta sí exige sesión con correo (`route.ts:471-473`).

---
*BLOQUE 2 COMPLETO. Archivo: `docs/qa-insumos/BLOQUE_02_votacion.md`*
