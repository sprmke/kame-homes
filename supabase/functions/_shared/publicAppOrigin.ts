/**
 * Public SPA origin for absolute links in emails and server-side asset URLs.
 *
 * Priority: PUBLIC_GUEST_APP_ORIGIN env → legacy org_settings.public_guest_app_origin
 * → DEFAULT_PUBLIC_GUEST_APP_ORIGIN.
 *
 * Not configurable per org in admin UI — set the env var per deployment.
 */

export const DEFAULT_PUBLIC_GUEST_APP_ORIGIN = 'https://kamehomes.space';

export function resolvePublicGuestAppOrigin(orgStoredOrigin?: string | null): string {
  const fromEnv = Deno.env.get('PUBLIC_GUEST_APP_ORIGIN')?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, '');

  const fromDb = (orgStoredOrigin ?? '').trim();
  if (fromDb) return fromDb.replace(/\/+$/, '');

  return DEFAULT_PUBLIC_GUEST_APP_ORIGIN;
}
