# Plan de publicación — Arquitectura local

## Decisión principal

La primera versión vive en local y usa mock local. No depende de Supabase porque el entorno de staging aún se está cuadrando.

## Archivos

- `src/app/[projectSlug]/redes/page.tsx`: ruta por cliente. Usa `planPublicacionDe(projectSlug)` y responde 404 si no existe plan.
- `src/components/social-planning/social-planning-shell.tsx`: experiencia interactiva del plan de publicación.
- `src/lib/social-planning.ts`: tipos, datos mock de Wundeer, reordenamiento y aprobación individual.
- `src/lib/social-planning.test.ts`: pruebas del dominio.
- `src/lib/social-planning-ui.test.ts`: contrato estático de ruta y UI.
- `src/lib/social-planning-docs.test.ts`: asegura entrada desde dashboard y documentación.
- `public/mock/social/*.svg`: assets mock locales para Wundeer.

## Flujo de datos

1. La ruta recibe `projectSlug`.
2. `planPublicacionDe('wundeer')` devuelve el mock local.
3. `SocialPlanningShell` guarda el estado de la sesión en React:
   - orden de publicaciones
   - publicación seleccionada
   - estado de aprobación
   - estado visual de botones simulados
4. Nada se persiste fuera del navegador.

## Interacciones

- Arrastrar y soltar cambia el slot de las publicaciones.
- Los botones mover atrás y mover adelante son respaldo para pruebas y móvil.
- Aprobar publicación cambia solo esa publicación.
- Pedir cambios cambia solo esa publicación.
- El modal simula una publicación realista con caption, hashtags y acciones.
- El iframe intenta cargar el prototipo de Wundeer y el botón externo queda como respaldo.

## Contrato futuro con Supabase

Cuando Supabase staging esté confirmado, el mock local debe convertirse en persistencia real con una tabla equivalente a:

```txt
rr_hub_social_posts
- id
- project_id
- slot
- media_asset_id
- cover_asset_id
- media_type
- caption
- hashtags
- cta
- scheduled_for
- status
- client_notes
- internal_notes
- created_by
- updated_by
- created_at
- updated_at
```

Estados iniciales:

```txt
pendiente | aprobado | cambios
```

Roles sugeridos:

- Editan: owner, creator, editor, publisher, media_buyer.
- Aprueban: client_approver, owner.
- Ven: client_viewer.
- Anónimo no escribe.

## Restricciones

- No usar producción como sandbox.
- No ejecutar migraciones remotas desde esta línea.
- No confiar en roles enviados desde el navegador.
- No hardcodear Wundeer en componentes que luego deban ser multi-cliente; Wundeer solo vive en el mock local.
