/**
 * Server-side feature availability: cached snapshot + the checks call sites use.
 * See docs/workflow/done/feature-availability-controls.md §4 (server enforcement).
 *
 * Fail-open on a read error (same posture as `platformSettingsCache.ts`): a flaky
 * `feature_availability_overrides` read must never take down a working feature for
 * every host. The super-admin write path (`feature-availability` function) busts this
 * isolate's cache immediately; other isolates pick up a change within `CACHE_TTL_MS`.
 */

import { createServiceClient } from './orgAuth.ts';
import type { AuthenticatedUser } from './orgAuth.ts';
import { isSuperAdminEmail } from './orgAuth.ts';
import { jsonFeatureUnavailable } from './httpResponse.ts';
import {
  FEATURE_AVAILABILITY_CATALOG,
  FEATURE_AVAILABILITY_REASON_COPY,
  getFeatureAvailabilityCatalogEntry,
  type FeatureAvailabilityKey,
} from './featureAvailabilityCatalog.ts';
import {
  resolveFeatureAvailability,
  type FeatureAvailabilityOverrideRow,
  type ResolvedFeatureAvailability,
} from './featureAvailabilityResolve.ts';

const CACHE_TTL_MS = 60_000;
const READ_ERROR_LOG_INTERVAL_MS = 60_000;

let cachedRows: { at: number; rows: FeatureAvailabilityOverrideRow[] } | null = null;
let lastReadErrorLoggedAt = 0;

const OVERRIDE_COLUMNS =
  'feature_key, is_enabled, reason, message, expected_back_at, auto_restore, show_banner, super_admin_bypass, updated_at';

async function loadOverrideRows(): Promise<FeatureAvailabilityOverrideRow[]> {
  const now = Date.now();
  if (cachedRows && now - cachedRows.at < CACHE_TTL_MS) {
    return cachedRows.rows;
  }

  try {
    const sb = createServiceClient();
    const { data, error } = await sb
      .from('feature_availability_overrides')
      .select(OVERRIDE_COLUMNS)
      .limit(500);
    if (error) throw error;
    const rows = (data ?? []) as FeatureAvailabilityOverrideRow[];
    cachedRows = { at: now, rows };
    return rows;
  } catch (err) {
    if (now - lastReadErrorLoggedAt > READ_ERROR_LOG_INTERVAL_MS) {
      console.error('[featureAvailability] read failed, failing open', err);
      lastReadErrorLoggedAt = now;
    }
    const rows: FeatureAvailabilityOverrideRow[] = [];
    cachedRows = { at: now, rows };
    return rows;
  }
}

/** Resolved availability for every catalog key, computed fresh against the (cached) rows. */
export async function getFeatureAvailabilitySnapshot(): Promise<
  Map<FeatureAvailabilityKey, ResolvedFeatureAvailability>
> {
  const rows = await loadOverrideRows();
  return resolveFeatureAvailability(FEATURE_AVAILABILITY_CATALOG, rows, new Date());
}

/** The (cached) raw override rows — `get-feature-availability` uses this for each entry's `updatedAt`. */
export async function getFeatureAvailabilityRows(): Promise<FeatureAvailabilityOverrideRow[]> {
  return loadOverrideRows();
}

export function resolveFeatureUnavailableMessage(resolved: ResolvedFeatureAvailability): string {
  if (resolved.message) return resolved.message;
  if (!resolved.reason) return 'This feature is temporarily unavailable.';
  const copy = FEATURE_AVAILABILITY_REASON_COPY[resolved.reason];
  const provider = resolved.sourceKey
    ? getFeatureAvailabilityCatalogEntry(resolved.sourceKey)?.provider
    : undefined;
  const template = copy.defaultMessage ?? 'This feature is temporarily unavailable.';
  return provider ? template.replace('{provider}', provider) : template;
}

/**
 * Pure bypass check, exported for testing without a live Supabase client: super-admin
 * bypass only applies when `user` is passed, the blocking row has
 * `super_admin_bypass = true`, and the email is on `SUPER_ADMIN_EMAILS`. Background
 * jobs (crons, webhooks) never pass a user and therefore never bypass.
 */
export function isBypassedByUser(
  resolved: ResolvedFeatureAvailability,
  user: AuthenticatedUser | undefined
): boolean {
  return Boolean(user && resolved.superAdminBypass && isSuperAdminEmail(user.email));
}

export async function isFeatureAvailable(
  key: FeatureAvailabilityKey,
  options?: { user?: AuthenticatedUser }
): Promise<boolean> {
  const snapshot = await getFeatureAvailabilitySnapshot();
  const resolved = snapshot.get(key);
  if (!resolved || resolved.available) return true;
  return isBypassedByUser(resolved, options?.user);
}

/** Returns a ready 503 when `key` is off (and not bypassed), or `null` to proceed. */
export async function featureUnavailableResponse(
  req: Request,
  key: FeatureAvailabilityKey,
  options?: { user?: AuthenticatedUser }
): Promise<Response | null> {
  const snapshot = await getFeatureAvailabilitySnapshot();
  const resolved = snapshot.get(key);
  if (!resolved || resolved.available) return null;
  if (isBypassedByUser(resolved, options?.user)) return null;
  return jsonFeatureUnavailable(req, {
    feature: key,
    error: resolveFeatureUnavailableMessage(resolved),
    reason: resolved.reason,
    expectedBackAt: resolved.expectedBackAt,
  });
}

/** Thrown by `assertFeatureAvailable` for helpers that aren't holding a `Request` to build a 503 from directly. */
export class FeatureUnavailableError extends Error {
  readonly feature: FeatureAvailabilityKey;
  readonly reason: string | null;
  readonly expectedBackAt: string | null;

  constructor(resolved: ResolvedFeatureAvailability) {
    super(resolveFeatureUnavailableMessage(resolved));
    this.name = 'FeatureUnavailableError';
    this.feature = resolved.key;
    this.reason = resolved.reason;
    this.expectedBackAt = resolved.expectedBackAt;
  }
}

/** Throws `FeatureUnavailableError` when `key` is off (and not bypassed). */
export async function assertFeatureAvailable(
  key: FeatureAvailabilityKey,
  options?: { user?: AuthenticatedUser }
): Promise<void> {
  const snapshot = await getFeatureAvailabilitySnapshot();
  const resolved = snapshot.get(key);
  if (!resolved || resolved.available) return;
  if (isBypassedByUser(resolved, options?.user)) return;
  throw new FeatureUnavailableError(resolved);
}

/** Converts a caught `FeatureUnavailableError` into its 503, or `null` for any other error. */
export function catchFeatureUnavailableError(req: Request, err: unknown): Response | null {
  if (!(err instanceof FeatureUnavailableError)) return null;
  return jsonFeatureUnavailable(req, {
    feature: err.feature,
    error: err.message,
    reason: err.reason,
    expectedBackAt: err.expectedBackAt,
  });
}

/**
 * Called by the `feature-availability` write function right after a successful
 * PUT/DELETE, so this isolate reflects the change immediately. Other isolates pick it
 * up within `CACHE_TTL_MS` (documented in super admin as "takes up to a minute to
 * reach everyone").
 */
export function invalidateFeatureAvailabilityCache(): void {
  cachedRows = null;
}

/** Test helper — bust isolate cache between Deno tests. */
export function resetFeatureAvailabilityCacheForTests(): void {
  cachedRows = null;
  lastReadErrorLoggedAt = 0;
}

/** True when outbound Telegram delivery is paused (crons and sendMessage sites). */
export async function telegramDeliveryUnavailable(): Promise<boolean> {
  return !(await isFeatureAvailable('notifications.telegram.delivery'));
}

/** Send helpers return this error when `notifications.telegram.delivery` is off. */
export function isTelegramFeatureUnavailableError(error: string | undefined): boolean {
  return error === 'feature_unavailable';
}

export function mapTelegramSendErrorToNotifySkip(
  error: string | undefined
): 'feature_unavailable' | 'missing_env' | 'send_failed' {
  if (error === 'feature_unavailable') return 'feature_unavailable';
  if (error === 'missing_env') return 'missing_env';
  return 'send_failed';
}

export type AssistantFeatureAvailabilitySummary = {
  available: boolean;
  message: string | null;
};

/** Resolved availability + host-facing message for dashboard assistant tools. */
export async function featureAvailabilitySummaryForAssistant(
  keys: readonly FeatureAvailabilityKey[],
  user?: AuthenticatedUser
): Promise<Record<FeatureAvailabilityKey, AssistantFeatureAvailabilitySummary>> {
  const snapshot = await getFeatureAvailabilitySnapshot();
  const out = {} as Record<FeatureAvailabilityKey, AssistantFeatureAvailabilitySummary>;
  for (const key of keys) {
    const available = await isFeatureAvailable(key, { user });
    const resolved = snapshot.get(key);
    out[key] = {
      available,
      message: available
        ? null
        : resolved
          ? resolveFeatureUnavailableMessage(resolved)
          : 'This feature is temporarily unavailable.',
    };
  }
  return out;
}
