import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * El cliente que escribe, saltándose el RLS.
 *
 * Existe porque el hub hace muchas cosas con la clave del servidor: leer los
 * códigos de los clientes, comprobar quién tiene acceso, contar votos. El RLS de
 * `rr_hub_projects` está pensado para que el navegador no lea los códigos, y eso
 * está bien — el código no debe viajar al cliente de ninguna manera.
 *
 * Por eso la puerta va por aquí y no por `@/lib/supabase/server`, que va con la
 * clave anónima y con las cookies de sesión: si la puerta usara ese cliente, el
 * código no se podría comprobar sin exponerlo.
 *
 * `SUPABASE_SERVICE_ROLE_KEY` no lleva `NEXT_PUBLIC_` a propósito: sin ese
 * prefijo, Next.js no la mete en el bundle del navegador, y una clave de
 * servidor en el bundle del navegador es la puerta abierta del otro lado.
 */
export async function createServiceClient(): Promise<SupabaseClient | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
