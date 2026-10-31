/**
 * Per-parking branding with org fallback.
 */

import { createServiceClient } from './orgAuth.ts';
import {
  DEFAULT_ORG_BRAND_COLOR,
  resolveOrgBrandColorFromSettings,
} from './orgSettingsValidation.ts';

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

const CACHE_TTL_MS = 30_000;
const brandCacheByParking = new Map<string, { at: number; color: string }>();

export function invalidateParkingBrandColorCache(parkingId?: string | null): void {
  if (parkingId) brandCacheByParking.delete(parkingId);
  else brandCacheByParking.clear();
}

function trimOrEmpty(v: string | null | undefined): string {
  return (v ?? '').trim();
}

export function resolveParkingBrandColor(
  parkingStored?: string | null,
  orgSettings?: Record<string, unknown> | null
): string {
  const fromParking = trimOrEmpty(parkingStored);
  if (fromParking && HEX_COLOR_RE.test(fromParking)) {
    return fromParking;
  }
  return resolveOrgBrandColorFromSettings(orgSettings);
}

export async function loadResolvedBrandColorByParkingId(
  parkingId?: string | null
): Promise<string> {
  if (!parkingId) return DEFAULT_ORG_BRAND_COLOR;

  const now = Date.now();
  const cached = brandCacheByParking.get(parkingId);
  if (cached && now - cached.at < CACHE_TTL_MS) {
    return cached.color;
  }

  const supabase = createServiceClient();
  const { data: parkingRow, error: parkingErr } = await supabase
    .from('parkings')
    .select('settings, organization_id')
    .eq('id', parkingId)
    .maybeSingle();

  if (parkingErr || !parkingRow) {
    return DEFAULT_ORG_BRAND_COLOR;
  }

  const settings = (parkingRow.settings ?? {}) as Record<string, unknown>;
  const stored = typeof settings.brandColor === 'string' ? settings.brandColor.trim() : '';

  const { data: orgRow } = await supabase
    .from('organizations')
    .select('settings')
    .eq('id', parkingRow.organization_id)
    .maybeSingle();

  const orgSettings = (orgRow?.settings ?? {}) as Record<string, unknown>;
  const color = resolveParkingBrandColor(stored, orgSettings);

  brandCacheByParking.set(parkingId, { at: now, color });
  return color;
}
