# Plan de publicación — SPEC

## Estado

Sandbox local para RR Content Hub.

## Objetivo

Crear el apartado **Plan de publicación** para Wundeer en `/wundeer/redes`, como una funcionalidad nueva del Content Hub. La primera versión es un **mock local**: sirve para diseñar, mostrar, ajustar y validar la experiencia antes de conectar Supabase.

## Alcance de esta versión

- Cliente piloto: Wundeer.
- Ruta: `/wundeer/redes`.
- Nombre visible: **Plan de publicación**.
- Perfil tipo Instagram simulado.
- Logo del cliente.
- Bio, métricas simuladas, botones visuales y destacados.
- Grilla 3x3 de nueve publicaciones.
- Arrastrar y soltar para reordenar piezas.
- Modal por publicación.
- Aprobación individual por publicación.
- Estados: pendiente, aprobado, cambios.
- Roadmap corto de publicación.
- Iframe del prototipo: `https://commerce-wundeer-beta.up.railway.app/`.

## Fuera de alcance

- Sin Supabase.
- Sin migraciones.
- Sin Vercel.
- Sin producción.
- Sin publicación real en Instagram.
- Sin Meta API.
- Sin guardar datos remotos.

## Criterio de aceptación

1. `/wundeer/redes` abre una pantalla navegable en local.
2. La grilla muestra nueve publicaciones.
3. Cada publicación se puede seleccionar y abrir en modal.
4. Se puede aprobar una publicación sin aprobar las demás.
5. Se puede pedir cambios a una publicación.
6. Se puede reordenar por drag and drop o controles auxiliares.
7. El prototipo de Wundeer se intenta mostrar en iframe y tiene botón externo.
8. El dashboard del cliente tiene una entrada a Plan de publicación.

## Nota de producto

Esto no reemplaza el flujo de producción existente. Es una capa visual para que Santiago y el cliente vean cómo se verá el contenido antes de publicar.
