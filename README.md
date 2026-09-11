# RR Content Hub

Sistema multi-cliente de RR ALIADOS para ideación, aprobación, producción y publicación de contenido orgánico y de pauta.

## Estado actual: MODO PÚBLICO (solo lectura)

El hub está abierto: **cualquiera con el link ve todo** lo que ve el admin, sin credenciales, en solo lectura.

- Producción: https://rr-content-hub.vercel.app
- Autenticación desactivada por interruptor: `NEXT_PUBLIC_AUTH_ENABLED=true` la reactiva (Google OAuth ya está configurado).
- La escritura anónima está bloqueada por RLS: solo existen políticas `SELECT` para `anon`.
- Detalle completo: [`docs/AUDIT_MODE.md`](docs/AUDIT_MODE.md).

### Rutas principales

| Ruta | Qué muestra |
|---|---|
| `/` | Entrada al primer proyecto |
| `/select-project` | Los tres proyectos (Wundeer, Satiro, BOGA) |
| `/<proyecto>` | Dashboard, fases y cola de trabajo |
| `/<proyecto>/ideas` · `/ideas/<id>` | Banco de piezas y ficha completa |
| `/<proyecto>/aprobaciones · produccion · publicaciones · metricas` | Colas por fase |
| `/audit` · `/audit/admin` | Índice global y panel de equipo/accesos |

Rol nocturno / detalle de flujo: [`docs/FLOW_REDESIGN.md`](docs/FLOW_REDESIGN.md).

## Stack

- Next.js 16 (App Router) + React + TypeScript
- Supabase (Postgres + Auth + Storage)
- Vercel

Las tablas viven en el namespace `rr_hub_*` dentro de un proyecto Supabase compartido con otras herramientas de RR, por lo que nunca se tocan las tablas legacy del CRM.

## Desarrollo

```bash
npm install
cp .env.example .env.local
npm run dev
```

Para datos reales hay que configurar Supabase y las variables de `.env.example`.

## Base de datos

Migraciones canónicas e idempotentes, en orden:

1. `supabase/migrations/20260910_content_hub_isolated.sql` — esquema base, RLS y bucket.
2. `supabase/migrations/20260911_global_audit.sql` — interruptor global de auditoría y políticas de lectura anónima.

## Despliegue

Las credenciales nunca se guardan en el repositorio; viven en Vercel Environment Variables.

```bash
npx vercel build --prod && npx vercel deploy --prebuilt --prod
```

## Documentación

- [`docs/AUDIT_MODE.md`](docs/AUDIT_MODE.md) — modo público, interruptores y seguridad.
- [`docs/FLOW_REDESIGN.md`](docs/FLOW_REDESIGN.md) — flujo de 13 estados en 5 fases y reglas por rol.
- [`docs/AUDIT_2026-09-10.md`](docs/AUDIT_2026-09-10.md) — auditoría técnica end-to-end.
- [`DESIGN.md`](DESIGN.md) · [`PRODUCT.md`](PRODUCT.md) — diseño y producto.
