/**
 * Projects the hub exposes.
 *
 * Satiro and BOGA still exist in Supabase, but the hub now shows Wundeer only.
 * This list gates every read path — navigation, home, the audit index and the
 * project loader — so nothing else can leak back into the interface.
 */
export const VISIBLE_PROJECT_SLUGS = ['wundeer'] as const;

export function isVisibleProject(slug?: string | null): boolean {
  return Boolean(slug) && (VISIBLE_PROJECT_SLUGS as readonly string[]).includes(slug as string);
}
