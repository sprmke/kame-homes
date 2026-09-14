/** Keep in sync with `ui/src/lib/platformAppName.ts`. */
export const DEFAULT_PLATFORM_APP_NAME = 'Kame Homes';
const RETIRED_PLATFORM_APP_NAMES = new Set(['stays']);

export function resolvePlatformAppName(raw: string | null | undefined): string {
  const value = raw?.trim() ?? '';
  if (!value || RETIRED_PLATFORM_APP_NAMES.has(value.toLowerCase())) {
    return DEFAULT_PLATFORM_APP_NAME;
  }
  return value;
}

/** Platform product brand — not a specific host org or residence. */
export const PLATFORM_BRAND_NAME = resolvePlatformAppName(Deno.env.get('PLATFORM_APP_NAME'));

/** True when a label is the old single-tenant brand (optionally with Azure North). */
export function isLegacyKameHomeBrand(label: string | null | undefined): boolean {
  const value = label?.trim() ?? '';
  if (!value) return false;
  // "Kame Home", "KameHome", "Kame Home — Azure North", "Kame Home - Azure North Residences"
  return /^kame\s*home(?:\s*[—\-–]\s*azure\s*north(?:\s+residences?)?)?$/i.test(value);
}

/**
 * Host org label for email/public chrome.
 * Maps legacy single-tenant labels to the configured platform name; returns null when unset.
 */
export function resolvePublicBrandName(organizationName: string | null | undefined): string | null {
  const org = organizationName?.trim();
  if (!org) return null;
  if (isLegacyKameHomeBrand(org)) return PLATFORM_BRAND_NAME || null;
  return org;
}
