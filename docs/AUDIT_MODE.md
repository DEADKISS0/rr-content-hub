# Modo público y auditoría

## Estado actual: MODO PÚBLICO

El hub está abierto: **cualquiera con el link ve todo**, sin credenciales.
Funciona igual que la vista del admin, pero en solo lectura.

| Ruta | Qué muestra |
|---|---|
| `/` | Entrada al primer proyecto + atajos |
| `/select-project` | Los tres proyectos |
| `/wundeer`, `/satiro`, `/boga` | Dashboard, fases y cola de cada proyecto |
| `/<proyecto>/ideas` | Banco completo de piezas |
| `/<proyecto>/ideas/<id>` | Ficha: referencia, briefs, hilo, entregas y trazabilidad |
| `/<proyecto>/aprobaciones · produccion · publicaciones · metricas` | Colas por fase |
| `/audit` | Índice global + estado de la ventana |
| `/audit/admin` | Equipo, accesos e invitaciones |

## Cómo se apaga y se prende la autenticación

### Interruptor de la app

Una sola variable de entorno:

```bash
NEXT_PUBLIC_AUTH_ENABLED=false   # modo público (actual)
NEXT_PUBLIC_AUTH_ENABLED=true    # vuelve el login con Google
```

- **`false` o sin definir** → todo abierto, solo lectura.
- **`true`** → `src/lib/supabase/middleware.ts` vuelve a redirigir a `/login`
  a quien no tenga sesión. Google sigue configurado, así que no hay que tocar
  nada más.

### Interruptor de la base (RLS)

La lectura anónima la habilitan las políticas `*_audit`, que consultan
`public.rr_hub_audit_enabled()`:

```sql
-- Abrir (sin caducidad)
update public.rr_hub_audit_settings
   set enabled = true, expires_at = null, updated_at = now()
 where id = true;

-- Cerrar
update public.rr_hub_audit_settings set enabled = false where id = true;
```

Con `enabled = false` la app **sigue abierta** pero anon deja de leer: las
páginas muestran vacío. Para volver al estado privado hay que apagar **los dos**
interruptores (env + RLS).

## Qué pasa al reactivar la autenticación

1. Poner `NEXT_PUBLIC_AUTH_ENABLED=true` en Vercel y redeplegar.
2. `update public.rr_hub_audit_settings set enabled = false where id = true;`
3. Listo: vuelven los roles reales, los botones de escritura y el panel
   `/admin` de administración de accesos. Nada se perdió.

## Ya nada está borrado ni degradado

- Las escrituras siguen existiendo y están intactas: lo único que cambia en
  modo público es que la UI las oculta.
- En modo público los componentes muestran el estado y los movimientos
  posibles, sin botones de acción.
- El formulario de nueva idea y el de comentarios avisan que requieren cuenta.

## Seguridad (verificado en vivo)

| Prueba anónima | Resultado |
|---|---|
| `GET rr_hub_projects` | los 3 proyectos |
| `GET rr_hub_ideas` | 12 ideas |
| `GET rr_hub_profiles` | 6 perfiles |
| `PATCH rr_hub_ideas` | `[]` → bloqueado |
| `POST rr_hub_comments` | error `42501` (RLS) → bloqueado |
| `DELETE rr_hub_access` | `[]` → bloqueado |

Solo existen políticas `SELECT` para `anon`, así que la escritura no es
posible aunque el modo público esté encendido.

## Migraciones

1. `supabase/migrations/20260910_content_hub_isolated.sql` — esquema base.
2. `supabase/migrations/20260911_global_audit.sql` — interruptor global de
   auditoría y políticas de lectura anónima.
