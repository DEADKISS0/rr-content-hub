# Lo que falta en la base (al 2026-09-26)

> Estado: ABIERTO — requiere un pegado en el panel de Supabase
> Verificado: 2026-09-26, contra el proyecto `ntgtvtzbjwotuwkiflar`

Ninguna máquina de este equipo tiene credenciales con permiso de DDL sobre el proyecto del
hub: el MCP de Supabase ve otras dos organizaciones, el CLI tiene sesión pero no privilegios
sobre este proyecto, y `SUPABASE_SERVICE_ROLE_KEY` está marcada *Sensitive* en Vercel (llega
como `[SENSITIVE]`, ilegible). Por eso queda un pegado manual, y por eso el runner lo deja
listo en vez de intentar rutas raras.

## Cómo cerrarlo (1 minuto)

    ./scripts/apply-pending-backend.sh --print    # imprime las dos migraciones juntas
    # pegar en https://supabase.com/dashboard/project/ntgtvtzbjwotuwkiflar/sql/new  → Run
    ./scripts/apply-pending-backend.sh --verify   # comprobar que quedó

## Qué se aplica, y qué se midió en vivo

     Hueco                        Medición real (2026-09-26)              Migración
     ──────────────────────────   ────────────────────────────────────   ─────────────────────
     Fuga del CRM huérfano        200 con datos: 7 filas en `profiles`    20260927_hub_pending
     · `profiles` / `projects`    y 10 en `projects`, legibles con la     _security.sql
                                  publishable key (va en el navegador)
     Bucket de assets ausente     `storage/v1/bucket/rr-content-assets`  20260927 (mismo)
                                  → 404/400 NoSuchBucket: cada entrega
                                  compartida daba URL rota
     Códigos duplicables          `code` con max+1 y sin índice único    20260927 (índice)
                                  → dos creaciones simultáneas escriben   + reintento por 23505
                                  el mismo código                         en API y formulario
     Backend v3 (vistas,          FALTA en las 4 columnas, 2 vistas y    20260926_hub_v3
     búsqueda, índice de texto)   la función `rr_hub_search`             _board_feed_search.sql

Prioridad real: la fuga del CRM. Lo demás mejora el producto, pero la primera es lo único
que hoy expone datos a cualquiera.

## Lo que NO hace, a propósito

- **No cierra la ventana de auditoría.** `rr_hub_audit_settings.enabled` es una bandera: solo
  el panel de admin la lee para pintar un aviso. Ninguna ruta la consulta para decidir si
  muestra el panorama, así que apagarla daría una puerta cerrada de mentira. Cerrar de verdad
  es un cambio en `src/app/audit/[projectSlug]/page.tsx`.
- **No borra las filas de la auditoría anterior.** Van aparte y a mano:

      delete from public.rr_hub_comments where body = 'probe-hermes';
      delete from public.rr_hub_ideas    where title = 'RR-AUDIT-PROBE-DELETE-ME';

## Ruta del panel de accesos

`/audit/admin` ahora exige administrador (`src/lib/admin-guard.ts`): sesión + `rr_hub_profiles.
global_role = 'admin'`, o estar en `SUPER_ADMIN_EMAILS`. La tabla está vacía hoy, así que sin
esa variable de entorno —se configura en Vercel, nunca en el repo— nadie puede abrir el panel.
El panel avisa en pantalla cuando la variable no está puesta.
