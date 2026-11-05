/**
 * Pure validation for the `feature-availability` super-admin PUT body — mirrors the
 * `feature_availability_overrides` table's CHECK constraints (migration
 * 20261316128800) so the admin gets a clear 400 instead of a raw Postgres
 * constraint-violation message. Extracted from the edge handler so it's testable
 * without binding a port (`serve()` runs at module import in `index.ts`).
 */

import {
  isFeatureAvailabilityReason,
  type FeatureAvailabilityCatalogEntry,
  type FeatureAvailabilityReason,
} from './featureAvailabilityCatalog.ts';

export interface FeatureAvailabilityOffFields {
  reason: FeatureAvailabilityReason;
  message: string | null;
  expectedBackAt: string | null;
  autoRestore: boolean;
  showBanner: boolean;
  superAdminBypass: boolean;
}

export type FeatureAvailabilityValidationResult =
  { ok: true; fields: FeatureAvailabilityOffFields } | { ok: false; error: string };

/** Validates the body of a PUT turning `entry` OFF. */
export function validateFeatureAvailabilityOffPayload(
  body: Record<string, unknown>,
  entry: FeatureAvailabilityCatalogEntry,
  now: Date
): FeatureAvailabilityValidationResult {
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (!reason || !isFeatureAvailabilityReason(reason)) {
    return { ok: false, error: 'reason is required and must be a known reason' };
  }
  if ((reason === 'provider_issue' || reason === 'under_review') && !entry.provider) {
    return { ok: false, error: `"${reason}" requires a catalog entry with a provider` };
  }

  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (message.length > 280) {
    return { ok: false, error: 'message must be 280 characters or fewer' };
  }
  if (reason === 'other' && !message) {
    return { ok: false, error: 'message is required when reason is "other"' };
  }

  let expectedBackAt: string | null = null;
  if (body.expectedBackAt !== undefined && body.expectedBackAt !== null) {
    if (typeof body.expectedBackAt !== 'string') {
      return { ok: false, error: 'expectedBackAt must be an ISO date string' };
    }
    const parsed = new Date(body.expectedBackAt);
    if (Number.isNaN(parsed.getTime())) {
      return { ok: false, error: 'expectedBackAt is not a valid date' };
    }
    if (parsed.getTime() <= now.getTime()) {
      return { ok: false, error: 'expectedBackAt must be in the future' };
    }
    expectedBackAt = parsed.toISOString();
  }

  if (body.autoRestore !== undefined && typeof body.autoRestore !== 'boolean') {
    return { ok: false, error: 'autoRestore must be a boolean' };
  }
  const autoRestore = body.autoRestore === true;
  if (autoRestore && !expectedBackAt) {
    return { ok: false, error: 'autoRestore requires expectedBackAt' };
  }

  if (body.showBanner !== undefined && typeof body.showBanner !== 'boolean') {
    return { ok: false, error: 'showBanner must be a boolean' };
  }
  if (body.superAdminBypass !== undefined && typeof body.superAdminBypass !== 'boolean') {
    return { ok: false, error: 'superAdminBypass must be a boolean' };
  }

  return {
    ok: true,
    fields: {
      reason,
      message: message || null,
      expectedBackAt,
      autoRestore,
      showBanner: body.showBanner === true,
      superAdminBypass: body.superAdminBypass !== false,
    },
  };
}
