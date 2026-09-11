# Modo auditoría (acceso público sin login)

## Qué es

Una ventana pública de **solo lectura** sobre **todo** el Content Hub: cada
proyecto, cada pieza, su trazabilidad, su equipo y sus archivos. Sirve para que
una persona o una IA externa audite el flujo completo sin credenciales.

No reemplaza el acceso con Google: son dos puertas paralelas. El login sigue
igual y lo privado sigue privado.

## Interruptor maestro

Todo se abre y se cierra desde **una sola fila** en la base:

```sql
-- Abrir por 7 días
update public.rr_hub_audit_settings
   set enabled = true, expires_at = now() + interval '7 days', updated_at = now()
 where id = true;

-- Cerrar de inmediato
update public.rr_hub_audit_settings set enabled = false where id = true;
```

La función `public.rr_hub_audit_enabled()` es la única fuente de verdad: todas
las políticas RLS la consultan. Si `enabled = false`, o la fecha `expires_at`
pasó, la ventana se cierra sola sin tocar código ni redesplegar.

| Columna | Para qué |
|---|---|
| `enabled` | Llave maestra del modo auditoría |
| `opens_at` | Programar la apertura a futuro |
| `expires_at` | Cierre automático (7 días por defecto) |
| `updated_at` | Auditoría de cuándo se cambió |

## Rutas

| Ruta | Contenido |
|---|---|
| `/audit` | Índice con todos los proyectos + estado de la ventana |
| `/audit/<slug>` | Panorama: fases, conteos por estado y banco completo |
| `/audit/<slug>/ideas/<id>` | Ficha: referencia, briefs, comentarios, archivos y trazabilidad |
| `/audit/admin` | Panel administrativo: equipo, accesos e invitaciones |

## Seguridad

El middleware deja pasar `/audit` sin sesión, pero **la barrera real es RLS**.
Ocho políticas `*_audit` sobre `anon` consultan `rr_hub_audit_enabled()` y solo
permiten `SELECT`:

- `rr_hub_projects_audit`, `rr_hub_ideas_audit`, `rr_hub_events_audit`,
  `rr_hub_comments_audit`, `rr_hub_assets_audit`
- `rr_hub_profiles_audit`, `rr_hub_access_audit`, `rr_hub_invites_audit`

Verificado en vivo con la clave anónima:

| Prueba anónima | Resultado |
|---|---|
| `rr_hub_projects` | los 3 proyectos (satiro, boga, wundeer) |
| `rr_hub_ideas` | 12 ideas |
| `rr_hub_profiles` | roster completo |
| `rr_hub_access` / `rr_hub_invites` | 3 accesos / 13 invitaciones |
| `PATCH` a `rr_hub_projects` | devuelve `[]` → bloqueado |

Nunca hay acceso anónimo a escritura: solo existen políticas `SELECT`, y
PostgreSQL las aplica aunque existan políticas `FOR ALL` para `authenticated`
(son roles distintos, no se suman).

## Qué NO expone

- No permite editar, aprobar, comentar ni subir archivos.
- No firma URLs de archivos privados (el detalle muestra metadatos, no el binario).
- No expone credenciales ni tokens: solo correos y roles.

## Probar

1. https://rr-content-hub.vercel.app/audit
2. Entra a cualquier proyecto (Satiro, BOGA o Wundeer).
3. Revisa el panel administrativo en `/audit/admin`.
4. Cuando termine la auditoría, cierra el interruptor con el `update` de arriba.
