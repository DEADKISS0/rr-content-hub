# RR Content Hub

Sistema multi-cliente de RR ALIADOS para ideación, aprobación, producción y publicación de contenido orgánico y de pauta.

## Estado actual

- MVP navegable: selector de proyecto, dashboard, banco de ideas, detalle y captura de nueva idea.
- Modo demo activo cuando no existen variables de Supabase.
- Integración Google OAuth/Supabase preparada.
- UI B.U.C.M. basada en el Brandkit RR: `#be076d`, `#ded116`, `#973d8f`, `#fffff3`, `#070001`.

## Desarrollo

```bash
npm install
cp .env.example .env.local
npm run dev
```

Para activar datos reales, configura Supabase, Google OAuth y las variables de `.env.example`. El esquema inicial está en `supabase/schema.sql`.

## Despliegue

El repositorio debe desplegarse como proyecto privado en GitHub y luego conectarse a Vercel. Las credenciales nunca se guardan en el repositorio; se agregan en Vercel Environment Variables.
