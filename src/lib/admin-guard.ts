// `server-only` throws if this module is ever pulled into a client bundle —
// a guard that leaks is worse than no guard. Next provides it; the explicit
// dependency just pins the version alongside the rest.
import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { correoDeQuienEntra } from '@/lib/quien-es';

/**
 * Gate for administrative routes.
 *
 * Why this exists: `/audit/admin` rendered the whole roster — every email,
 * their global role and every pending invitation — to anyone who asked for the
 * URL. Hiding the link is not a control; the route was reachable.
 *
 * The rule is deliberately conservative: an administrator is somebody whose
 * `rr_hub_profiles.global_role` is `admin`, and nobody else. Project roles do
 * not grant admin. A viewer is never enough.
 *
 * The escape hatch matters as much as the check. `SUPER_ADMIN_EMAILS` lets a
 * human keep working when the table is empty — which is exactly the state
 * production is in right now (all three access tables are empty, so a strict
 * database-only check would lock everyone out with no way back in but SQL).
 * Configure it in Vercel, never in the repo.
 */
const SUPER_ADMIN_EMAILS = (process.env.SUPER_ADMIN_EMAILS ?? '')
  .split(',')
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

export type AdminVerdict =
  | { allowed: true; via: 'super-admin-env' | 'database'; email: string }
  | { allowed: false; reason: 'no-session' | 'auth-disabled' | 'not-admin' };

/**
 * Never throws and never leaks why. A page that tells an anonymous visitor
 * "you are logged in but not an admin" is giving them a probe to test
 * credentials with.
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

/**
 * El correo de quien entró por la puerta. Desde el 2026-09-28 la puerta es un
 * código por cliente, así que esto lee la cookie firmada del hub y no pregunta
 * a Supabase Auth. El resultado es el mismo —el correo con el que esa persona
 * está en `rr_hub_profiles`— y es más rápido: no hay ida a la red.
 */
async function currentEmail(): Promise<string | null> {
  return correoDeQuienEntra();
}
