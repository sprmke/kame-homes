/**
 * Pure cascade resolver for feature availability — no I/O, same shape mirrored at
 * `ui/src/lib/featureAvailability/resolveFeatureAvailability.ts` (parity test).
 * See docs/workflow/done/feature-availability-controls.md §1/§Data model.
 */

import {
  FEATURE_AVAILABILITY_CATALOG,
  isFeatureAvailabilityReason,
  type FeatureAvailabilityCatalogEntry,
  type FeatureAvailabilityKey,
  type FeatureAvailabilityReason,
} from './featureAvailabilityCatalog.ts';

/** Shape of a row from `feature_availability_overrides` (snake_case, as read from Postgres). */
export interface FeatureAvailabilityOverrideRow {
  feature_key: string;
  is_enabled: boolean;
  reason: string | null;
  message: string | null;
  expected_back_at: string | null;
  auto_restore: boolean;
  show_banner: boolean;
  super_admin_bypass: boolean;
  updated_at?: string | null;
}

export interface ResolvedFeatureAvailability {
  key: FeatureAvailabilityKey;
  available: boolean;
  /** Which row made it unavailable. `null` when available. */
  source: 'self' | 'parent' | null;
  /** Catalog key whose row actually carries the reason/message (== `key` when `source: 'self'`). */
  sourceKey: FeatureAvailabilityKey | null;
  reason: FeatureAvailabilityReason | null;
  message: string | null;
  expectedBackAt: string | null;
  autoRestore: boolean;
  showBanner: boolean;
  superAdminBypass: boolean;
  /** `expected_back_at` passed and `auto_restore` is off — still unavailable, copy changes to "taking longer than expected". */
  overdue: boolean;
  /** `expected_back_at` passed and `auto_restore` is on — available again at read time, no write needed. */
  restoredAutomatically: boolean;
}

function isRowEffectivelyOff(row: FeatureAvailabilityOverrideRow, now: Date): boolean {
  if (row.is_enabled) return false;
  if (row.auto_restore && row.expected_back_at) {
    return new Date(row.expected_back_at).getTime() > now.getTime();
  }
  return true;
}

function isRowOverdue(row: FeatureAvailabilityOverrideRow, now: Date): boolean {
  if (row.is_enabled || row.auto_restore || !row.expected_back_at) return false;
  return new Date(row.expected_back_at).getTime() <= now.getTime();
}

function isRowRestoredAutomatically(row: FeatureAvailabilityOverrideRow, now: Date): boolean {
  if (row.is_enabled || !row.auto_restore || !row.expected_back_at) return false;
  return new Date(row.expected_back_at).getTime() <= now.getTime();
}

function available(key: FeatureAvailabilityKey): ResolvedFeatureAvailability {
  return {
    key,
    available: true,
    source: null,
    sourceKey: null,
    reason: null,
    message: null,
    expectedBackAt: null,
    autoRestore: false,
    showBanner: false,
    superAdminBypass: false,
    overdue: false,
    restoredAutomatically: false,
  };
}

function unavailableFrom(
  key: FeatureAvailabilityKey,
  source: 'self' | 'parent',
  sourceKey: FeatureAvailabilityKey,
  row: FeatureAvailabilityOverrideRow,
  now: Date
): ResolvedFeatureAvailability {
  return {
    key,
    available: false,
    source,
    sourceKey,
    reason: row.reason && isFeatureAvailabilityReason(row.reason) ? row.reason : null,
    message: row.message ?? null,
    expectedBackAt: row.expected_back_at ?? null,
    autoRestore: row.auto_restore,
    showBanner: row.show_banner,
    superAdminBypass: row.super_admin_bypass,
    overdue: isRowOverdue(row, now),
    restoredAutomatically: false,
  };
}

/**
 * Resolves every catalog key against the given override rows at time `now`.
 * No row for a key = available (fail-open). A key is off when it or any ancestor is
 * off; when an ancestor is off, `source: 'parent'` and the ancestor's reason/message
 * are reported (cascade rule, plan §1). Rows whose `feature_key` is not in `catalog`
 * are ignored here — the super-admin list surfaces them separately as "Unused".
 */
export function resolveFeatureAvailability(
  catalog: readonly FeatureAvailabilityCatalogEntry[],
  rows: readonly FeatureAvailabilityOverrideRow[],
  now: Date
): Map<FeatureAvailabilityKey, ResolvedFeatureAvailability> {
  const rowsByKey = new Map<string, FeatureAvailabilityOverrideRow>(
    rows.map((row) => [row.feature_key, row])
  );
  const parentByKey = new Map<FeatureAvailabilityKey, FeatureAvailabilityKey | null>(
    catalog.map((entry) => [entry.key, entry.parent])
  );

  const resolved = new Map<FeatureAvailabilityKey, ResolvedFeatureAvailability>();

  for (const entry of catalog) {
    const selfRow = rowsByKey.get(entry.key);
    if (selfRow && isRowEffectivelyOff(selfRow, now)) {
      resolved.set(entry.key, unavailableFrom(entry.key, 'self', entry.key, selfRow, now));
      continue;
    }

    let ancestorKey = parentByKey.get(entry.key) ?? null;
    let result: ResolvedFeatureAvailability | null = null;
    while (ancestorKey) {
      const ancestorRow = rowsByKey.get(ancestorKey);
      if (ancestorRow && isRowEffectivelyOff(ancestorRow, now)) {
        result = unavailableFrom(entry.key, 'parent', ancestorKey, ancestorRow, now);
        break;
      }
      ancestorKey = parentByKey.get(ancestorKey) ?? null;
    }

    if (result) {
      resolved.set(entry.key, result);
      continue;
    }

    const base = available(entry.key);
    resolved.set(entry.key, {
      ...base,
      restoredAutomatically: selfRow ? isRowRestoredAutomatically(selfRow, now) : false,
    });
  }

  return resolved;
}

export function resolveSingleFeatureAvailability(
  key: FeatureAvailabilityKey,
  rows: readonly FeatureAvailabilityOverrideRow[],
  now: Date
): ResolvedFeatureAvailability {
  const resolved = resolveFeatureAvailability(FEATURE_AVAILABILITY_CATALOG, rows, now);
  return resolved.get(key) ?? available(key);
}
