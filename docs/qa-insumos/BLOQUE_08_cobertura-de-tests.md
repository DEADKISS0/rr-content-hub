# BLOQUE 08 — Lo que ya está cubierto por tests

> Fuente: lectura literal en la rama `pausa-visible`, commit `6b836c1` (2026-10-01).
> Comandos: `find src e2e -name '*.test.*' -o -name '*.spec.*'` → **53 archivos**
> (43 unitarios en `src/`, 10 e2e en `e2e/`).
> Ejecuciones medidas en esta corrida: `npm test` y las 7 suites de `npm run verify`.

**Este bloque existe para que el QA manual NO repita lo que ya está automatizado.**

---

## a) Los 43 archivos de `src/`, uno por uno

| Archivo | Qué comportamiento prueba |
|---|---|
| `src/lib/flow.test.ts` | cada estado vive en una columna y en una fase; el cliente puede decidir solo cuando la pelota es suya; el cliente no puede tocar un borrador; todo movimiento viene explicado; `waitingOn` siempre responde; `nextStatus` de `closed` es `null` |
| `src/lib/votacion.test.ts` | el mínimo son 3, en cada lado por separado; 1 a favor NO aprueba (el fallo medido en producción); 2 a favor tampoco; 3-0 sí; un empate no aprueba; con la votación vacía faltan 3 |
| `src/lib/voto-cambio.test.ts` | `change` y `note` no cuentan para el mínimo; un solo cambio pedido frena la votación aunque haya sí; la nota se exige en la base |
| `src/lib/manos-voto.test.ts` | el voto se pinta como emoji por persona, no como número; 4 tonos distintos |
| `src/lib/votar-sin-abrir-la-ficha.test.ts` | el tablero NO vota: ni la tarjeta rápida ni el panel envían `voterToken` |
| `src/lib/equipo.test.ts` | mirar no es votar: `client_viewer` queda fuera del conteo; comentar es de los 9, incluido quien solo mira; escribir guion no es de quien aprueba; las listas son de roles que existen |
| `src/lib/esperas.test.ts` | el total de espera sale de `esperarCliente + esperarEquipo`; "abiertas" y "esperando" no son lo mismo; cerrado y publicado no esperan; un estado inventado no espera a nadie |
| `src/lib/borrar-idea.test.ts` | solo Dirección borra; borrar es más restrictivo que editar; ni el que aprueba ni el que mira pueden; nunca en `voting`, ni aprobada, ni publicada; el archivado usa `.is()` y no `.eq(..., null)` |
| `src/lib/idea-origen.test.ts` | el origen no se deduce de `created_by`; el cliente de UI no manda origen en absoluto; el servidor decide; el tablero filtra por origen y `undefined` cuenta como del equipo; la tarjeta muestra la categoría |
| `src/lib/firma-sesion.test.ts` | 🔴 el literal publicado NO aparece en el archivo; no hay default para `HUB_SECRET` (ni con `\|\|` ni con `??`); la app no arranca sin secreto; rechaza secreto corto; rechaza la cookie firmada con el literal publicado; acepta la firmada con la clave real |
| `src/lib/hub-session.test.ts` | crear y leer la cookie; el formato tiene 2 partes; la firma es HMAC-SHA256 |
| `src/lib/rate-limit.test.ts` | deja pasar los primeros intentos; al pasarse no pasa más; la ventana se pasa sola; un acierto limpia; dos orígenes separados; 🔴 la respuesta del límite es la MISMA que la de un código malo; el `Retry-After` va en cabecera, no en el cuerpo; una cuenta vencida se poda |
| `src/lib/puerta.test.ts` | hay un botón por cliente; el botón NO entra; el número NO aparece escrito en pantalla; cada casilla es un dígito; sin sesión va al login, no a un cartel de error |
| `src/lib/puerta-clientes.test.ts` | las 2 puertas separadas; un código no abre el otro |
| `src/lib/puerta-regla.test.ts` | la regla de que el código no se escribe en el bundle |
| `src/lib/cambiar-cliente.test.ts` | exige sesión; NO acepta código; el correo es lo que decide; valida contra la lista de conocidos; firma igual que la puerta; 🔴 filtra por `user_id`, NO solo por proyecto; el perfil se resuelve antes que la fila de acceso; devuelve el rol del cliente nuevo |
| `src/lib/destino-login.test.ts` | vuelve a la idea si el link venía de una idea; descarta el redirect externo (phishing); no vuelve al propio login (bucle); una idea de otro cliente NO se respeta; limpia query y hash |
| `src/lib/login-next.test.ts` | el parámetro `next` se sanea |
| `src/lib/pwa.test.ts` | el layout declara manifest, iconos y clave de iOS; el manifest lleva los iconos que exigen las plataformas; 🔴 el service worker NUNCA cachea datos vivos; el manifest y los iconos se sirven SIN sesión; la app se abre en la portada, no en un 307; la app instalada no ofrece reinstalar y en iOS explica el camino |
| `src/lib/project-guard.test.ts` | los roles del guard son los de `flow.ts`; si se desincronizan, el test falla |
| `src/lib/roadmap.test.ts` | las fechas se calculan, no se escriben; una sesión de graduación al mes; el tipo `Pillar` no cambia |
| `src/lib/roadmap-cliente.test.ts` | el plan se busca por slug; si el cliente no tiene plan, se lo dice y NO enseña el de otro |
| `src/lib/fecha-salida.test.ts` | la acción `update` acepta `dueAt` y `publishedUrl`; la fecha se valida como fecha, no como texto libre; la UI ya no dice que la migración no está aplicada |
| `src/lib/fecha-visible.test.ts` | la ficha y la cola muestran la fecha; el servidor la trae y el mapa la copia; no se pinta el ISO crudo |
| `src/lib/fecha-llega-al-componente.test.ts` | `mapIdea` copia la fecha; no la convierte en cadena vacía; la consulta pide la columna; ningún aserto mira solo el `select` |
| `src/lib/formato-fecha.test.ts` | el formato de la fecha en pantalla |
| `src/lib/firma-imagen.test.ts` | reconoce PNG, JPEG, GIF, WebP y AVIF por sus bytes; un HTML que dice ser PNG no entra; un script, un PDF y un ZIP tampoco; la lista es la misma que la del bucket |
| `src/lib/embed-instagram.test.ts` | distingue reel de post; el permalink del reel va con `/reel/`, no con `/p/`; el token `?stkn=` no se le pasa; ningún nombre de cliente está escrito a mano |
| `src/lib/embed-facebook-ads.test.ts` | existe la función que explica por qué no se puede embeber; devuelve TEXTO, no booleano; el aviso dice que el anuncio se ve igual abriendo el link; hay una imagen de respaldo |
| `src/lib/embed-estado.test.ts` | el embed tiene 4 estados, no un sí/no; decide con el `postMessage` de la plataforma; `MEASURE` es la señal real; un mensaje ilegible no rompe el indicador; expone el estado en el DOM para poder verificarlo |
| `src/lib/ad-relacion.test.ts` | `getIdeas` no pide embeds anidados sin foreign key; pide `ad_id`; distingue "no hay ideas" de "no se pudo consultar" |
| `src/lib/idea-cover.test.ts` | la portada llega a la tarjeta; la validación del tipo de imagen |
| `src/lib/portada-en-ficha.test.ts` | la portada se ve en la ficha, no solo en el listado |
| `src/lib/referencia-todas.test.ts` | todas las referencias se ven, no solo la primera |
| `src/lib/reference.test.ts` | el patrón de referencia embebida |
| `src/lib/flujo-ficha.test.ts` | la ficha ofrece la transición que el estado permite; el rol lo decide el servidor |
| `src/lib/workspace-client.test.ts` | `buildIdeaPack` genera un brief determinista; los helpers reportan el estado cuando falta configuración |
| `src/components/presencia-equipo.test.ts` | sin latido nunca es "conectado"; dentro de la ventana de 5 min está conectado; justo pasado el límite deja de estarlo; una fecha corrupta no dice "conectado" |
| `src/lib/not-found.test.ts` | las páginas que no existen dan 404 y no 500 |
| `src/lib/pantallas-honestas.test.ts` | las pantallas sin datos lo dicen en voz alta, con el motivo |
| `src/lib/tour-sale-siempre.test.ts` | la guía se abre sola la primera vez; saltarla la marca vista; avanza botón por botón y se cierra con Escape |
| `src/lib/generador-pausa.test.ts` | el generador avisa cuando frena, y genera la mitad |
| `src/lib/format.test.ts` | formato de valores |

---

## b) `e2e/hub.spec.ts` — 13 bloques, 28 tests

El prompt pide 6. Hay **28 tests en 13 `describe`**. Se executionaron 3 skip por falta de
sesión.

| # | Bloque (`describe`) | Test | Qué verifica |
|---|---|---|---|
| 1 | `tablero` | una sola acción para crear y ningún hueco vacío | que no haya un botón muerto ni una columna vacía |
| 2 | `búsqueda` | el buscador está a la vista sin abrir nada | no está escondido en un menú |
| 3 | `búsqueda` | el atajo `/` lleva al buscador y escribir filtra en vivo | filtro sin botón |
| 4 | `búsqueda` | buscar abre solo el tablero completo, sin dejar el contador solo | el contador no miente |
| 5 | `colas` | la cola abre por lo que más lleva parado | orden por antigüedad |
| 6 | `colas` | las pantallas sin base lo dicen en voz alta | honestidad del estado vacío |
| 7 | `ficha de pieza` | la acción va arriba y el rol lo decide el servidor | la UI no promete lo que el server no da |
| 8 | `cambios de estado` | un movimiento pide confirmación y se puede cancelar sin tocar nada | no hay movement irreversible de un clic |
| 9 | `roadmap` | las tres pistas no muestran el mismo avance | las 3 ventanas se calculan distinto |
| 10 | `portero de acceso` | el panel de administración no se abre a quien solo tecleó un código | el 404, no 403 |
| 11 | `portero de acceso` | con un administrador, el panel se abre y trae el roster entero | el camino bueno |
| 12 | `crear una idea` | el brief se lee ANTES de guardar, no escondido detrás de un desplegable | el brief es visible |
| 13 | `crear una idea` | pegar un reel muestra el video real en un iframe y arma un brief específico | el embed funciona |
| 14 | `crear una idea` | un enlace inválido se dice antes de intentar guardar | validación |
| 15 | `modo guía` | se abre sola la primera vez y explica el primer botón | la guía aparece |
| 16 | `modo guía` | saltarla la marca vista: no vuelve a saltar sola en la pantalla siguiente | no molesta dos veces |
| 17 | `modo guía` | avanza botón por botón y se cierra con Escape | teclado y foco |
| 18 | `modo guía` | en la ficha explica la acción, el preview y el brief | contexto |
| 19 | `la pieza se puede mover` | la referencia aparece UNA sola vez, en el iframe de abajo | no duplica |
| 20 | `la pieza se puede mover` | la ficha ofrece la transición que el estado permite | la matriz se refleja |
| 21 | `la pieza se puede mover` | el pie firma RR Aliados y es alcanzable en móvil | móvil |
| 22 | `la pieza se puede mover` | la página de creación se abre y el botón responde | 🔴 **CREA UNA IDEA REAL** |
| 23 | `modo abierto` | el header no pide entrar ni perfil | la portada es pública |
| 24 | `modo abierto` | nada en el hub manda a otro proyecto | aislamiento entre clientes |
| 25 | `la página nunca se bloquea` | responde 200 con el formulario en pantalla | ninguna página cae |
| 26 | `la página nunca se bloquea` | no hay ni botón de Google ni campo de contraseña ni correo | la puerta es solo el código |
| 27 | `la puerta no te saca de aquí` | el destino de vuelta es siempre una ruta de este sitio | anti-phishing |
| 28 | `la puerta no te saca de aquí` | el código de un cliente no abre el otro | aislamiento |

### Los otros 9 archivos de `e2e/`

| Archivo | Tests | Qué cubre | Saltados |
|---|---|---|---|
| `aprobaciones-desbloqueadas.spec.ts` | 2 | el tablero separa la espera del cliente de la del equipo; una pieza que espera al cliente se puede desbloquear | 1 |
| `assign-owner.spec.ts` | 2 | el bloque nombra a alguien real del roster; asignar NO cambia la fase | 0 |
| `auditoria-movil.spec.ts` | 1 | ficha en móvil: un iframe, transiciones vivas, pie con marca | 0 |
| `biblioteca-anuncios.spec.ts` | 3 | la zona se ve sin anuncios; con anuncios: se abre, busca, rellena; el buscador no pisa un título escrito | 🔴 **3 de 3** |
| `boton-guia-no-tapa.spec.ts` | 1 | la barra de la guía es opaca y deja leer el final de la ficha | 0 |
| `ficha-reordenada.spec.ts` | 3 | la acción y la referencia se ven sin scroll; el encuadre se adapta al formato; la referencia no se come la pantalla | 0 |
| `idea-editor.spec.ts` | 4 | el botón dice qué falta según la pieza; la referencia actual viene cargada al editar; un link roto da aviso arriba; el editor se lee en el teléfono | 0 |
| `tablero-movil.spec.ts` | 2 | las dos esperas no se desbordan; la ficha de una pieza real se lee en móvil | 0 |
| `votacion-interna.spec.ts` | 2 | una pieza en `voting` muestra el contador y los dos botones; **votar de verdad** | 🔴 3 skips |

🔴 **48 tests e2e en total, y 10 hay `test.skip`** (4 archivos). Con la puerta cerrada, la
suite e2e corre "verde" sin haber probado nada de lo que necesita entrar. El motivo queda
escrito en el salto, que es lo correcto, pero el número hay que tenerlo presente: **verde aquí
no significa cobertura.**

Desglose de los 10 skips: `hub.spec.ts` 3 · `biblioteca-anuncios.spec.ts` 3 ·
`votacion-interna.spec.ts` 3 · `aprobaciones-desbloqueadas.spec.ts` 1.
🔴 En `votacion-interna.spec.ts` hay 3 `test.skip` para 2 tests: uno es el guard de
`HUB_E2E_VOTAR`, otro el de `HUB_E2E_AUTH`.

🔴 **`biblioteca-anuncios.spec.ts` se salta entero (3 de 3).** La biblioteca de anuncios
**no tiene ninguna prueba ejecutable** sin `HUB_E2E_AUTH`.

🔴 **`hub.spec.ts:22` lo admite sobre sí mismo, literal:**
> *"Dos recorridos pulsaban VOTO A FAVOR y GUARDAR sobre piezas reales; con el hub apuntando a
> producción, cada `npx playwright test` movía el estado de una pieza de Wundeer."*

Y `votacion-interna.spec.ts:51-55`:
```ts
test('votar de verdad: solo con HUB_E2E_VOTAR=1', async ({ page }) => {
  test.skip(!process.env.HUB_E2E_VOTAR,
    'ESCRIBE en rr_hub_votes y puede mover la pieza de estado. Pásale HUB_E2E_VOTAR=1 si lo quieres.',
```

---

## c) Las 7 suites de `npm run verify` — 177 comprobaciones

**Medido en esta corrida**, cada suite por separado:

| Suite | PASS | FAIL | exit | Archivo |
|---|---|---|---|---|
| `verify:writes` | 48 | 0 | 0 | `verify-writes.mjs` (238 líneas) |
| `verify:states` | 1 | 0 | 0 | `verify-no-hardcoded-states.mjs` |
| `verify:flow` | 54 | 0 | 0 | `verify-flow.mts` (190 líneas) |
| `verify:api` | 12 | 0 | 0 | `verify-api.mjs` (54 líneas) |
| `verify:admin` | 15 | 0 | 0 | `verify-admin.mjs` (64 líneas) |
| `verify:migration` | 32 | 0 | 0 | `verify-migration.mjs` (99 líneas) |
| `verify:roadmap` | 15 | 0 | 0 | `verify-roadmap.mts` (40 líneas) |
| **TOTAL** | **177** | **0** | — | — |

⚠️ Las 177 salen de `grep` de `check(`/`test(`/`assert(` en los archivos: 236 coincidencias
literales. El conteo real de PASS que reporta el runner es 177. **NO VERIFICADO** por qué
difieren: no lo medí. La cifra que importa es **177 PASS, 0 FAIL**.

**Qué comprueba cada una, agrupado:**

### `verify:flow` (54) — el motor de estados, la suite más grande
- Los 15 estados están en `STATUS_ORDER`; cada uno pertenece a una fase y tiene entrada en `STATUS_OWNERS`
- Toda transición apunta a un estado válido; **todo estado no terminal tiene salida**
- `publisher` y `media_buyer` pueden cerrar una pieza publicada; **el editor NO**
- El cliente puede pedir cambios de guion, y eso **no vuelve a `needs_changes`**
- Desde `draft` se entra a revisión interna, **nunca al cliente**
- El cliente no puede saltarse desde revisión interna sin pasar por `voting`
- Las colas usan estados válidos; ningún estado está en dos colas salvo la frontera
- `waitingOn` responde siempre; una pieza cerrada no espera a nadie
- `nextStatus` de `draft` es `internal_review`; de `closed` es `null`; nunca devuelve un estado inexistente
- `internal_review` y `voting` **no esperan al cliente**
- Un visitante no vota ni mueve la idea en revisión interna
- Pauta puede abrir la votación
- El mínimo son 3; mayoría simple con mínimo: 1-0 NO gana, 2-0 TAMPOCO, 3-0 gana

### `verify:writes` (48) — que nada escriba en el cliente
- Que ninguna escritura vaya a las tablas del CRM heredado
- Que las escrituras passen por `/api/workspace`
- Que el generador mande la cabecera `x-rr-origen` (regex literal, `verify-writes.mjs:142`)
- Que no haya un `.eq(..., null)` contra `archived_at`
- Que no haya estados escritos a mano en los componentes

### `verify:migration` (32) — que el repo y la base estén parejos
- Que cada tabla que el código usa exista en las migraciones
- Que las columnas que se leen estén declaradas
- Que las políticas RLS esperadas estén

### `verify:admin` (15) — la puerta de `/audit/admin`
- `admin-guard.ts` existe y es solo-servidor (`import 'server-only'`)
- `requireAdmin` devuelve un veredicto, no un booleano
- No distingue entre no-sesión y no-admin en la respuesta
- Admin exige `global_role = admin`; **no acepta roles de proyecto**
- Hay un camino de vuelta: `SUPER_ADMIN_EMAILS`

### `verify:roadmap` (15) — las fechas del plan
- Que el plan se calcule desde `ROADMAP_START_ISO` y no tenga fechas escritas
- Que la cadencia sea mensual
- Que un cliente sin plan no vea el de otro

### `verify:api` (12) — el contrato de las rutas
- Que los métodos exportados coincidan con lo que la UI llama
- Que las rutas de lectura y escritura estén separadas

### `verify:states` (1)
- Un solo script: que no haya estados escritos a mano fuera de `flow.ts`

---

## d) Áreas con CERO cobertura

**Medido con: ¿el nombre de la función, la acción o la ruta aparece en algún archivo de test?**

### Funciones con 0 archivos que las mencionen

| Función | Dónde vive | Por qué importa |
|---|---|---|
| 🔴 **`requireAdmin`** | `admin-guard.ts:42` | **la función que decide si alguien ve el roster completo.** `verify:admin` comprueba que el ARCHIVO cumple reglas, no que la FUNCIÓN funciona. **NO hay un solo test que la ejecute** |
| 🔴 **`looksLikeUrl`** | `workspace-client.ts:514` | la validación de la referencia del cliente |
| 🔴 **`validateAssetPath`** | `route.ts:895` | **decide si un archivo se puede registrar en una idea.** Sin test: nadie sabe si un `../` de otro cliente cuela |
| 🔴 **`saneaNombre`** | `subir/route.ts:155` | la única defensa contra escribir fuera del bucket |

⚠️ `verify:admin` lee el archivo con `read()` y hace regex. Es una prueba de que la **fuente**
tiene la forma correcta, no de que la **función** devuelva lo correcto. Es una distinción
importante para el QA: un cambio de lógica que mantenga el texto pasa el test.

### Acciones de la API que ningún test menciona

| Acción | Línea | Test que la toca |
|---|---|---|
| 🔴 **`create-idea`** | `route.ts:991-1103` | **0 archivos** — 112 líneas sin una sola prueba |
| 🔴 **`transition`** | `route.ts:204-230` | **0 archivos** — el corazón del flujo |
| 🔴 **`resolve-comment`** | `route.ts:846-862` | **0 archivos** |
| `update` | `route.ts:271` | 2 (`fecha-salida.test.ts`) |
| `assign` | `route.ts:768` | 1 (`borrar-idea.test.ts`) |
| `comment` | `route.ts:829` | 1 (`hub.spec.ts`) |
| `asset` | `route.ts:864` | 4 (ninguno de la acción en sí) |
| `vote` | `route.ts:418` | 5 (dominio, no la ruta) |
| `script` | `route.ts:232` | 14 (mayoría menciona la palabra, no la acción) |
| `borrar` | `route.ts:699` | 7 |
| `roster` | `route.ts:192` | 3 e2e |

🔴 **`transition` y `create-idea` no tienen ni una prueba.** `verify:flow` comprueba que la
MATRIZ es correcta; `hub.spec.ts:20` comprueba que la ficha OFRECE la transición. **Nadie
comprueba que la ruta la ejecute.** Si el servidor devuelve 403 cuando debería devolver 200,
todos los tests siguen verdes.

### Rutas de los bloques 1-5 sin cobertura real

| Ruta | Test que la menciona | Realidad |
|---|---|---|
| `/[projectSlug]/ideas/[ideaId]` (transicionar de verdad) | 18 archivos | 🔴 **ninguno pulsa la transición y verifica que la base cambió** |
| `/[projectSlug]/ideas/nueva` (crear de verdad) | `hub.spec.ts:22` | 🔴 **crea una idea real y la limpia con un script aparte** |
| `/metricas` | 2 | ninguna prueba de los contadores |
| `/perfil` | 1 | ninguna prueba de la tabla de roles — y ya sabemos que está mal |
| `/roadmap` | 3 | las fechas sí; el caso "sin plan" no |
| `/audit/admin` (con admin real) | `hub.spec.ts:355` | el test bueno está saltado sin `HUB_E2E_NOADMIN_STATE` |
| `/admin` | 1 | ninguna prueba del redirect |
| `/api/subir` | 0 | 🔴 **la subida de archivos no tiene ni un test** |
| `/api/archivo` | 0 | 🔴 la comprobación de existencia no tiene test |
| `/api/presencia` | 0 | la ventana se prueba en `presencia-equipo.test.ts`, no el endpoint |
| `/api/entrar` (rate limit en vivo) | 0 | `rate-limit.test.ts` prueba la FUNCIÓN, no la ruta |
| `/api/cambiar-cliente` | `cambiar-cliente.test.ts` | 14 tests, pero leen el archivo, no lo ejecutan |

### Lo que sí está bien cubierto, para no repetir

✅ **El dominio del flujo: 54 + 43 tests.** Estados, fases, transiciones, quórum, decisión de
votación, esperas, borrado, origen. **Esta es la parte mejor probada del repo.**

✅ **La seguridad estática: `firma-sesion.test.ts` + `verify:admin` + `rate-limit.test.ts`.**
Cubren el incidente de la clave publicada, el 404 en vez de 403, y el oráculo del código.

✅ **La PWA: `pwa.test.ts` con 9 tests**, incluido *"el service worker NUNCA cachea datos
vivos"* — que es exactamente la causa del fallo de la app instalada.

✅ **El móvil: 3 specs completos** (`auditoria-movil`, `tablero-movil`, `ficha-reordenada`).

✅ **La honestidad de las pantallas: `pantallas-honestas.test.ts` + `not-found.test.ts`.**

---

## Tabla de cierre

| Dato pedido | Estado | Fuente |
|---|---|---|
| a) Lista de `*.test.*` y `e2e/` | **ENCONTRADO — 53 archivos** | `find src e2e` |
| a) Qué prueba cada archivo unitario | **ENCONTRADO — 43 filas** | títulos de los `it()` |
| b) Los 6 recorridos de `hub.spec.ts` | **ENCONTRADO — hay 28 tests, no 6** | `e2e/hub.spec.ts` |
| c) Las 7 suites de `verify` | **ENCONTRADO — 177 PASS, 0 FAIL** | corrida medida |
| d) Áreas con cero cobertura | **ENCONTRADO — 15 filas** | grep sobre los 53 archivos |
| d) `create-idea` sin test | **ENCONTRADO — 0 archivos** | `route.ts:991-1103` |
| d) `transition` sin test | **ENCONTRADO — 0 archivos** | `route.ts:204-230` |
| e2e ejecutados sin sesión | **ENCONTRADO — 10 `test.skip` en 4 archivos** | `test.skip` en los specs |
| `biblioteca-anuncios` | **ENCONTRADO — 3 de 3 saltados** | `spec.ts:57, 74` + 1 más |

**CONTRADICCIONES detectadas (2):**
1. El prompt pide "los 6 recorridos de `e2e/hub.spec.ts`": hay **28 tests en 13 bloques**. El archivo creció y el inventario quedó viejo.
2. `verify:admin` comprueba que el **archivo** `admin-guard.ts` tiene la forma correcta con regex, pero **ningún test ejecuta `requireAdmin`**. Un cambio de lógica que mantenga el texto pasa el verificador.

**NOTA PARA EL QA MANUAL — los 5 puntos donde la automatización NO llega:**
1. Que la transición realmente mueva la pieza en la base (nadie lo prueba)
2. Que crear una idea respete los límites del servidor con datos reales
3. Que subir un archivo de verdad funcione y que `validateAssetPath` no deje colar un `../`
4. Que `requireAdmin` devuelva lo correcto con una sesión real
5. Que el rate limit de `/api/entrar` se active en el servidor, no solo en la función

---
*BLOQUE 8 COMPLETO. Archivo: `docs/qa-insumos/BLOQUE_08_cobertura-de-tests.md`*
