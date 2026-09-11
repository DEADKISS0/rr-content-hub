# Auditoría v2 — claridad visual y de flujo

Respuesta a la auditoría externa del 11/09/2026. El objetivo fue uno: que
cualquiera entienda **dónde está una pieza**, **quién actúa ahora** y **qué pasa
si toca un botón** — sin explicaciones.

## Lo que quedó implementado

### Claridad (lo que pedía la auditoría con más fuerza)

| Antes | Ahora |
|---|---|
| Botón "SIGUIENTE RELEVO" ambiguo | CTA que nombra la acción: **ENVIAR A CLIENTE**, **APROBAR GUIÓN**… |
| Sin saber qué pasaba al pulsar | Bloque **[DESPUÉS DE ESTO]** con el estado destino y el próximo responsable |
| Referencia en iframe sin contexto | **Referencia + brief** lado a lado: intención, cámara, talento, edición y "qué no hacer" |
| Producción opaca | **Pipeline de 4 pasos**: GRABACIÓN → CRUDO SUBIDO → EDICIÓN → LISTO, con el paso activo en fucsia |
| Cola sin saber a quién espera | Filtro **[QUIÉN TIENE QUE ACTUAR AHORA]**: CLIENTE · CÁMARA · EDITOR · PUBLISHER con contadores |
| Banco plano | Banco **agrupado por fase** (IDEA, GUIÓN, RODAJE, EDICIÓN, PUBLICACIÓN), colapsable |
| Badge solo con texto | Badge con **ícono + color + etiqueta**; nunca depende solo del color |

### Sistema de cuatro señales

Cada estado se comunica con ícono, tono, etiqueta y responsable. Los tonos son
B.U.C.M. y significan algo:

- **Mostaza** → espera al **cliente** (decisión pendiente).
- **Fucsia** → está en **producción** (rodaje, edición).
- **Orquídea** → **revisión** interna.
- **Neutro** → borrador, publicado o cerrado.

### Transiciones

Nada aparece de golpe. `src/app/globals.css` define `.anim-rise`, `.anim-fade`,
`.anim-slide`, `.anim-pop`, `.anim-highlight` (destello de 2s tras un cambio) y
`.stagger` (entrada escalonada de tarjetas). Todo respeta
`prefers-reduced-motion`.

### Bugs del informe

1. **Código único** — cada idea recibe su código O1/P1… al crearse, visible en el
   formulario antes de guardar.
2. **Validación de referencia** — el formulario rechaza texto que no sea URL.
3. **Doble clic** — los botones de acción se bloquean mientras hay una
   transición en curso.
4. **Actor claro en trazabilidad** — el historial muestra autor y fecha.
5. **Comentarios con rol** — cada comentario lleva su etiqueta de rol visible.
6. **Admin agrupado** — accesos e invitaciones agrupados por proyecto.

## Componentes nuevos

- `status-badge.tsx` — badge rico (ícono + tono + etiqueta) y `StatusDot`.
- `production-pipeline.tsx` — los 4 pasos de producción.
- `role-filter.tsx` — filtro "quién actúa" + `countsByGroup`.
- `reference-with-brief.tsx` — referencia visual + brief (reemplaza a `ReferenceEmbed`).
- `breadcrumbs.tsx` — ruta de navegación profunda.
- `queue-section.tsx` — cola compartida por las 4 fases.

Eliminados por quedar huérfanos: `workspace-section.tsx`, `reference-embed.tsx`.

## Qué queda pendiente (no crítico)

Lo que depende de tener escritura activa o infraestructura todavía no
desplegada:

- **Realtime** de colas y permisos (requiere Supabase Realtime habilitado).
- **Optimistic updates** con reversión — hoy la escritura está en modo público.
- **Tests unitarios** de `allowedTransitions()` y componentes.
- **Sentry / error tracking**.
- **Versionado de guiones** en `rr_hub_idea_versions`.

Ninguno bloquea la lectura pública actual.
