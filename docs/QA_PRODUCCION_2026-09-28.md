# QA de producción — login encendido y superficies nuevas

> Medición: 2026-09-28, contra `https://rr-content-hub.vercel.app` (despliegue de `9fb090a`, el mismo SHA que `main`).
> Sin sesión, salvo donde se dice. Sin escrituras en la base.
> Las cifras de base salen de un `SELECT` de solo lectura por la Management API.

## Veredicto corto

**El contrato de seguridad se cumple entero. La puerta de las páginas va demasiado lejos.**

- 12 de 12 comprobaciones del contrato de auth: **verde**.
- Suite e2e contra producción: **4 pasan, 38 fallan, 4 se saltan**. Los 38 fallos son casi todos
  la misma causa: `NEXT_PUBLIC_AUTH_ENABLED=true` manda a `/login` **todas** las páginas del hub,
  y la suite está escrita para un hub abierto. No es un bug de las pruebas: es una suite que quedó
  desalineada con la decisión de encender la puerta hoy.
- **Un hallazgo de seguridad real y nuevo**: `rr_hub_votes` se creó **sin RLS** y con todos los
  privilegios de `anon` (INSERT/UPDATE/DELETE). Hoy no tiene filas, así que no hay nada que robar,
  pero en cuanto alguien vote, la tabla queda abierta al anon.
- **El test nuevo de biblioteca de anuncios falla en producción** por una razón que no es suya:
  la página `/wundeer/ideas/nueva` ya no se abre sin sesión. Su premisa (el formulario se ve sin
  sesión) la contradice la puerta de hoy.

## 1. Contrato de autenticación (12/12 verde)

Medido con `curl` sin cookies.

| Comprobación | Resultado |
|---|---|
| `/wundeer` sin sesión | 307 → `/login?next=%2Fwundeer` |
| `/wundeer/ideas` sin sesión | 307 → `/login?next=%2Fwundeer%2Fideas` |
| `/login` muestra correo+contraseña | Sí (`TU CORREO`, `TU CONTRASEÑA`, `ENTRAR`) |
| `/login` muestra botón de Google | Sí (`ENTRAR CON GOOGLE`) |
| `/login` muestra "¿No recuerdas la contraseña?" | Sí |
| `/login?sinAcceso=1` muestra el aviso | Sí, texto exacto: "Tu cuenta está bien, pero ese correo no está en la lista del equipo. Escríbele a Dirección para que te agreguen." |
| `/api/ideas` sin sesión | **401** + JSON `{"error":…}` (nunca 307) |
| `/api/workspace` sin sesión | **401** + JSON |
| `/api/workspace/vote` sin sesión | **401** + JSON |
| `/api/presencia` sin sesión | **401** + JSON (nuevo, ver §3) |
| `/` responde 200 | Sí (decisión pendiente, no es bug) |
| Cabeceras: CSP, HSTS, `x-frame-options: DENY`, `frame-ancestors 'none'` | Presentes en las 5 rutas probadas (200, 307, 401) |

**Open redirect: cerrado, y con el caso difícil incluido.** Probado en navegador real, no leyendo
el código. Pulsando "ENTRAR CON GOOGLE" e interceptando la petición a Supabase:

| `?next=` | `redirect_to` que recibe Supabase |
|---|---|
| `/wundeer` | `…/auth/callback?next=%2Fwundeer` |
| `https://evil.example` | `…/auth/callback?next=%2Fselect-project` (descartado) |
| `//evil.example` | `…/auth/callback?next=%2Fselect-project` (descartado) |
| `/\evil.example` | `…/auth/callback?next=%2F%5Cevil.example` — **pasa el filtro** |
| `/%2F%2Fevil.example` | `…/auth/callback?next=%2F%252F%252Fevil.example` (doble-encoded, se queda dentro) |

El caso de la barra invertida es el único que atraviesa `startsWith('/') && !startsWith('//')`.
**No es un redirect abierto**: el `Location` que reconstruye el callback
(`https://rr-content-hub.vercel.app` + `/\evil.example`) lo resuelve un navegador como
`https://rr-content-hub.vercel.app//evil.example` — mismo host, confirmado con `new URL()` en
Chromium. Se queda en el sitio. Pero es un filtro con un hueco Known, y `/%5C…` es lo que lo
delata: conviene añadir `&& !pedido.startsWith('/\\')` en `login/page.tsx:71` y
`auth/callback/route.ts:31`. **No lo cambié: no escribir código era el encargo.**

## 2. Lo que broke hoy: la suite e2e entera

```
4 passed  |  38 failed  |  4 skipped      (10.1m contra producción)
```

Los 38 fallos son, casi sin excepción, el mismo síntoma: el test navega a una página del hub,
el middleware devuelve 307 a `/login`, y el selector nunca aparece.

- **2 tests de login: PASA.** `el botón de Google pide el callback, nunca el destino final` y
  `el callback rechaza un next de otro sitio`. El login está bien.
- **Los otros 2 que pasan** no son de páginas autenticadas.

Tests cuyo nombre afirma una garantía que **hoy es falsa** (o que ya no describe el producto):

| Test | Por qué falla |
|---|---|
| `modo abierto › la página de creación se abre y el botón responde` | El nombre del describe sigue diciendo "modo abierto". Hoy la puerta está encendida y `/wundeer/ideas/nueva` da 307. |
| `la página nunca se bloquea › responde 200 con el formulario en pantalla` | 307 a `/login`. El comentario del propio middleware (líneas 39-45) dice que esta página se abre **siempre** y que la puerta se pide al guardar. **El código dice una cosa y la puerta hace otra.** |
| `modo abierto › el header no pide entrar ni perfil` | El header ahora sí pide entrar. |
| `biblioteca-anuncios › la zona de la biblioteca es visible aunque esté vacía` | Ver §4. |

Los otros 34 (tablero, ficha, roadmap, guía, móvil, editor, asignar responsable, auditoría) fallan
por la misma razón: son recorridos de lectura de páginas que hoy piden sesión.

**Esto es un hallazgo sobre la suite, no sobre la app**: `playwright.config.ts` y el comentario de
cada spec dicen "el hub corre contra el Supabase de producción" y "no escriben en la base real",
pero los tests no tienen noción de sesión. Con la puerta apagada pasaban; encendida, todos caen.
Hace falta una sesión de pruebas (storageState) para que vuelvan a decir algo.

## 3. Superficie nueva: presencia

**Endpoint (401 sin sesión) — correcto.** `POST /api/presencia` sin sesión → 401 JSON. Con GET,
PUT, DELETE, PATCH, OPTIONS también 401: la puerta del middleware cubre `^/api/`, y aunque
`route.ts` solo exporta `POST`, la respuesta es la del gate, no la de Next (un 405). El mensaje
que devuelve es el del middleware, no el `"Necesitas una sesión."` que escribe la ruta: **la ruta
nunca se ejecuta sin sesión**, que es lo correcto.

**El latido sí sale del navegador.** En la página de login (sin sesión) el `Latido` del layout se
monta igual: se ven 3 peticiones `POST /api/presencia` en `performance.getEntriesByType('resource')`
y se genera un `rr-hub-sesion-v1` en localStorage. Las tres reciben 401 y no rompen nada — que es
exactamente lo que dice el componente. Correcto.

**El panel no lo pude ver sin sesión.** `PanelPresencia` se pinta en la ficha de la pieza
(`[projectSlug]/ideas/[ideaId]/page.tsx:114`), debajo de la votación, y la ficha pide sesión.
**No pude probar sin sesión** cómo se ve, si pinta los tres estados o el contador "N de M en línea".

**La base está lista y saneada** (`SELECT` de solo lectura):
- `rr_hub_presencia` existe, RLS **activado**, 4 políticas todas `to authenticated`.
- Filas: 1. Tiene `email`, `profile_id` y `sesion_id`.
- `rr_hub_profiles`: 18 filas, 18 activas (la lista blanca que el middleware exige desde hoy).
- `rr_hub_access`: 36 filas (el problema de "tabla vacía" del 2026-09-27 está resuelto).

⚠️ **La fila de presencia se puede leer con la anon key**: `has_table_privilege('anon', 'rr_hub_presencia', 'SELECT')` = **true**.
Anon ve `[]` porque `rr_hub_presencia_read` es `to authenticated` — el RLS filtra de verdad.
Pero el **GRANT a `anon` está puesto**, igual que en `profiles`. La diferencia
con `profiles` es que ahí el RLS filtra de verdad; aquí el GRANT sobra y solo depende de que nadie
re-otorgue nada. Consistente con lo ya documentado sobre las 3 políticas `to public` inertes:
la prueba dura es el `GRANT`, y aquí el `GRANT` está.

## 4. Bug: `rr_hub_votes` sin RLS y con todos los privilegios de `anon`

**Este es el hallazgo que hay que mirar hoy.** Metadata por Management API, sin escribir nada:

| Tabla | RLS | `anon` SELECT | `anon` INSERT | `anon` UPDATE | `anon` DELETE |
|---|---|---|---|---|---|
| `rr_hub_presencia` | ✅ sí | GRANT sí (filtrado a 0 por política) | — | — | — |
| **`rr_hub_votes`** | ❌ **NO** | ✅ **sí** | ✅ **sí** | ✅ **sí** | ✅ **sí** |
| `rr_hub_ad_library` | ✅ sí | ❌ no | ❌ no | ❌ no | ❌ no |

`information_schema.role_table_grants` confirma los 7 privilegios de `anon` sobre `rr_hub_votes`
(DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE).

**Por qué pasó**: `20260928_hub_votacion_interna.sql` crea la tabla (línea 58) y no lleva
`alter table … enable row level security` ni ningún `grant`/`revoke`. La migración hermana
`20260928_hub_presencia_rls.sql` sí lo hace, en las líneas 13-32. La de votación se quedó a medias.
Supabase da `GRANT` a `anon` por defecto en toda tabla nueva, así que el resultado es una tabla
abierta al anon.

**Impacto hoy**: nulo en datos — `rr_hub_votes` tiene **0 filas** (ninguna pieza está en `voting`).
**Impacto en cuanto haya un voto**: cualquiera con la anon key (que es pública, va en el bundle)
puede insertar, cambiar y borrar votos de cualquier pieza, y leer `voter_email` de todos. Y como
el endpoint `/api/workspace/vote` decide la transición leyendo el conteo
(`route.ts:394-400`), falsear el conteo es falsear el estado de la pieza. No hace falta tocar la
app: va directo a PostgREST.

**Cómo cerrarlo** (no lo ejecuté, no escribe en la base):
```sql
alter table public.rr_hub_votes enable row level security;
revoke all on public.rr_hub_votes from anon;   -- el motor lee con service, no necesita anon
create policy rr_hub_votes_read on public.rr_hub_votes for select to authenticated using (true);
```
`service_role` salta RLS por diseño, así que el endpoint de voto sigue funcionando sin cambios.
**No pude probar sin sesión** que el cierre no rompa la votación: eso necesita a alguien con rol.

## 5. Test nuevo de biblioteca de anuncios: falla, y su premisa es incorrecta

`e2e/biblioteca-anuncios.spec.ts` (nuevo hoy). Resultado: **1 failed, 2 skipped**.

```
1) la zona de la biblioteca es visible aunque esté vacía
   Error: expect(locator).toBeVisible() failed
   Locator: getByRole('button', { name: /BIBLIOTECA DE ANUNCIOS|ELEGIR UN ANUNCIO/i }).first()
   Expected: visible
   Error: element(s) not found
```

La causa no está en el componente: `page.goto('/wundeer/ideas/nueva')` **aterriza en
`/login?next=%2Fwundeer%2Fideas%2Fnueva`** (307), confirmado en navegador. El test se escribió
asumiendo que la página de alta se abre sin sesión.

Eso choca con dos cosas:
1. El comentario del middleware (líneas 39-45) promete explícitamente que **la página de creación
   se abre siempre** y que la sesión se pide al GUARDAR, "donde el aviso puede traer su propio
   botón para entrar sin perder lo escrito". En producción hoy da 307. El comentario describe un
   comportamiento que el código no tiene.
2. `e2e/hub.spec.ts` tiene el mismo supuesto en `la página nunca se bloquea › responde 200 con el
   formulario en pantalla`, que también falla.

Los otros 2 tests del archivo se saltan como estaba previsto (sin `HUB_E2E_AUTH`): el
`test.skip(!process.env.HUB_E2E_AUTH)` está bien puesto.

**No es que la biblioteca esté rota**: no pude ver la zona porque la página no abre sin sesión.
**No pude probar sin sesión** que el aviso de "no hay anuncios cargados" aparezca.

## 6. Test de votación interna: se salta, y está bien saltarse

`e2e/votacion-interna.spec.ts` (reescrito hoy). **1 skipped + 1 skipped**, 0 fallos.

El salto es correcto, pero **por el motivo equivocado**, y conviene saberlo:
- El test de lectura se salta porque `primeraEnVotacion()` devuelve `''`.
- `primeraEnVotacion()` busca una tarjeta con `/VOTACI/i` en `/wundeer/ideas` → esa página pide
  sesión → 0 tarjetas. Y el plan B (`/api/workspace/list`) devuelve **401** sin sesión.
- O sea: se salta por la puerta, no porque no haya piezas en `voting`.

Dato de base (`SELECT` de solo lectura): **hay 0 piezas en `voting`** de 42 en total
(internal_review 15, approved 8, draft 5, needs_changes 3, pending_approval 3, script_in_progress 2,
editing 2, closed 1, ready_to_publish 1, in_production 1). Así que aunque hubiera sesión, el test se
saltaría igual. La reescritura es acertada — ya no depende de un id fijo que no existe — pero hoy
**no está probando nada** y no debe contarse como cobertura.

`voting` sí existe como estado en `flow.ts` (líneas 10, 96-101, 313), con su salida a
`pending_approval` y su `blurb`. El dominio está bien; no hay piezas ahí ahora mismo.

## 7. Lo que NO pude probar

Todo esto necesita sesión, y no la tengo:

- El **panel de presencia** pintado en la ficha: si aparece, si el contador "N de M en línea"
  cuadra, si los tres estados (CONECTADO / ACTIVO / DESCONECTADO) se distinguen.
- La **biblioteca de anuncios** con catálogo real: buscar, elegir, rellenar la referencia, y que no
  pise un título escrito.
- La **votación de verdad**: que los botones aparezcan en `voting`, y que el voto mueva la pieza.
- Que la **lista blanca** (`rr_hub_profiles`, 18 correos) deje entrar a quien es del equipo y rechace
  a un Gmail cualquiera con `sinAcceso=1`. La rama existe en el middleware (líneas 84-104) y el
  aviso se pinta bien cuando se llega por URL, pero **no probé la rama que lo dispara**: la que
  hace `signOut()` y redirige.
- Que la **contraseña+magic link** funcionen de extremo a extremo.
- Que el **cierre de RLS de `rr_hub_votes`** (§4) no rompa la votación.

## Resumen para Santiago

1. **El login funciona y es sólido.** Las tres puertas, el aviso de `sinAcceso`, los 401 JSON, las
   cabeceras, el open redirect. 12/12.
2. **Hay que cerrar `rr_hub_votes` hoy.** Es la única herida real: sin RLS y con `anon` con poder
   de INSERT/UPDATE/DELETE. Hoy la tabla está vacía, así que es barato: es una migración de tres
   líneas y ya.
3. **La puerta se comió la página de alta.** El comentario del middleware dice que `/ideas/nueva`
   se abre siempre y se pide sesión al guardar; en producción da 307. Alguien tiene que decidir
   cuál de las dos cosas es la verdad, porque de esa decisión dependen 2 tests y la experiencia de
   "no carga" que ya se reportó una vez.
4. **La suite e2e ya no describe el producto.** 38 de 46 tests necesitan una sesión de pruebas que
   no existe. La puerta se encendió hoy; la suite se quedó en modo abierto. Sin `storageState`, esa
   suite no vuelve a informar de nada.
5. **Filtro de redirect con un hueco conocido** (`/\evil.example` pasa, aunque se queda en el sitio).
   Dos líneas, cuando se decida.
