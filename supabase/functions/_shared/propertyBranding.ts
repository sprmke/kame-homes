/**
 * Per-property branding + social links with org → env fallbacks.
 */

import { createServiceClient } from './orgAuth.ts';
import { resolveOrganizationIdForProperty } from './propertyScope.ts';
import {
  DEFAULT_ORG_BRAND_COLOR,
  resolveOrgBrandColorFromSettings,
} from './orgSettingsValidation.ts';
import { resolveFacebookPageUrl, resolveOptionalSocialUrl } from './orgSocialLinks.ts';

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

const CACHE_TTL_MS = 30_000;
const brandCacheByProperty = new Map<string, { at: number; color: string }>();

export function invalidatePropertyBrandColorCache(propertyId?: string | null): void {
  if (propertyId) brandCacheByProperty.delete(propertyId);
  else brandCacheByProperty.clear();
}

function trimOrEmpty(v: string | null | undefined): string {
  return (v ?? '').trim();
}

export function resolvePropertyBrandColor(
  propertyStored?: string | null,
  orgSettings?: Record<string, unknown> | null
): string {
  const fromProperty = trimOrEmpty(propertyStored);
  if (fromProperty && HEX_COLOR_RE.test(fromProperty)) {
    return fromProperty;
  }
  return resolveOrgBrandColorFromSettings(orgSettings);
}

export function resolvePropertyFacebookUrl(
  propertyStored?: string | null,
  orgStored?: string | null
): string {
  const fromProperty = trimOrEmpty(propertyStored);
  if (fromProperty) return fromProperty;
  return resolveFacebookPageUrl(orgStored || null);
}

export function resolvePropertyOptionalSocialUrl(
  propertyStored?: string | null,
  orgStored?: string | null,
  envKey?: string
): string {
  const fromProperty = trimOrEmpty(propertyStored);
  if (fromProperty) return fromProperty;
  return resolveOptionalSocialUrl(orgStored || null, envKey);
}

export async function loadResolvedBrandColorByPropertyId(
  propertyId?: string | null
): Promise<string> {
  if (!propertyId) return DEFAULT_ORG_BRAND_COLOR;

  const now = Date.now();
  const cached = brandCacheByProperty.get(propertyId);
  if (cached && now - cached.at < CACHE_TTL_MS) {
    return cached.color;
  }

  const supabase = createServiceClient();
  const { data: appRow, error: appErr } = await supabase
    .from('app_settings')
    .select('brand_color')
    .eq('property_id', propertyId)
    .maybeSingle();

  if (appErr) {
    console.warn('[propertyBranding] app_settings load failed:', appErr.message);
  }

  const organizationId = await resolveOrganizationIdForProperty(propertyId);
  const { data: orgRow, error: orgErr } = await supabase
    .from('organizations')
    .select('settings')
    .eq('id', organizationId)
    .maybeSingle();

  if (orgErr) {
    console.warn('[propertyBranding] org load failed:', orgErr.message);
  }

  const orgSettings =
    orgRow?.settings && typeof orgRow.settings === 'object' && !Array.isArray(orgRow.settings)
      ? (orgRow.settings as Record<string, unknown>)
      : null;

  const color = resolvePropertyBrandColor(
    appRow?.brand_color as string | null | undefined,
    orgSettings
  );
  brandCacheByProperty.set(propertyId, { at: now, color });
  return color;
}
