# RR Content Hub — Plan de implementación y registro

## Objetivo
Convertir el banco de ideas de RR ALIADOS en un sistema operativo multi-cliente: cada persona entra con su identidad, ve solo sus proyectos y recibe información accionable según su rol.

## Orden de entrega
### Paso 1 — Experiencia y flujo (actual)
- Selector, navegación, banco filtrable y detalle con referencia visual embebida.
- Vista contextual por rol, comentarios, archivos, versiones y autoguardado.
- Responsive para móvil, tablet y escritorio.
**Aceptación:** localizar una idea, entender qué hacer, comentar, revisar la referencia y volver sin perder contexto.

### Paso 2 — Datos y colaboración real
- Migrar ideas demo a Supabase.
- Persistir comentarios, eventos, archivos, versiones, tareas y publicaciones.
- Realtime para actualizaciones y Storage para entregables.
**Aceptación:** dos sesiones ven el mismo cambio y toda acción conserva actor, fecha y versión.

### Paso 3 — Seguridad y acceso por proyecto
- Usuarios, proyectos, roles globales y roles por proyecto.
- RLS y panel de administración de accesos.
**Aceptación:** cada colaborador solo ve proyectos asignados y el cliente no ve información interna.

### Paso 4 — Google Auth
- OAuth, alta controlada por correo, solicitudes de acceso y sesiones persistentes.
**Aceptación:** login, logout, bloqueo de no autorizados y redirecciones correctas.

### Paso 5 — Producción, publicación y aprendizaje
- Kanban, calendario, checklists, versiones, URLs publicadas y métricas.
**Aceptación:** una idea recorre producción, publicación y medición dentro del sistema.

## Decisiones
- Se conserva el historial; no se borran ideas destructivamente.
- Orgánico y pauta comparten flujo, pero tienen objetivos y campos distintos.
- El proyecto es el límite principal de acceso.
- La interfaz debe ser intensa y clara.
- Auth se implementa después de validar experiencia y permisos.

## Auditoría por entrega
Cada paso cierra con `lint`, `build`, prueba de rutas, prueba responsive, revisión visual y actualización de este documento.
