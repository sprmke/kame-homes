/**
 * Cached read of the `platform_settings` singleton for public edge consumers.
 * Super-admin writes via `platform-settings`; guest/host flows read here.
 */

import { createServiceClient } from './orgAuth.ts';
import { jsonError } from './httpResponse.ts';

export type PlatformSettingsSnapshot = {
  signupsEnabled: boolean;
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
  publicRateLimitPerMin: number;
  defaultPlanCode: string | null;
  authenticatedRateLimitEnforce: boolean;
  authenticatedRateLimitPerMin: number;
};

const DEFAULT_PUBLIC_RATE_LIMIT_PER_MIN = 60;
const DEFAULT_AUTHENTICATED_RATE_LIMIT_PER_MIN = 300;
const CACHE_TTL_MS = 60_000;

let cached: { at: number; value: PlatformSettingsSnapshot } | null = null;

function compileDefaults(): PlatformSettingsSnapshot {
  return {
    signupsEnabled: true,
    maintenanceMode: false,
    maintenanceMessage: null,
    publicRateLimitPerMin: DEFAULT_PUBLIC_RATE_LIMIT_PER_MIN,
    defaultPlanCode: null,
    // Fail open on a settings-read error: never start 429-ing authenticated
    // traffic because the platform_settings read hiccuped.
    authenticatedRateLimitEnforce: false,
    authenticatedRateLimitPerMin: DEFAULT_AUTHENTICATED_RATE_LIMIT_PER_MIN,
  };
}

export async function getPlatformSettingsSnapshot(): Promise<PlatformSettingsSnapshot> {
  const now = Date.now();
  if (cached && now - cached.at < CACHE_TTL_MS) {
    return cached.value;
  }

  try {
    const sb = createServiceClient();
    const { data, error } = await sb
      .from('platform_settings')
      .select(
        'signups_enabled, maintenance_mode, maintenance_message, public_rate_limit_per_min, default_plan_code, authenticated_rate_limit_enforce, authenticated_rate_limit_per_min'
      )
      .eq('id', 1)
      .maybeSingle();

    if (error || !data) {
      const value = compileDefaults();
      cached = { at: now, value };
      return value;
    }

    const rawLimit = Number(data.public_rate_limit_per_min ?? DEFAULT_PUBLIC_RATE_LIMIT_PER_MIN);
    const rawAuthLimit = Number(
      data.authenticated_rate_limit_per_min ?? DEFAULT_AUTHENTICATED_RATE_LIMIT_PER_MIN
    );
    const value: PlatformSettingsSnapshot = {
      signupsEnabled: data.signups_enabled !== false,
      maintenanceMode: data.maintenance_mode === true,
      maintenanceMessage:
        typeof data.maintenance_message === 'string' && data.maintenance_message.trim()
          ? data.maintenance_message.trim()
          : null,
      publicRateLimitPerMin:
        Number.isInteger(rawLimit) && rawLimit >= 1 && rawLimit <= 10_000
          ? rawLimit
          : DEFAULT_PUBLIC_RATE_LIMIT_PER_MIN,
      defaultPlanCode:
        typeof data.default_plan_code === 'string' && data.default_plan_code.trim()
          ? data.default_plan_code.trim()
          : null,
      authenticatedRateLimitEnforce: data.authenticated_rate_limit_enforce === true,
      authenticatedRateLimitPerMin:
        Number.isInteger(rawAuthLimit) && rawAuthLimit >= 1 && rawAuthLimit <= 100_000
          ? rawAuthLimit
          : DEFAULT_AUTHENTICATED_RATE_LIMIT_PER_MIN,
    };
    cached = { at: now, value };
    return value;
  } catch {
    const value = compileDefaults();
    cached = { at: now, value };
    return value;
  }
}

export async function getPublicRateLimitPerMin(): Promise<number> {
  const settings = await getPlatformSettingsSnapshot();
  return settings.publicRateLimitPerMin;
}

/** Returns a ready 403 when signups are disabled, or null to proceed. */
export async function signupsDisabledResponse(req: Request): Promise<Response | null> {
  const settings = await getPlatformSettingsSnapshot();
  if (settings.signupsEnabled) return null;
  return jsonError(req, 'New sign-ups are temporarily unavailable.', 403);
}

/** Returns 503 during maintenance for mutating guest/host onboarding flows, or null. */
export async function maintenanceModeResponse(req: Request): Promise<Response | null> {
  const settings = await getPlatformSettingsSnapshot();
  if (!settings.maintenanceMode) return null;
  const message =
    settings.maintenanceMessage ??
    'We are performing maintenance. Please try again in a few minutes.';
  return jsonError(req, message, 503);
}

/** Test helper — bust isolate cache between Deno tests. */
export function resetPlatformSettingsCacheForTests(): void {
  cached = null;
}
