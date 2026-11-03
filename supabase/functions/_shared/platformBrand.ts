/** Keep in sync with `ui/src/lib/platformAppName.ts`. */
export const DEFAULT_PLATFORM_APP_NAME = 'Kame Space';

/**
 * Retired product labels that must never render, whatever an env still says.
 * Normalized to lowercase alphanumerics, so "Kame Homes", "kame-homes",
 * "KameHomes" and "KAME_HOMES" all resolve to the current default.
 */
const RETIRED_PLATFORM_APP_NAMES = new Set(['stays', 'kamehomes', 'kamehome']);

function normalizePlatformName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function resolvePlatformAppName(raw: string | null | undefined): string {
  const value = raw?.trim() ?? '';
  if (!value || RETIRED_PLATFORM_APP_NAMES.has(normalizePlatformName(value))) {
    return DEFAULT_PLATFORM_APP_NAME;
  }
  return value;
}

/** Platform product brand — not a specific host org or residence. */
export const PLATFORM_BRAND_NAME = resolvePlatformAppName(Deno.env.get('PLATFORM_APP_NAME'));

/** True when a label is the old single-tenant brand (optionally with Azure North). */
export function isLegacyPlatformBrand(label: string | null | undefined): boolean {
  const value = label?.trim() ?? '';
  if (!value) return false;
  // "Kame Home(s)", "KameHome(s)", "Kame Home(s) — Azure North", "Kame Home(s) - Azure North Residences"
  return /^kame\s*homes?(?:\s*[—\-–]\s*azure\s*north(?:\s+residences?)?)?$/i.test(value);
}

/** @deprecated Use `isLegacyPlatformBrand`. */
export const isLegacyKameHomeBrand = isLegacyPlatformBrand;

/**
 * Host org label for email/public chrome.
 * Maps legacy single-tenant labels to the configured platform name; returns null when unset.
 */
export function resolvePublicBrandName(organizationName: string | null | undefined): string | null {
  const org = organizationName?.trim();
  if (!org) return null;
  if (isLegacyPlatformBrand(org)) return PLATFORM_BRAND_NAME || null;
  return org;
}
