/**
 * The demo fixtures are a development convenience, never a production fallback.
 *
 * `createClient()` returns `null` when the Supabase env vars are missing, and
 * fourteen call sites in `data.ts` used to answer that with `demoIdeas` /
 * `demoProjects`. In production that meant: if a single `NEXT_PUBLIC_*` var
 * were renamed or dropped, the hub would not fail — it would serve Wundeer's
 * roadmap backed by invented August-2026 ideas, and hand the caller an
 * `admin` role. A silent wrong answer is worse than a loud one.
 *
 * `NEXT_PUBLIC_HUB_DEMO=true` is the only way to get the fixtures, and it is
 * for working on the UI without credentials.
 */
type EntornoDemo = {
  NEXT_PUBLIC_HUB_DEMO?: string;
  VERCEL_ENV?: string;
  [clave: string]: string | undefined;
};

/**
 * El preview puede usar datos ficticios, pero producción debe negarse a
 * arrancar si alguien activa la bandera por error. `VERCEL_ENV` distingue el
 * preview del despliegue productivo aunque ambos se construyan con
 * `NODE_ENV=production`.
 */
export function resolverModoDemo(env: EntornoDemo): boolean {
  const solicitado = env.NEXT_PUBLIC_HUB_DEMO === 'true';
  if (solicitado && env.VERCEL_ENV === 'production') {
    throw new Error('El modo demo no puede activarse en produccion. Retira NEXT_PUBLIC_HUB_DEMO antes de desplegar.');
  }
  return solicitado;
}

export const DEMO_MODE = resolverModoDemo(process.env);

export class SupabaseNotConfiguredError extends Error {
  constructor() {
    super(
      'Supabase no está configurado. Define NEXT_PUBLIC_SUPABASE_URL y ' +
      'NEXT_PUBLIC_SUPABASE_ANON_KEY, o pon NEXT_PUBLIC_HUB_DEMO=true para ' +
      'trabajar con datos ficticios.',
    );
    this.name = 'SupabaseNotConfiguredError';
  }
}
