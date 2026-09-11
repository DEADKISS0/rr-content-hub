/**
 * Public mode switch.
 *
 * `NEXT_PUBLIC_AUTH_ENABLED=true` restores the Google login gate.
 * Anything else (or unset) leaves the whole hub open, browse-only, with no
 * credentials required. This is the only value to flip when the audit ends.
 */
export const AUTH_ENABLED = process.env.NEXT_PUBLIC_AUTH_ENABLED === 'true';
export const PUBLIC_MODE = !AUTH_ENABLED;
