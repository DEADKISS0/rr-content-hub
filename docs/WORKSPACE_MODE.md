# Workspace mode — transición segura a datos reales

## Estado actual

Mientras Supabase y Google OAuth se activan con las credenciales protegidas, la aplicación ofrece un modo operativo local para probar el flujo sin fingir que los datos ya son compartidos.

## Lo que funciona ahora

- Crear una idea con título, objetivo, referencia y briefs iniciales.
- Autoguardar el formulario de captura en el navegador.
- Ver la idea nueva en el banco del mismo proyecto.
- Abrir su ficha, ver la referencia embebida y añadir comentarios/archivos.
- Enviar a revisión, aprobar o solicitar ajustes.
- Conservar esos cambios en el navegador actual.

## Límite intencional

Este modo **no comparte datos entre personas ni dispositivos**. No se presenta como producción: el banco deja visible el indicador `[WORKSPACE_MODE]` para que el equipo sepa que la sincronización todavía no está activa.

## Sustitución por Supabase

La interfaz se apoya en una única capa (`src/lib/workspace-store.ts`). Al activar Supabase, cada operación se reemplaza por su mutación autenticada equivalente:

| Acción local | Tabla/servicio real |
| --- | --- |
| Crear/actualizar idea | `content_ideas` + `content_events` |
| Comentario | `comments` + Realtime |
| Archivo | Supabase Storage + `content_assets` |
| Versión | `idea_versions` |
| Aprobación | `content_events` con actor y timestamp |

Antes del cambio se aplicarán RLS, políticas de Storage y pruebas con los ocho perfiles definidos en `PRODUCT.md`.
