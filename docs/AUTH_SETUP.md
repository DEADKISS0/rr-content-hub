# Activación de Google Auth y roles

## Orden seguro

1. En Supabase, activar **Google** en Authentication → Providers.
2. En Google Cloud, crear OAuth Client (Web application) y añadir la callback que indique Supabase.
3. Configurar Site URL: `https://rr-content-hub.vercel.app` y Redirect URL: `https://rr-content-hub.vercel.app/auth/callback`.
4. Guardar `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` como variables de producción en Vercel. La service role key nunca llega al navegador.
5. Aplicar únicamente `supabase/migrations/20260910_content_hub_isolated.sql`. El proyecto Supabase ya tiene tablas de otro CRM en `public.*`; el Content Hub usa sus propias tablas `rr_hub_*` para no interferir.
6. Promover la cuenta de Rosas a admin mediante SQL controlado:
   `update public.profiles set global_role = 'admin' where email = '<correo-admin>';`
7. Desde Admin, asignar cada correo a proyecto y rol. Los usuarios sin acceso verán `Acceso pendiente`.

## Pruebas de aceptación

- Login/logout y recuperación de sesión.
- Usuario sin proyecto no puede leer datos ni adivinar URLs.
- Cliente solo lee su proyecto y no notas internas.
- Cámara no cambia una aprobación de cliente.
- Editor sube versiones, Publisher registra una salida y Admin ve la trazabilidad.

## Principio de seguridad

La interfaz nunca es la barrera: cada lectura y mutación se protege con RLS en Supabase. Los enlaces de archivos serán firmados y el bucket privado.
