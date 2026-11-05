/**
 * Pure entry-builder for `get-feature-availability`'s response — extracted so it's
 * testable without binding a port (`serve()` runs at module import in `index.ts`).
 */

import type { AuthenticatedUser } from './orgAuth.ts';
import { isBypassedByUser, resolveFeatureUnavailableMessage } from './featureAvailability.ts';
import { FEATURE_AVAILABILITY_CATALOG } from './featureAvailabilityCatalog.ts';
import {
  resolveFeatureAvailability,
  type FeatureAvailabilityOverrideRow,
} from './featureAvailabilityResolve.ts';

export interface PublicFeatureAvailabilityEntry {
  key: string;
  /** Whether *this viewer* can use the feature (true only when bypassed; off keys are otherwise absent). */
  available: boolean;
  bypassed: boolean;
  reason: string | null;
  message: string;
  expectedBackAt: string | null;
  source: 'self' | 'parent' | null;
  showBanner: boolean;
  updatedAt: string | null;
}

/**
 * Only keys that are currently off are returned — an available key is simply absent,
 * and `ui/.../useFeatureAvailability.ts` defaults `available: true` for anything not
 * in the list.
 */
export function buildFeatureAvailabilityEntries(
  rows: readonly FeatureAvailabilityOverrideRow[],
  now: Date,
  user: AuthenticatedUser | undefined
): PublicFeatureAvailabilityEntry[] {
  const resolvedByKey = resolveFeatureAvailability(FEATURE_AVAILABILITY_CATALOG, rows, now);
  const rowUpdatedAtByKey = new Map(rows.map((row) => [row.feature_key, row.updated_at ?? null]));

  const entries: PublicFeatureAvailabilityEntry[] = [];
  for (const [key, resolved] of resolvedByKey) {
    if (resolved.available) continue;

    const bypassed = isBypassedByUser(resolved, user);
    entries.push({
      key,
      available: bypassed,
      bypassed,
      reason: resolved.reason,
      message: resolveFeatureUnavailableMessage(resolved),
      expectedBackAt: resolved.expectedBackAt,
      source: resolved.source,
      showBanner: resolved.showBanner,
      updatedAt: rowUpdatedAtByKey.get(resolved.sourceKey ?? key) ?? null,
    });
  }
  return entries;
}
