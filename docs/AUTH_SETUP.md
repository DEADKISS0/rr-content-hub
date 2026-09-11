# Activación de Google Auth y roles

## Orden seguro

1. En Supabase, activar **Google** en Authentication → Providers.
2. En Google Cloud, crear OAuth Client (Web application) y añadir la callback que indique Supabase.
3. Configurar Site URL: `https://rr-content-hub.vercel.app` y Redirect URL: `https://rr-content-hub.vercel.app/auth/callback`.
4. Guardar `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` como variables de producción en Vercel. La service role key nunca llega al navegador.
5. Aplicar únicamente `supabase/migrations/20260910_content_hub_isolated.sql`. El proyecto Supabase ya tiene tablas de otro CRM en `public.*`; el Content Hub usa sus propias tablas `rr_hub_*` para no interferir.
6. Promover la cuenta de Rosas a admin mediante SQL controlado:
   `update public.rr_hub_profiles set global_role = 'admin' where email = '<correo-admin>';`
   El trigger `rr_hub_auth_user_created` solo crea perfil para usuarios nuevos; para cuentas que ya existían hay que sembrar la fila antes:
   ```sql
   insert into public.rr_hub_profiles (id, email, full_name, global_role)
   select u.id, u.email, coalesce(u.raw_user_meta_data ->> 'full_name', split_part(u.email, '@', 1)), 'member'
   from auth.users u where u.email is not null
   on conflict (id) do nothing;
   ```
7. Desde Admin, asignar cada correo a proyecto y rol. Los usuarios sin acceso verán `Acceso pendiente`.

## Pruebas de aceptación

- Login/logout y recuperación de sesión.
- Usuario sin proyecto no puede leer datos ni adivinar URLs.
- Cliente solo lee su proyecto y no notas internas.
- Cámara no cambia una aprobación de cliente.
- Editor sube versiones, Publisher registra una salida y Admin ve la trazabilidad.

## Estado aplicado (2026-09-10)

- [x] Tablas `rr_hub_*` creadas (7): `rr_hub_profiles`, `rr_hub_projects`, `rr_hub_access`, `rr_hub_ideas`, `rr_hub_events`, `rr_hub_comments`, `rr_hub_assets`.
- [x] RLS activo en las 7 tablas, con 15 políticas `rr_hub_*` en `public` y 3 en `storage.objects`.
- [x] Funciones `public.rr_hub_is_admin()` y `public.rr_hub_handle_new_user()`; trigger `rr_hub_auth_user_created` en `auth.users`.
- [x] Bucket privado `rr-content-assets` (límite 50 MB) con políticas de lectura/inserción/actualización para usuarios autenticados.
- [x] Proyectos sembrados: `wundeer`, `satiro`, `boga`.
- [x] Google OAuth habilitado (302 real hacia `accounts.google.com`); redirect `https://rr-content-hub.vercel.app/auth/callback` agregada preservando las URLs previas.
- [x] `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL` y `NEXT_PUBLIC_STORAGE_BUCKET` cargadas en Vercel (production/preview/development).
- [x] Perfiles sembrados para las 5 cuentas existentes y `santiago1209andres@gmail.com` promovida a `admin`.

> La migración `20260910_roles_and_workflow.sql` quedó descartada (tocaba tablas `public.profiles`/`user_project_access` del CRM) y se movió a `supabase/_archivo/`. No aplicarla.

## Principio de seguridad

La interfaz nunca es la barrera: cada lectura y mutación se protege con RLS en Supabase. Los enlaces de archivos serán firmados y el bucket privado.
