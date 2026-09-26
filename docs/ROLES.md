# Roles del hub

Cada persona entra con su identidad y ve lo que su rol le deja hacer. El rol
vive en `rr_hub_access.role_in_project` y lo lee el servidor — nunca el
navegador. Un visitante sin sesión es `client_viewer`: navega, no ejecuta.

## Quién es quién

| Rol | Cola | Encabezado | Qué hace |
|---|---|---|---|
| `owner` | `/aprobaciones` | DESTRABA Y ACOMPAÑA | Prepara propuestas, consigue decisiones del cliente y confirma el siguiente relevo. |
| `creator` | `/ideas` | PROPONE Y AJUSTAS | Convierte referencias en propuestas claras y responde los ajustes sin perder contexto. |
| `camera` | `/produccion` | RUEDAS LO APROBADO | Solo ve piezas con guion aprobado. Sigue el brief y sube el crudo. |
| `model` | `/produccion` | EJECUTAS EL TALENTO | Ve vestuario, actitud y referencias de las piezas listas para rodar. |
| `editor` | `/produccion` | MONTAJAS Y ENTREGAS | Recibe el crudo centralizado, conserva versiones y entrega un corte para revisión. |
| `publisher` | `/publicaciones` | PUBLICAS CON EVIDENCIA | Solo recibe piezas aprobadas. Registra canal, URL y evidencia de salida. |
| `media_buyer` | `/publicaciones` | MIDE Y OPTIMIZA | Registra hipótesis, resultados y qué formato conviene repetir. |
| `client_approver` | `/aprobaciones` | DECIDES | Ve la propuesta, la referencia y el guion. Aprueba o pide ajustes. |
| `client_viewer` | `/aprobaciones` | CONSULTAS | Ve el avance del proyecto sin editar nada. |

`owner` es el único con vía libre: puede actuar en cualquier estado. Es
deliberado — es quien destraba un flujo atascado.

## Quién puede mover qué

| Desde | Hacia | Quién |
|---|---|---|
| `draft` | `pending_approval` | creator |
| `pending_approval` | `approved` · `needs_changes` · `closed` | cliente |
| `needs_changes` | `pending_approval` | creator |
| `approved` | `script_in_progress` | creator |
| `script_in_progress` | `pending_script_review` | creator, editor |
| `pending_script_review` | `script_approved` | cliente |
| `pending_script_review` | `script_in_progress` | cliente (pide cambios de guion) |
| `script_approved` | `in_production` | camera, model |
| `in_production` | `raw_uploaded` | camera, model |
| `raw_uploaded` | `editing` | editor |
| `editing` | `ready_to_publish` | editor |
| `ready_to_publish` | `published` | publisher, media_buyer |
| `published` | `closed` | publisher, media_buyer |

`closed` es terminal: conserva todo el historial y no admite más movimientos.

Dos decisiones que se corrigieron el 2026-09-26 y conviene no volver a
equivocar:

- **Pedir cambios de guion vuelve a `script_in_progress`, no a `needs_changes`.**
  `needs_changes` vive en la fase IDEA, así que la versión anterior obligaba al
  cliente a re-aprobar la idea cuando solo quería cambiar el guion.
- **La transición declara sus propios owners.** Antes el filtro miraba los
  owners del estado de *origen*; como `closed` no tiene ninguno, cerrar una
  pieza era imposible para cualquiera salvo el owner.

## Fases

| Fase | Estados |
|---|---|
| IDEA | `draft` · `pending_approval` · `needs_changes` |
| GUIÓN | `approved` · `script_in_progress` · `pending_script_review` · `script_approved` |
| RODAJE | `in_production` · `raw_uploaded` |
| EDICIÓN | `editing` · `ready_to_publish` |
| PUBLICACIÓN | `published` · `closed` |

## Dónde vive la verdad

`src/lib/flow.ts` es la única fuente del dominio. `src/lib/queues.ts` deriva las
colas de ahí. `src/lib/workspace-client.ts` valida cada escritura contra
`allowedTransitions()` antes de tocar la base.

`npm run verify:flow` comprueba 17 invariantes: que todo estado pertenece a una
fase, que nada queda sin salida, que ningún rol se sale de su carril y que
`client_viewer` no puede hacer nada. Después de cambiar el motor, córrelo.
