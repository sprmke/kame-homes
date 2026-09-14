/** Default product name when env is unset or still using the retired placeholder. */
export const DEFAULT_PLATFORM_APP_NAME = 'Kame Homes';

/** Retired product labels that must never appear as the app/PWA title. */
const RETIRED_PLATFORM_APP_NAMES = new Set(['stays']);

/** Resolve the public product name. Always returns a non-empty brand string. */
export function resolvePlatformAppName(raw: string | null | undefined): string {
  const value = raw?.trim() ?? '';
  if (!value || RETIRED_PLATFORM_APP_NAMES.has(value.toLowerCase())) {
    return DEFAULT_PLATFORM_APP_NAME;
  }
  return value;
}
