import { cookies } from 'next/headers';
import { leerSesion, NOMBRE_COOKIE } from '@/lib/hub-session';

/**
 * Quién es la persona que está llamando, según la cookie del hub.
 *
 * Este es el sustituto de `supabase.auth.getUser()` desde que la puerta es un
 * código por cliente (2026-09-28). Antes, saber quién llamaba costaba una ida a
 * la red en cada página; ahora es leer una cookie firmada que ya está en la
 * petición.
 *
 * Lo que devuelve:
 *
 * - `email` es cómo se le reconoce: es la llave en `rr_hub_profiles` y en
 *   `rr_hub_access`. No es una cuenta de Supabase y no se puede iniciar sesión
 *   con él; es solo el identificador de la persona dentro del hub.
 *
 * - `proyecto` es el cliente con el que se entró. Viene en la cookie, y por eso
 *   una persona que está en dos clientes tiene dos puertas distintas: entrar por
 *   la de Wundeer da una cookie de Wundeer.
 *
 * Lo que NO hace: decidir permisos. Que haya cookie solo dice que alguien entró
 * por una puerta válida. Si puede escribir, aprobar o administrar se decide en
 * `rr_hub_access` y en `rr_hub_profiles.global_role`, que se comprueban contra la
 * base. Una cookie válida sin fila de acceso es una puerta que no da permiso
 * ninguno, y por eso esta función devuelve el correo y no el rol.
 */
export async function quienEs(): Promise<{ email: string; nombre: string; proyecto: string } | null> {
  const cookieStore = await cookies();
  const sesion = leerSesion(cookieStore.get(NOMBRE_COOKIE)?.value);
  if (!sesion) return null;
  return { email: sesion.email, nombre: sesion.nombre, proyecto: sesion.proyecto };
}

/** Solo el correo, que es lo que casi todo lo que decide permisos necesita. */
export async function correoDeQuienEntra(): Promise<string | null> {
  return (await quienEs())?.email ?? null;
}

/**
 * El `id` de quien entró, resuelto desde la cookie.
 *
 * Existe para un caso concreto: la subida de archivos, donde el id va dentro
 * de la RUTA del objeto para que el servidor ata el archivo a quien lo subió.
 * Con la puerta por código no hay `auth.uid()`, así que el id se pide a la base
 * por correo, que es como la base relaciona a la gente.
 *
 * Va por la clave del servidor a propósito: el cliente del navegador no puede
 * leer `rr_hub_profiles` con su RLS, y aquí no hace falta que la respuesta le
 * llegue al cliente: solo se usa para construir la ruta.
 */
export async function idDeQuienEntra(): Promise<string | null> {
  const correo = await correoDeQuienEntra();
  if (!correo) return null;
  const { createServiceClient } = await import('@/lib/supabase/service');
  const service = await createServiceClient();
  if (!service) return null;
  const { data } = await service
    .from('rr_hub_profiles')
    .select('id')
    .ilike('email', correo)
    .maybeSingle();
  return data?.id ?? null;
}
