/** Default product name when env is unset or still using a retired label. */
export const DEFAULT_PLATFORM_APP_NAME = 'Kame Space';

/**
 * Retired product labels that must never appear as the app/PWA title.
 * Normalized to lowercase alphanumerics, so "Kame Homes", "kame-homes",
 * "KameHomes" and "KAME_HOMES" all resolve to the current default.
 */
const RETIRED_PLATFORM_APP_NAMES = new Set(['stays', 'kamehomes', 'kamehome']);

function normalizePlatformName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/** Resolve the public product name. Always returns a non-empty brand string. */
export function resolvePlatformAppName(raw: string | null | undefined): string {
  const value = raw?.trim() ?? '';
  if (!value || RETIRED_PLATFORM_APP_NAMES.has(normalizePlatformName(value))) {
    return DEFAULT_PLATFORM_APP_NAME;
  }
  return value;
}
