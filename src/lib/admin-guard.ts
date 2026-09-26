// `server-only` rompe el build si este módulo termina dentro de un bundle de
// cliente. Una guarda que se filtra al navegador es peor que no tener guarda.
import 'server-only';
import { createClient } from '@/lib/supabase/server';

/**
 * Guarda de las rutas administrativas.
 *
 * Por qué existe: `/audit/admin` renderizaba la lista completa de correos, su
 * rol global y las invitaciones pendientes a quien pidiera la URL. Ocultar el
 * enlace no es un control: la ruta se alcanza escribiéndola.
 *
 * La regla es conservadora a propósito: administrador es quien tiene
 * `rr_hub_profiles.global_role = 'admin'` y nadie más. Un rol de proyecto (owner
 * incluido) no otorga administración.
 *
 * La salida de emergencia importa tanto como la comprobación:
 * `SUPER_ADMIN_EMAILS` permite seguir entrando cuando la tabla está vacía — que
 * es el estado real de producción hoy (las tres tablas de acceso están vacías,
 * así que una guarda puramente de base dejaría a todo el mundo fuera y la única
 * forma de volver sería por SQL). Se configura en Vercel, nunca en el repo.
 */
const SUPER_ADMIN_EMAILS = (process.env.SUPER_ADMIN_EMAILS ?? '')
  .split(',')
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

export type AdminVerdict =
  | { allowed: true; via: 'super-admin-env' | 'database'; email: string }
  | { allowed: false; reason: 'no-session' | 'auth-disabled' | 'not-admin' };

/**
 * Nunca lanza y nunca cuenta el motivo al visitante: una página que responde
 * "estás dentro pero no eres admin" le da a un desconocido una pista para
 * probar credenciales.
 */
export async function requireAdmin(): Promise<AdminVerdict> {
  const email = await currentEmail();
  if (!email) return { allowed: false, reason: 'no-session' };
  if (SUPER_ADMIN_EMAILS.includes(email)) return { allowed: true, via: 'super-admin-env', email };

  const supabase = await createClient();
  if (!supabase) return { allowed: false, reason: 'auth-disabled' };

  const { data, error } = await supabase
    .from('rr_hub_profiles')
    .select('global_role')
    .eq('email', email)
    .maybeSingle();

  if (error || !data) return { allowed: false, reason: 'not-admin' };
  if (data.global_role !== 'admin') return { allowed: false, reason: 'not-admin' };
  return { allowed: true, via: 'database', email };
}

/** ¿Hay correo de sesión? Sin sesión no hay nada que comprobar. */
async function currentEmail(): Promise<string | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.email?.toLowerCase() ?? null;
}

/** ¿Está configurada la salida de emergencia? Lo usa el panel para avisar. */
export function superAdminsConfigured(): boolean {
  return SUPER_ADMIN_EMAILS.length > 0;
}
