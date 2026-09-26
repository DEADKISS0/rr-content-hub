# Modo público y auditoría

## Estado actual: modo público, SOLO LECTURA

El hub está abierto: cualquiera con el link navega Wundeer sin credenciales.
**No puede escribir.** Ni ideas, ni comentarios, ni eventos, ni archivos.

> ⚠️ **Corrección 2026-09-26.** Este documento decía antes que "solo existen
> políticas `SELECT` para `anon`" y que el hub era de solo lectura. Era falso:
> `20260911_wundeer_collaborative_mode.sql` concedió `INSERT` y `UPDATE` a
> `anon`, y las políticas base de `20260910` son `for all` sin
> `to authenticated`. Cualquier visitante podía crear ideas y cambiar su
> estado de aprobación. Verificado contra producción, no inferido.
> Corregido por `20260926_close_anon_write.sql`.

| Ruta | Qué muestra |
|---|---|
| `/` | Entrada al proyecto activo |
| `/select-project` | Selector de proyecto |
| `/wundeer` | Dashboard, fases y cola de trabajo |
| `/wundeer/ideas` · `/ideas/<id>` | Banco de piezas y ficha completa |
| `/wundeer/aprobaciones · produccion · publicaciones · metricas · roadmap` | Colas por fase |
| `/audit` | Redirige a `/wundeer` |
| `/audit/admin` | Panel de equipo (solo lectura en modo público) |

`/satiro` y `/boga` existen en Supabase pero `src/lib/projects.ts` solo expone
`wundeer`, así que devuelven 404. No es un bug.

## Cómo se apaga y se prende la autenticación

Una sola variable de entorno:

```bash
NEXT_PUBLIC_AUTH_ENABLED=false   # modo público (actual)
NEXT_PUBLIC_AUTH_ENABLED=true    # vuelve el login con Google
```

- **`false` o sin definir** → todo abierto, solo lectura.
- **`true`** → `src/lib/supabase/middleware.ts` redirige a `/login` a quien no
  tenga sesión. Google ya está configurado, no hay que tocar nada más.

Conviene ponerla explícitamente en Vercel aunque valga `false`: así el estado
observado es una decisión y no la ausencia de una variable.

### Interruptor de la base (RLS)

```sql
-- Abrir lectura anónima
update public.rr_hub_audit_settings
   set enabled = true, expires_at = now() + interval '7 days', updated_at = now()
 where id = true;

-- Cerrar
update public.rr_hub_audit_settings set enabled = false where id = true;
```

Ojo con `expires_at = null`: `rr_hub_audit_enabled()` lo interpreta como
**sin caducidad**. Para una ventana temporal hay que poner una fecha. Así
estaba desde el 11/09: la ventana de auditoría nunca cerraba.

## Cómo se apaga y se prende la escritura

La escritura **nunca** depende del interruptor de lectura. Pasa por dos capas:

1. **RLS** — `20260926_close_anon_write.sql` no deja ninguna política de
   escritura para `anon`. Sin sesión no hay INSERT, UPDATE ni DELETE.
2. **El motor de flujo** — `transitionIdeaStatus()` consulta
   `allowedTransitions(rol, estado)` antes de escribir. Un request manipulado
   que salte de `draft` a `published` se rechaza en el cliente, y RLS lo
   rechaza en el servidor.

Para devolver la escritura: poner `NEXT_PUBLIC_AUTH_ENABLED=true`, dar de alta
a la persona en `rr_hub_access` con su rol, y revertir el punto 1 de
`20260926_close_anon_write.sql`.

## Qué hace cada rol

El rol se lee de `rr_hub_access.role_in_project` en el servidor. Un visitante
anónimo es `client_viewer`: navega, no ejecuta.

| Rol | Qué mueve |
|---|---|
| `owner` | Todo, en cualquier estado |
| `creator` | Propone, envía al cliente, reenvía ajustes |
| `camera` / `model` | Arrancan rodaje, marcan el crudo |
| `editor` | Inicia y termina la edición |
| `publisher` / `media_buyer` | Aprueban y publican, cierran el flujo |
| `client_approver` | Aprueba ideas y guiones, pide ajustes |
| `client_viewer` | Solo lectura |

## Seguridad (verificado contra producción, 2026-09-25)

Estado **antes** de aplicar `20260926_close_anon_write.sql`:

| Prueba anónima | Resultado |
|---|---|
| `SELECT` de ideas de Wundeer | permitido (por diseño) |
| `SELECT` de `rr_hub_profiles` / `access` / `invites` | `[]` — sin datos de equipo |
| `POST` a ideas, comentarios, eventos, assets | **201 — creaba la fila** |
| `PATCH` a ideas (status → `approved`) | **200 — escribía y lo confirmaba** |
| `DELETE` a cualquier tabla `rr_hub_*` | 200 con 0 filas — bloqueado |

Después de la migración, los tres primeros pasan a bloquearse.

## Migraciones

En orden, todas idempotentes:

1. `20260910_content_hub_isolated.sql` — esquema base, RLS y bucket.
2. `20260911_global_audit.sql` — interruptor global de auditoría.
3. `20260911_wundeer_assets_realtime.sql` — realtime y assets.
4. `20260911_wundeer_cleanup.sql` — limpieza de datos de prueba.
5. `20260911_wundeer_collaborative_mode.sql` — modo colaborativo. ⚠️ concedió
   escritura a `anon`; revertido en el punto 6.
6. `20260926_close_anon_write.sql` — **cierra la escritura anónima**.

`supabase/_archivo/` contiene esquemas que no aplican: `schema.sql` describe
tablas `public.*` que nunca existieron y colisionan con el CRM. No lo apliques.

## Aislar el CRM

Este proyecto de Supabase es compartido con otras herramientas de RR, y las
tablas legacy (`public.profiles`, `public.projects`) **no** tienen RLS: un
anónimo puede leer emails del equipo y el pipeline comercial. Eso no lo
arregla este repo. Las dos salidas son poner RLS en esas tablas o mover el hub
a su propio proyecto Supabase.
