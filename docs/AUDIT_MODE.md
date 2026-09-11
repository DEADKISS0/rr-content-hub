# Modo auditoría (acceso público sin login)

## Qué es

Un botón visible en `/login` (**ENTRAR SIN CREDENCIALES**) que abre una copia
pública de **solo lectura** del proyecto habilitado. Sirve para que una persona
o una IA externa audite el flujo completo sin credenciales.

No reemplaza el acceso con Google: convive con él.

## Cómo se activa por proyecto

El control es un flag en la base, no un cambio de código:

```sql
update public.rr_hub_projects set public_audit = true where slug = 'wundeer';
```

`public_audit = false` (valor por defecto) cierra la vista al instante.

## Rutas

| Ruta | Contenido |
|---|---|
| `/audit` | Índice de proyectos abiertos + explicación del modo |
| `/audit/<slug>` | Panorama: fases, conteos por estado y banco completo |
| `/audit/<slug>/ideas/<id>` | Ficha: referencia, briefs, comentarios, archivos y trazabilidad |

## Seguridad

El middleware deja pasar `/audit` sin sesión, pero **la barrera real es RLS**.
Cinco políticas `*_audit` sobre `anon` limitan la lectura a filas cuyo proyecto
tenga `public_audit = true`:

- `rr_hub_projects_audit`
- `rr_hub_ideas_audit`
- `rr_hub_events_audit`
- `rr_hub_comments_audit`
- `rr_hub_assets_audit`

Verificado en vivo con la clave anónima:

| Consulta anónima | Resultado |
|---|---|
| `rr_hub_projects` (todas) | solo `wundeer` |
| `rr_hub_ideas` | solo ideas de `wundeer` |
| `/audit/satiro`, `/audit/boga` | "no está abierto a auditoría" |

Nunca hay acceso anónimo a escritura: solo existen políticas `SELECT`.

## Qué NO expone

- No permite editar, aprobar ni subir archivos.
- No lista proyectos privados ni sus ideas.
- No firma URLs de archivos privados (el detalle muestra metadatos, no el binario).

## Probar

1. Abre https://rr-content-hub.vercel.app/audit
2. Entra a WUNDEER.
3. Abre cualquier ficha y revisa fases, trazabilidad y entregas.
