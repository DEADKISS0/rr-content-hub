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
export const DEMO_MODE = process.env.NEXT_PUBLIC_HUB_DEMO === 'true';

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
