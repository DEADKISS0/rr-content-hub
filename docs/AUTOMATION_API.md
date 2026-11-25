# API de automatización · Content Hub

La API permite que una automatización autorizada lea y cree ideas de cualquier proyecto existente y visible en el catálogo. No expone transiciones, comentarios ni archivos: esas acciones siguen el flujo visible del Hub.

## Configuración en Vercel

Configura estas variables **solo en servidor** (Production, Preview y Development según corresponda):

- `SUPABASE_SERVICE_ROLE_KEY`: clave de servicio de Supabase.
- `RR_HUB_AUTOMATION_TOKEN`: token largo y aleatorio que compartes únicamente con la automatización autorizada.

No uses variables `NEXT_PUBLIC_*` para tokens. El endpoint devuelve `503` hasta que ambas variables estén configuradas.

## Consultar ideas

`GET /api/ideas?project=pesquera-oro-del-mar`

Incluye el encabezado `x-api-key: <RR_HUB_AUTOMATION_TOKEN>`.

## Crear una idea

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

La API valida URLs, genera el código de la idea y crea el evento de trazabilidad. Se pueden incluir `camera_brief`, `talent_brief` y `edit_brief` para que la ficha llegue lista al equipo. Nunca envíes el token en una URL, chat público o repositorio.

## Cargar el paquete semanal de 10 ideas

`POST /api/ideas` admite un lote exacto de diez propuestas. Es la única forma que debe usar la rutina de los martes: crea las diez fichas directamente en `voting`, con sus análisis y mini-briefs, sin seleccionar una ganadora ni moverla a producción.

```json
{
  "project_slug": "pesquera-oro-del-mar",
  "batch_key": "pesquera-oro-del-mar-2026-11-24",
  "ideas": [
    {
      "title": "Idea clara y concreta",
      "description": "Análisis comercial y de producción: audiencia, gancho, viabilidad, costo aproximado, permisos, riesgos y supuestos.",
      "objective": "Resultado que se busca conseguir.",
      "content_type": "organic",
      "category": "Producto",
      "reference_urls": ["https://ejemplo.com/referencia"],
      "priority": "normal",
      "camera_brief": "Tomas, ubicación, luz, movimiento y equipo necesario.",
      "talent_brief": "Modelo o vocero, vestuario y acciones necesarias.",
      "edit_brief": "Ritmo, textos, música, CTA y formato de salida."
    }
  ]
}
```

El arreglo debe tener exactamente diez elementos. `batch_key` es estable por cliente y fecha de la corrida: si la rutina reintenta la misma petición, la API devuelve el lote original en lugar de duplicarlo. Un lote válido exige análisis de al menos 80 caracteres y los tres mini-briefs de producción.

La respuesta incluye `imported: 10` en la primera carga o `already_imported: true` cuando el lote ya estaba montado. La rutina debe comprobar ambos casos como éxito y abrir `/<project_slug>/ideas` solo para reportar el resultado, sin publicar ni avanzar ninguna idea.
