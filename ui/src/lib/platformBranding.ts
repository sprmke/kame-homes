/**
 * Env-driven platform product branding — never hardcode a host org name here.
 * Default product name is Kame Homes. Deployments may set `VITE_PLATFORM_APP_NAME`
 * / `VITE_PLATFORM_CONTACT_EMAIL` for a different operator label.
 */

import { resolvePlatformAppName } from '@/lib/platformAppName';

const envContactEmail = import.meta.env.VITE_PLATFORM_CONTACT_EMAIL?.trim();

/** Product name for marketing, legal, tab titles, PWA install copy, and super-admin chrome. */
export const PLATFORM_APP_NAME = resolvePlatformAppName(import.meta.env.VITE_PLATFORM_APP_NAME);

/** Support / legal contact — falls back to a placeholder when unset. */
export const PLATFORM_CONTACT_EMAIL = envContactEmail || 'support@example.com';

/** @deprecated Prefer `PLATFORM_APP_NAME` — kept for gradual import migration. */
export const APP_TITLE = PLATFORM_APP_NAME;

/** True when migrated single-tenant org labels should not display as a host name. */
export function isLegacyPlatformOrgBrand(label: string | null | undefined): boolean {
  const value = label?.trim() ?? '';
  if (!value) return false;
  return /^kame\s*home(?:\s*[—\-–]\s*azure\s*north(?:\s+residences?)?)?$/i.test(value);
}

/** @deprecated Use `isLegacyPlatformOrgBrand`. */
export const isLegacyKameHomeBrand = isLegacyPlatformOrgBrand;

/** Host org label for guest/marketing surfaces — never falls back to a platform codename. */
export function resolveOrgDisplayName(
  organizationName: string | null | undefined,
  fallback = 'Host'
): string {
  const org = organizationName?.trim();
  if (!org || isLegacyPlatformOrgBrand(org)) return fallback;
  return org;
}

/** App-level browser tab title (`Sign In`, super-admin, onboarding). */
export function appPageTitle(pageName: string): string {
  return PLATFORM_APP_NAME ? `${PLATFORM_APP_NAME} - ${pageName}` : pageName;
}

/** Public marketing tab title. */
export function publicPageTitle(pageName: string): string {
  return appPageTitle(pageName);
}

export function platformCopyrightLine(year = new Date().getFullYear()): string {
  if (PLATFORM_APP_NAME) {
    return `© ${year} ${PLATFORM_APP_NAME}. All rights reserved.`;
  }
  return `© ${year}. All rights reserved.`;
}

/** Split wordmark for mode-switch overlay — null when no platform name is configured. */
export function platformWordmarkParts(): { primary: string; accent: string } | null {
  if (!PLATFORM_APP_NAME) return null;
  const parts = PLATFORM_APP_NAME.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return { primary: parts[0]!, accent: parts.slice(1).join(' ') };
  }
  return { primary: PLATFORM_APP_NAME, accent: '' };
}

export function platformMarkInitial(): string {
  const parts = platformWordmarkParts();
  if (parts?.primary) return parts.primary.charAt(0).toUpperCase();
  return '';
}

/** Uppercase tile for marketing plan-gate watermarks. */
export function platformWatermarkLabel(fallback = 'PREVIEW'): string {
  if (PLATFORM_APP_NAME) return PLATFORM_APP_NAME.toUpperCase();
  return fallback;
}

/** Legal copy — operator name or neutral first person. */
export function platformLegalSubject(): string {
  return PLATFORM_APP_NAME || 'We';
}

export function platformLegalIntro(location = 'Manila, Philippines'): string {
  if (PLATFORM_APP_NAME) {
    return `${PLATFORM_APP_NAME} (“we,” “us”) operates a property-management platform based in ${location}. Contact: ${PLATFORM_CONTACT_EMAIL}.`;
  }
  return `We operate a property-management platform based in ${location}. Contact: ${PLATFORM_CONTACT_EMAIL}.`;
}

/** Generic platform reference for host dashboard copy. */
export function platformProductLabel(): string {
  return PLATFORM_APP_NAME || 'this platform';
}
