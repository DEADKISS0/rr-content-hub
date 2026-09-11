# API de automatización · Wundeer

La API permite que una automatización autorizada lea y cree ideas de **Wundeer**. No expone otros proyectos ni permite transiciones, comentarios o archivos: esas acciones siguen el flujo visible del Hub.

## Configuración en Vercel

Configura estas variables **solo en servidor** (Production, Preview y Development según corresponda):

- `SUPABASE_SERVICE_ROLE_KEY`: clave de servicio de Supabase.
- `RR_HUB_AUTOMATION_TOKEN`: token largo y aleatorio que compartes únicamente con la automatización autorizada.

No uses variables `NEXT_PUBLIC_*` para tokens. El endpoint devuelve `503` hasta que ambas variables estén configuradas.

## Consultar ideas

`GET /api/ideas?project=wundeer`

Incluye el encabezado `x-api-key: <RR_HUB_AUTOMATION_TOKEN>`.

## Crear idea

`POST /api/ideas` con JSON:

```json
{
  "project_slug": "wundeer",
  "title": "Idea de textura",
  "description": "Mostrar el material en movimiento.",
  "objective": "Conectar con la audiencia.",
  "content_type": "organic",
  "category": "Producto",
  "reference_urls": ["https://ejemplo.com/referencia"]
}
```

La API valida URLs, genera el código de la idea y crea el evento de trazabilidad. Nunca envíes el token en una URL, chat público o repositorio.
