export const DEFAULT_FACEBOOK_PAGE_URL = 'https://www.facebook.com';

export function resolveFacebookPageUrl(orgStoredUrl?: string | null): string {
  const fromDb = (orgStoredUrl ?? '').trim();
  if (fromDb) return fromDb;

  const fromEnv = Deno.env.get('FACEBOOK_REVIEWS_URL')?.trim();
  if (fromEnv) return fromEnv;

  return DEFAULT_FACEBOOK_PAGE_URL;
}

export function resolveOptionalSocialUrl(orgStoredUrl?: string | null, envKey?: string): string {
  const fromDb = (orgStoredUrl ?? '').trim();
  if (fromDb) return fromDb;

  if (envKey) {
    const fromEnv = Deno.env.get(envKey)?.trim();
    if (fromEnv) return fromEnv;
  }

  return '';
}
