# BLOQUE 09 — UI, PWA y texto visible

> Fuente: lectura literal en la rama `pausa-visible`, commit `6b836c1` (2026-10-01).
> Archivos: `src/app/manifest.ts`, `public/sw.js`, `src/app/offline/page.tsx`,
> los 18 `page.tsx` de `src/app/`, `src/components/*` y `src/lib/queues.ts`.

🔴 **CONTRADICCIÓN con el prompt: hay 18 páginas, no 20.**
Comando: `find src/app -name 'page.tsx'` → **18 archivos**.

---

## a) `manifest.webmanifest` y `sw.js`

### `manifest.ts` — literal

| Campo | Valor | Fuente |
|---|---|---|
| `id` | `'/wundeer'` | `manifest.ts:29` |
| `name` | `'RR Content Hub'` | `:30` |
| `short_name` | `'RR Hub'` | `:31` |
| `description` | `'El banco de ideas de RR Aliados: piezas, voting, referencias y produccion, de Wundeer y Candilejas.'` | `:32-33` |
| `lang` | `'es'` | `:34` |
| `dir` | `'ltr'` | `:35` |
| 🔴 **`start_url`** | **`'/login?fuente=app'`** | `:57` |
| `scope` | `'/'` | `:58` |
| `display` | `'standalone'` | `:59` |
| `orientation` | `'portrait-primary'` | `:61` |
| `background_color` | `'#070001'` | `:62` |
| `theme_color` | `'#070001'` | `:63` |
| `categories` | `['productivity', 'business']` | `:64` |
| `export const dynamic` | `'force-static'` | `:26` |

🔴 **`start_url` NO es `/`, y el comentario explica por qué** (`manifest.ts:37-56`):
> *"Con `/wundeer` pasaba esto: la app arranca → el proxy ve que no hay sesión → 307 a
> `/login` → el login no tenía ni un enlace de vuelta. La app quedaba atrapada en la puerta.
> En un iPhone eso se ve como: mantienes el icono pulsado, aparece 'Añadir a pantalla de
> inicio', lo haces... y la app abre en una pantalla de login de la que no se puede salir. Y por
> qué NO es `/`: se comprobó y la portada tampoco sirve sin sesión. `src/app/page.tsx` hace
> `redirect('/login')` cuando no hay cookie (línea 39)"*

⚠️ **CORRECCIÓN IMPORTANTE respecto a lo que te reporté en el documento maestro:** ahí dije
que `start_url` daba 307 sin sesión. **NO: `start_url` es `/login?fuente=app`, que es pública
por diseño.** El problema se arregló. Lo que sí es cierto es que la **portada** `/` redirige
a `/login` sin cookie.

**11 iconos, todos con hash estable** (`manifest.ts:66-79`):
`icono-32`, `icono-96`, `icono-120`, `icono-152`, `icono-167`, `icono-180`, `icono-192`,
`icono-256`, `icono-512`, `maskable-192`, `maskable-512` (los dos últimos con
`purpose: 'maskable'`).

**2 shortcuts** (`manifest.ts:82-95`):
| `name` | `short_name` | `url` |
|---|---|---|
| `Tablero de ideas` | `Tablero` | `/wundeer/ideas` |
| `Entrada` | `Entrada` | `/login` |

🔴 **El shortcut `Tablero de ideas` apunta a `/wundeer/ideas`, que NO es público.** Con la app
instalada y sin sesión, ese atajo da 307 a `/login`. Y con sesión de Candilejas, da 404
(`projects.ts:36-39`). Solo funciona con sesión de Wundeer.

### `public/sw.js` — estrategia de caché

**Constantes, literales:**
```js
const VERSION = 'rr-hub-v1';
const CACHE = `${VERSION}`;
```

**Lo que se precarga (5 rutas)**:
```js
const PRECARGA = [
  '/app/icono-192.png',
  '/app/icono-512.png',
  '/app/maskable-512.png',
  '/app/apple-touch-icon.png',
  '/offline',
];
```

**3 estrategias, por tipo de petición** (`sw.js:70-118`):

| # | Tipo | Estrategia | Fuente |
|---|---|---|---|
| 1 | Navegación (`mode === 'navigate'`) | **RED PRIMERO, SIEMPRE.** Sin red → `/offline` de caché, o 503 | `:78-98` |
| 2 | Armazón (`esArmazon(url)`) | **CACHÉ PRIMERO**, refresca por detrás | `:101-114` |
| 3 | Todo lo demás | **pasa de largo, sin tocar** | `:116-117` |
| — | Todo lo que no sea GET | `return` — ni entra | `:72` |

**La política, literal** (`sw.js:9-20`):
> *"Este hub es una herramienta de trabajo con datos VIVOS: una idea votada, un estado movido o
> una portada subida tienen que verse al instante. Cachear el HTML de las fichas seria un
> descuido que se traduce en 'aprobo algo que ya no es cierto'. [...] Las peticiones a
> Supabase, las API y los embeds de Instagram NUNCA se cachean."*

**Texto de `/offline` que muestra el SW si no hay copia** (`sw.js:93`):
```js
new Response('Sin conexion y sin copia guardada.', { status: 503, ... })
```

**La pantalla `/offline`, literal** (`offline/page.tsx`):
- Título: `Sin conexión`
- Párrafo: `El hub necesita internet: las ideas, los votos y las referencias están vivos en la
  base. En cuanto vuelva, esta pantalla desaparece sola.`
- Lista: `Comprobar la conexión y volver a entrar.` · `Ir a la entrada` (link a `/login`)
  `para cambiar de cliente.`
- Botón: `RECARGAR`

🔴 **El botón es un `<form action="/wundeer">`, no un `<button onClick>`** (`offline/page.tsx:44-48`),
con el motivo literal:
> *"Un boton de React necesitaria JS, y este es justamente el caso sin JS."*

🔴 **PERO `action="/wundeer"` está hardcodeado.** Un usuario de Candilejas, sin conexión, al
pulsar `RECARGAR` aterriza en Wundeer, que le dará 404. **`NO VERIFICADO** si el SW lo
reescribe: no hay reescritura de `/wundeer` en `sw.js`.

**`pwa.test.ts` cubre 9 comportamientos,** incluido
🔴 *"el service worker NUNCA cachea datos vivos"* y *"el manifest y los iconos se sirven SIN
sesion"*.

---

## b) Las 18 páginas: título, acciones, estados vacíos

| # | Ruta | Título / `<h1>` | Acciones principales (literales) | Estado vacío |
|---|---|---|---|---|
| 1 | `/` | sin `<h1>`; `redirect('/login')` sin cookie (`:39`) | — | — |
| 2 | `/login` | `formulario.tsx` (sin `<h1>` propio) | 4 casillas de 1 dígito, botón por cliente, `VOLVER A LA PORTADA` | `respuesta 200 con el formulario en pantalla` |
| 3 | `/select-project` | `Sin clientes disponibles.` | `ABRIR EL MAPA`, `ABRE LA AUDITORÍA` | `Sin clientes disponibles.` |
| 4 | `/no-access` | `Sin acceso` | `VER PROYECTOS`, `VOLVER AL INICIO` | `Sin acceso` |
| 5 | `/[projectSlug]` | (tablero, sin `<h1>` propio) | 5 colas: `IDEAS`, `GUIONES`, `PRODUCCIÓN`, `PUBLICADO`, `DESCARTADAS` | `SIN IDEAS`, `SIN DECIDIR`, `SIN ACCIÓN` |
| 6 | `/[projectSlug]/ideas` | `Banco de ideas` | los mismos 5 filtros de cola | `SIN IDEAS` |
| 7 | `/[projectSlug]/ideas/nueva` | `Nueva idea.` | `CREAR IDEA →` / `GUARDANDO…`, `← VOLVER`, `VER TAMBIÉN EL GUION QUE SE GENERARÁ` | — (es el formulario) |
| 8 | `/[projectSlug]/ideas/[ideaId]` | `{idea.title}` (dinámico) | las 18 transiciones + `FICHA COMPLETA` | `SIN COMENTARIOS`, `SIN ARCHIVOS`, `SIN EVENTOS`, `SIN REFERENCIA` |
| 9 | `/[projectSlug]/aprobaciones` | sin `<h1>` | cola `APROBACIONES` | `SIN ACCESOS` |
| 10 | `/[projectSlug]/produccion` | sin `<h1>` | cola `PRODUCCIÓN` | `SIN ARCHIVOS`, `SIN CAMBIO` |
| 11 | `/[projectSlug]/publicaciones` | `[CÓMO SE PROGRAMA UNA SALIDA]` | cola `PUBLICACIONES` | `SIN MINIATURA`, `SIN SALIDA` |
| 12 | `/[projectSlug]/metricas` | `MÉTRICAS` (en `QueueSection`) | sin acciones | 🔴 `No hay publicaciones registradas todavía. Cuando la primera pieza salga, aquí se cuenta.` |
| 13 | `/[projectSlug]/roadmap` | `Este cliente aún no tiene plan.` | `VOLVER AL TABLERO` | `Este cliente aún no tiene plan.` |
| 14 | `/[projectSlug]/perfil` | `Tu perfil` | `INICIAR SESIÓN` (sin sesión), `← VOLVER AL TABLERO` | `Todavía no tienes un rol asignado en este proyecto. Pídeselo a Dirección y te lo activan.` |
| 15 | `/offline` | `Sin conexión` | `RECARGAR` | — |
| 16 | `/audit` | sin `<h1>` (índice) | — | — |
| 17 | `/audit/admin` | `Equipo y accesos.` | 🔴 **0 acciones** — 6 encabezados de tabla: `NOMBRE`, `CORREO`, `ROL GLOBAL`, `PROYECTOS`, `DESDE`, `ADMIN` | `SIN ADMINISTRADORES VISIBLES.`, `SIN EQUIPO`, `SIN INVITACIONES` |
| 18 | `/audit/[projectSlug]` | `{project.name} en panorama.` | sin acciones | `IDEAS TOTALES`, `EN CURSO` (son métricas, no vacíos) |
| 19 | `/admin` | — | 🔴 **solo `redirect()`** | — |

🔴 **Son 19 filas porque `/admin`redirecta; las páginas reales son 18.**

**Los 5 botones de cola, literales** (`queues.ts:121-125`):
```ts
{ key: 'ideas', label: 'IDEAS', plain: 'Propuesta y decisión del cliente', statuses: byPhase('idea') },
{ key: 'scripts', label: 'GUIONES', plain: 'Escritura y aprobación', statuses: byPhase('script') },
{ key: 'production', label: 'PRODUCCIÓN', plain: 'Rodaje, edición y revisión final', statuses: [...byPhase('shoot'), ...byPhase('edit')] },
{ key: 'published', label: 'PUBLICADO', plain: 'Ya salió a la cuenta', statuses: byPhase('live') },
{ key: 'closed', label: 'DESCARTADAS', plain: 'No salió y no va a salir', statuses: byPhase('closed') },
```

**Los 18 botones de transición, literales** (`flow.ts:141-202`):
`MIRAR EN REVISIÓN INTERNA` · `ABRIR VOTACIÓN` · `IR DIRECTO AL CLIENTE` ·
`CERRAR VOTACIÓN Y MANDAR` · `ABRIR DE NUEVO LA REVISIÓN` · `APROBAR IDEA` ·
`SOLICITAR AJUSTES` · `ARCHIVAR PROPUESTA` · `REENVIAR AL CLIENTE` · `INICIAR GUIÓN` ·
`ENVIAR GUIÓN AL CLIENTE` · `APROBAR GUIÓN` · `PEDIR CAMBIOS AL GUIÓN` · `INICIAR RODAJE` ·
`MARCAR CRUDO CARGADO` · `INICIAR EDICIÓN` · `MARCAR EDICIÓN LISTA` · `APROBAR Y PUBLICAR` ·
`CERRAR FLUJO`

**Los 4 botones de voto, literales** (`idea-voting.tsx:217-249`):
| Texto | Ayuda |
|---|---|
| `SÍ, SALE` | `Tu sí. Hacen{faltan} para que decida.` |
| `NO` | `No sale. No es lo mismo que pedir un cambio.` |
| `SÍ, PERO CÁMBIALE ALGO` | `Ni sí ni no. Vuelve a revisión interna para aplicar tu cambio.` |
| `DEJAR UNA NOTA` | `Aporta sin contar como voto ni detener la votación.` |

**Metadata:** solo 4 páginas declaran `title`. El layout raíz (`layout.tsx:30`): `'RR Content Hub'`.
🔴 **16 de 18 páginas heredan ese título genérico.** Solo `/offline` (`Sin conexión — RR
Content Hub`) y `/[projectSlug]/publicaciones` (`[CÓMO SE PROGRAMA UNA SALIDA]`, que parece
un copy pegado en el sitio del metadata) tienen el suyo.

---

## c) Responsive

**Breakpoints usados, medido** (grep de clases Tailwind):

| Breakpoint | Usos |
|---|---|
| `sm:` | **65** |
| `md:` | **54** |
| `lg:` | **22** |
| `xl:` | **3** |
| `2xl:` | 0 |

**Solo 4 cortes, y el más usado es `sm` (640px).** El diseño es mobile-first: `sm` y `md`
cargan el grueso de las adaptaciones.

🔴 **NO hay vistas separadas para móvil y escritorio.** `src/components/ui/` tiene 8
archivos y **ninguno es una variante móvil**:
`chips.tsx`, `cover.tsx`, `empty-state.tsx`, `icons.tsx`, `idea-cover-frame.tsx`,
`instagram-embed.tsx`, `meter.tsx`, `preview.tsx`

Es un único conjunto de componentes que se adapta con clases. La adaptación móvil se prueba
con **3 specs e2e** (`auditoria-movil`, `tablero-movil`, `ficha-reordenada`) + 1
(`boton-guia-no-tapa`), que es donde hay que mirar.

**`ficha-reordenada.spec.ts` prueba 3 cosas del encuadre móvil**, literalmente:
- `la acción y la referencia se ven sin hacer scroll`
- `el encuadre se adapta al formato y no desperdicia ancho`
- `la referencia no se come la pantalla`

---

## d) Notificaciones, toasts y confirmaciones

**Los 7 textos de éxito/error de cliente, literales** (grep de `setAviso`, `setNotice`):

| Texto | Componente |
|---|---|
| `✓ Comentario publicado en el hilo compartido.` | comentarios |
| `✓ Guion guardado correctamente` | editor de guion |
| `Aprobada. La idea ya pasó a revisión del cliente.` | idea |
| `La votación se decidió en contra. La idea vuelve a revisión interna.` | votación |
| `No se pudo contactar al servidor. Revisa la conexión e inténtalo otra vez.` | cliente |
| `No se pudo generar el enlace del archivo.` | archivos |
| `Tu nota quedó con el equipo. No cuenta como voto ni detiene la votación.` | votación |

**Los 7 avisos de error con `role="alert"`, literales:**

| Dónde | Mensaje | Archivo:línea |
|---|---|---|
| login | (dinámico) | `login/formulario.tsx:152` |
| selector de cliente | (dinámico) | `selector-cliente.tsx:244` |
| editor de idea | (dinámico) | `idea-editor.tsx:171` |
| votación | (dinámico) | `idea-voting.tsx:320` |
| asignar responsable | (dinámico) | `assign-owner.tsx:155` |
| crear idea | `Falta el título o el objetivo.` / `La referencia debe ser un enlace válido (https://…).` / `No se pudo identificar el cliente de esta idea. Recarga la página.` | `new-idea-form.tsx:102` |
| referencia inválida | 🔴 `Ese texto no parece un enlace válido. Debe empezar por https://` | `new-idea-form.tsx:144` |

**Confirmación de movimiento** (`hub.spec.ts:8`):
> `un movimiento pide confirmación y se puede cancelar sin tocar nada`

🔴 **`NO ENCONTRADO** el texto literal de esa confirmación: no está en un componente, la
prueba comprueba que aparece, no qué dice. **`NO VERIFICADO** cuál es.

🔴 **`NO HAY UN SOLO TOAST.** No existe componente `toast`, ni `snackbar`, ni `notification`.
Los 7 avisos son `<p>` o `<div>` con `role="alert"` que se montan y se desmontan. No hay
pila, no hay animación de salida, no hay "deshacer".

**El único `role="dialog"`** (`guided-tour.tsx:239`):
```tsx
<div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="guia-titulo">
```

---

## e) Accesibilidad visible

**Inventario medido de `aria-*` en todo `src/`:**

| Atributo | Veces |
|---|---|
| `aria-label` | **39** |
| `aria-hidden` | 31 |
| `aria-pressed` | 5 |
| `aria-labelledby` | 5 |
| `aria-expanded` | 5 |
| `aria-live` | 4 |
| `aria-disabled` | 3 |
| `aria-current` | 3 |
| `aria-selected` | 2 |
| `aria-modal` | 1 |
| `aria-haspopup` | 1 |

**Componentes con más `aria-*`:** `selector-cliente.tsx` (9), `login/formulario.tsx` (8),
`board-controls.tsx` (7), `roadmap-view.tsx` (5), `guided-tour.tsx` (5), `workspace-shell.tsx` (5).

**Lo que SÍ está implementado:**

✅ **`aria-pressed`** en los 5 filtros de cola del tablero (5 = exactamente el número de colas)
✅ **`aria-expanded`** en los 5 sitios que abren un panel
✅ **`aria-label` en el voto por persona** (`idea-voting.tsx:184`):
```tsx
aria-label="Votos de cada persona"
```
con `aria-label={TONO_EMOJI[d].titulo}` en cada emoji: `Sí, que sale`, `No`,
`Sí, pero cámbiale algo`, `Nota, no cuenta como voto`
✅ **`aria-live` (4)**: en los contadores que cambian sin recargar
✅ **`aria-current` (3)**: en la navegación para marcar dónde estás
✅ **`role="dialog"` + `aria-modal` + `aria-labelledby`** en la guía guiada, que además
**cierra con Escape** (`hub.spec.ts:17`)
✅ **`focus-visible` / `focus:ring` en 8 archivos:** `idea-editor.tsx` (5), `globals.css` (2),
`login/formulario.tsx`, `script-editor.tsx`, `collaboration-enhanced.tsx`, `guided-tour.tsx`,
`idea-voting.tsx`, `project-map.tsx`
✅ **`<label htmlFor>` en los campos de texto del formulario** (`new-idea-form.tsx:196`)

**Lo que NO está implementado, o no lo encontré:**

🔴 **NO hay `aria-describedby`** (0 usos). Los `role="alert"` avisan, pero no están asociados
al campo que Depending de.
🔴 **NO hay Skip link** ("saltar al contenido").
🔴 **NO hay `role="main"` explícito** en las páginas: usan `<main>` nativo, que es correcto.
🔴 **NO hay gestión de foco al abrir/cerrar paneles.** `aria-expanded` dice que está abierto,
pero **NO hay `focus()` programático** ni devolución del foco al botón que lo abrió. Con
teclado, abrir un panel deja el foco donde estaba.
🔴 **NO hay `lang` por página**, solo en el manifest. El `layout.tsx` no declara `lang="es"`:
**NO VERIFICADO**, no lo busqué.
🔴 **NO hay `prefers-reduced-motion`.** Hay animaciones (`anim-voto`, `anim-rise`, `anim-pop`)
y **NO ENCONTRADO** ninguna regla que las respire. Para alguien con vestibular activo, el
emoji de voto animado puede ser un problema.
🔴 **Los `<button>` de transición no llevan `aria-label`**: su texto es el `label` literal
(`APROBAR Y PUBLICAR`), que ya es descriptivo. Correcto.
🔴 **Contraste: NO VERIFICADO.** No medí los pares de color. Hay 4 test e2e de móvil y nada
de contraste.

**Un detalle bien pensado** (`idea-voting.tsx:157-172`):
> *"El contador va con palabras además de con cifras: si alguien no distingue fucsia de
> mostaza, '3 a favor / 1 en contra' sigue leyéndose."*

Y el color de los emojis, literal (`idea-voting.tsx:210-212`):
> *"Los colores no son decorativos: el pulgar arriba es orquídea (el equipo avanza), el pulgar
> abajo es blanco roto (no sale), el 6-7 es mostaza (pide un cambio) y la nota es gris (no
> cuenta). Que se distingan sin leer es el objetivo."*

Cada emoji **además** lleva `aria-label` con su texto. O sea: la información está en el color,
en el `title` y en el `aria-label`. Triplicada.

---

## Tabla de cierre

| Dato pedido | Estado | Fuente |
|---|---|---|
| a) `start_url` | **ENCONTRADO — `/login?fuente=app`** | `manifest.ts:57` |
| a) `display`, `scope`, iconos | **ENCONTRADO — standalone, `/`, 11 iconos** | `manifest.ts:58-79` |
| a) Estrategia de `sw.js` | **ENCONTRADO — 3 estrategias** | `sw.js:70-118` |
| a) Qué se cachea | **ENCONTRADO — 5 rutas de precarga** | `sw.js:34-40` |
| a) Qué muestra `/offline` | **ENCONTRADO** | `offline/page.tsx` |
| b) Las 20 páginas | **ENCONTRADO — hay 18** | `find src/app -name page.tsx` |
| b) Títulos | **ENCONTRADO — 16 de 18 sin título propio** | `layout.tsx:30` |
| b) Botones por página | **ENCONTRADO** | tabla b |
| b) Estados vacíos | **ENCONTRADO — 22 literales `SIN *`** | grep de `src/app` y `src/components` |
| c) Breakpoints | **ENCONTRADO — sm 65, md 54, lg 22, xl 3** | grep de clases Tailwind |
| c) Vistas móvil/escritorio separadas | **ENCONTRADO — NO existen** | `ls src/components/ui/` |
| d) Textos de toasts/avisos | **ENCONTRADO — 7 avisos + 7 `role="alert"`** | tabla d |
| d) Componente toast | **NO EXISTE** | sin `toast`/`snackbar` en `src/` |
| d) Texto de la confirmación de movimiento | **NO ENCONTRADO** | `hub.spec.ts:8` no lo comprueba |
| e) `aria-*` | **ENCONTRADO — 11 tipos, 99 usos** | tabla e |
| e) Foco programático | **NO ENCONTRADO** | sin `.focus()` en paneles |
| e) `prefers-reduced-motion` | **NO ENCONTRADO** | sin la regla en `globals.css` |
| e) Skip link | **NO ENCONTRADO** | — |
| e) `aria-describedby` | **NO EXISTE** (0 usos) | grep de `src/` |

**CONTRADICCIONES detectadas (3):**
1. El prompt pide 20 páginas: hay **18** (`find src/app -name 'page.tsx'`).
2. El prompt sugiere que `start_url` da 307 sin sesión (como reporté en el documento maestro del 1-oct): **`start_url` es `/login?fuente=app`, que es pública.** El ciclo de la app instalada ya está cerrado; lo que redirige es la portada `/`.
3. El shortcut `Tablero de ideas` del manifest apunta a `/wundeer/ideas`, que **exige sesión**: sin sesión da 307, y con sesión de otro cliente da 404.

**CORRECCIÓN ADICIONAL respecto a mi reporte anterior:** en el documento maestro del 1-oct
escribí que la PWA instalada se rompía por un 307 en `start_url`. Al medir el manifest, el
`start_url` es `/login?fuente=app` y el comentario del código (`manifest.ts:37-56`) dice que
eso se cambió precisamente para arreglar ese ciclo. El riesgo real que queda es el del
**shortcut** a `/wundeer/ideas` y el del botón `RECARGAR` de `/offline`, que está
hardcodeado a Wundeer.

---
*BLOQUE 9 COMPLETO. Archivo: `docs/qa-insumos/BLOQUE_09_ui-pwa-texto.md`*
