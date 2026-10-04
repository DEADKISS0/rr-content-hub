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
/**
 * El cliente, una sola vez por proceso.
 *
 * MEDIDO 2026-10-04: antes esto construye un cliente NUEVO en cada llamada, y
 * `data.ts` lo pide 26 veces. Una ficha de idea encadena nueve de esas llamadas
 * (`getProject`, `rolEnProyecto`, `getIdea`, `getCoverDelAnuncio`, `getVotos`,
 * `getPresencia`, `getEquipoVotante`, y tres en paralelo). Nueve clientes son
 * nueve conexiones de PostgREST con sus propios sockets, y el TTFB de la ficha
 * medido en producción era de **1,3 a 1,7 s** — casi todo eso, el agua de abrir
 * nueve conexiones para leer una tarjeta.
 *
 * La promesa se guarda en una variable de módulo, así que las llamadas que se
 * solapan (las de `Promise.all`) comparten la MISMA construcción, y las que
 * llegan después reciben el cliente ya listo sin volver a crearlo.
 *
 * No hay estado que se pueda ensuciar: el cliente no guarda sesión
 * (`persistSession: false`), y cada petición es independiente por construcción.
 */
let promesaCliente: Promise<SupabaseClient | null> | null = null;

export async function createServiceClient(): Promise<SupabaseClient | null> {
  if (promesaCliente) return promesaCliente;

  promesaCliente = (async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) return null;

    return createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  })();

  return promesaCliente;
}

/**
 * Vacía el cliente cacheado.
 *
 * Solo para los tests, que cambian las variables de entorno entre corrida y sin
 * esto el segundo test seguiría hablando con la base del primero. La app no lo
 * necesita: el cliente no cambia de credenciales en vida de un proceso.
 */
export function olvidarClienteService(): void {
  promesaCliente = null;
}
