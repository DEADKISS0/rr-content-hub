import 'server-only';

import { createServiceClient } from '@/lib/supabase/service';
import { INTENTOS_MAXIMOS, VENTANA_MS } from '@/lib/rate-limit';

function ahoraMs(): number {
  return Date.now();
}

/** ¿Puede este origen seguir intentando en esta ruta? */
export async function checkDbLimit(ip: string, path: string, max = INTENTOS_MAXIMOS): Promise<boolean> {
  const supabase = await createServiceClient();
  if (!supabase) return true;
  const { data } = await supabase
    .from('rr_hub_rate_limit')
    .select('count, window_start')
    .eq('ip', ip)
    .eq('path', path)
    .maybeSingle();
  if (!data) return true;
  const windowStart = new Date(data.window_start).getTime();
  const ahora = ahoraMs();
  if (ahora >= windowStart + VENTANA_MS) return true;
  return data.count < max;
}

/** Registra un intento fallido de forma atomica en Postgres. */
export async function recordDbFailure(ip: string, path: string): Promise<void> {
  const supabase = await createServiceClient();
  if (!supabase) return;
  const { error } = await supabase.rpc('rr_hub_rate_limit_failure', {
    p_ip: ip,
    p_path: path,
    p_window_seconds: Math.ceil(VENTANA_MS / 1000),
  });
  if (error) console.error('[rate-limit] no se pudo registrar el intento:', error.message);
}

/** Borra la cuenta tras un acierto. */
export async function recordDbSuccess(ip: string, path: string): Promise<void> {
  const supabase = await createServiceClient();
  if (!supabase) return;
  await supabase.from('rr_hub_rate_limit').delete().eq('ip', ip).eq('path', path);
}

/** Segundos para reintentar, leyendo de la tabla. */
export async function retryAfterDb(ip: string, path: string): Promise<number> {
  const supabase = await createServiceClient();
  if (!supabase) return 0;
  const { data } = await supabase
    .from('rr_hub_rate_limit')
    .select('window_start')
    .eq('ip', ip)
    .eq('path', path)
    .maybeSingle();
  if (!data) return 0;
  const windowStart = new Date(data.window_start).getTime();
  const ahora = ahoraMs();
  if (ahora >= windowStart + VENTANA_MS) return 0;
  return Math.max(1, Math.ceil((windowStart + VENTANA_MS - ahora) / 1000));
}

/** Poda las cuentas vencidas de esta IP+ruta. Devuelve true si se borró. */
export async function pruneDb(ip: string, path: string): Promise<boolean> {
  const supabase = await createServiceClient();
  if (!supabase) return true;
  const { data } = await supabase
    .from('rr_hub_rate_limit')
    .select('window_start')
    .eq('ip', ip)
    .eq('path', path)
    .maybeSingle();
  if (!data) return true;
  const windowStart = new Date(data.window_start).getTime();
  const ahora = ahoraMs();
  if (ahora >= windowStart + VENTANA_MS) {
    await supabase.from('rr_hub_rate_limit').delete().eq('ip', ip).eq('path', path);
    return true;
  }
  return false;
}
