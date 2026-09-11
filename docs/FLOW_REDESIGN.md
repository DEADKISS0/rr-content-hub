# Flujo de contenido (rediseño 2026-09-10)

## Principio

Una persona no debe aprenderse trece estados. El sistema le muestra **dónde está
la pieza**, **a quién le toca** y **como máximo dos botones**: los que su rol
puede ejecutar de verdad.

El motor vive en `src/lib/flow.ts` y es la única fuente de verdad: páginas de
servidor, colas y widgets leen de ahí. Cambiar una regla es cambiar un archivo.

## Cinco fases en lugar de trece estados

| Fase | Qué pasa | Estados internos |
|---|---|---|
| 01 IDEA | Se propone y se decide | `draft`, `pending_approval`, `needs_changes` |
| 02 GUIÓN | Se escribe y se aprueba | `approved`, `script_in_progress`, `pending_script_review`, `script_approved` |
| 03 RODAJE | Se graba y se sube el crudo | `in_production`, `raw_uploaded` |
| 04 EDICIÓN | Se monta y se aprueba | `editing`, `ready_to_publish` |
| 05 PUBLICACIÓN | Se publica y se cierra | `published`, `closed` |

Los estados siguen existiendo en la base (nada se perdió), pero la interfaz los
agrupa para que nadie se pierda.

## Reglas por rol

`allowedTransitions(role, status)` devuelve solo los movimientos legítimos. Si la
lista queda vacía, el mensaje es explícito: *"no es tu turno todavía"*.

| Estado | Puede avanzar |
|---|---|
| `draft`, `needs_changes`, `approved` | owner, creativa |
| `script_in_progress` | owner, creativa, editor |
| `script_approved` | owner, cámara, modelo |
| `in_production` | cámara, modelo, owner |
| `raw_uploaded`, `editing` | editor, owner |
| `ready_to_publish` | owner, publisher, pauta |
| `published` | publisher, pauta, owner |
| `pending_approval`, `pending_script_review` | el cliente |

El owner puede desbloquear siempre; el resto ve únicamente su relevo.

## Qué ve cada persona

- **Sidebar recortado por rol**: cada rol tiene su propia lista de pestañas y su
  primera entrada es su cola real (`ROLE_NAV`).
- **Panel de rol real** (`RoleView`, `RoleCommandCenter`): ya no existe el
  simulador. El rol llega del perfil autenticado y no se puede cambiar desde la UI.
- **Colas con contexto**: cada cola muestra el conteo por fase, quién actúa y por
  qué está esperando.

## Trazabilidad

Cada transición escribe dos cosas: el `status` de la idea y un evento en
`rr_hub_events` con actor, estado anterior, estado nuevo y nota. La ficha muestra
ese historial completo más los comentarios y las entregas.
