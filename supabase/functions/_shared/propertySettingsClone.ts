/**
 * Copy-property-settings registry — ordered CloneGroup list + shared helpers.
 * Phase 0: skeleton (no groups). Phase 1+ registers concrete groups.
 *
 * Plan: docs/workflow/for-testing/property-settings-copy-to-properties.md
 */

import {
  type CloneGroup,
  type CloneGroupFailure,
  type CloneGroupId,
  type CloneGroupSkip,
  type CloneOptions,
  type ClonePropertyCtx,
  type GroupPayload,
  CLONE_GROUP_IDS,
} from './propertySettingsCloneTypes.ts';
import { PHASE1_CLONE_GROUPS } from './propertySettingsCloneGroups.ts';
import {
  PHASE2_CLONE_GROUPS,
  PHASE3_CLONE_GROUPS,
  templatesWithAssetsGroup,
} from './propertySettingsClonePhase23.ts';

export {
  CLONE_GROUP_IDS,
  type CloneGroup,
  type CloneGroupFailure,
  type CloneGroupId,
  type CloneGroupSkip,
  type CloneOptions,
  type ClonePropertyCtx,
  type CloneRunResult,
  type CloneTargetResult,
  type GroupPayload,
} from './propertySettingsCloneTypes.ts';

/** Keys that must never be copied as-is onto a target (identity / scoping). */
export const IDENTITY_STRIP_KEYS = [
  'id',
  'property_id',
  'organization_id',
  'name',
  'slug',
  'type',
  'tower',
  'unit_number',
  'residence_name',
  'address',
  'created_at',
  'updated_at',
  'public_guest_app_origin',
] as const;

const IDENTITY_STRIP_SET = new Set<string>(IDENTITY_STRIP_KEYS);

/**
 * Nested identity under properties.settings / similar JSON blobs.
 * Always stripped or recomputed on the target.
 */
export const SETTINGS_IDENTITY_STRIP_KEYS = [
  'city',
  'province',
  'country',
  'zipCode',
  'latitude',
  'longitude',
  'mapsUrl',
  'placeId',
] as const;

/** Ordered registry — Phase 1–3 groups (templates upgraded with asset clone). */
export const PROPERTY_SETTINGS_CLONE_GROUPS: CloneGroup[] = [
  ...PHASE1_CLONE_GROUPS.filter((g) => g.id !== 'templates'),
  templatesWithAssetsGroup,
  ...PHASE2_CLONE_GROUPS,
  ...PHASE3_CLONE_GROUPS,
];

export function getCloneGroup(id: CloneGroupId): CloneGroup | undefined {
  return PROPERTY_SETTINGS_CLONE_GROUPS.find((g) => g.id === id);
}

export function listRegisteredCloneGroupIds(): CloneGroupId[] {
  return PROPERTY_SETTINGS_CLONE_GROUPS.map((g) => g.id);
}

/** Shallow strip of top-level identity / scoping keys from a payload object. */
export function sanitizeIdentity(payload: GroupPayload): GroupPayload {
  const out: GroupPayload = { ...payload };
  for (const key of IDENTITY_STRIP_SET) {
    delete out[key];
  }
  return out;
}

/**
 * Strip nested settings identity keys from a `settings` object (or similar).
 * Returns a new object; does not mutate the input.
 */
export function sanitizeSettingsIdentity(
  settings: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  if (!settings || typeof settings !== 'object') return {};
  const out: Record<string, unknown> = { ...settings };
  for (const key of SETTINGS_IDENTITY_STRIP_KEYS) {
    delete out[key];
  }
  return out;
}

export type RunCloneGroupOutcome =
  | { status: 'applied'; group: CloneGroupId; alreadyCustomized: boolean }
  | { status: 'skipped'; skip: CloneGroupSkip }
  | { status: 'failed'; failure: CloneGroupFailure };

/**
 * Per-(target, group) wrapper — never throws; records applied / skipped / failed.
 */
export async function runCloneGroup(args: {
  group: CloneGroup;
  payload: GroupPayload;
  targetCtx: ClonePropertyCtx;
  options: CloneOptions;
  dryRun: boolean;
}): Promise<RunCloneGroupOutcome> {
  const { group, payload, targetCtx, options, dryRun } = args;
  try {
    const sanitized = group.sanitize(payload, targetCtx, options);
    let alreadyCustomized = false;
    try {
      alreadyCustomized = await group.hasNonDefault(targetCtx);
    } catch {
      alreadyCustomized = false;
    }

    if (dryRun) {
      return { status: 'applied', group: group.id, alreadyCustomized };
    }

    await group.write(sanitized, targetCtx, options);
    return { status: 'applied', group: group.id, alreadyCustomized };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      status: 'failed',
      failure: { group: group.id, error: message },
    };
  }
}

/** Assert every registered group id is in the canonical CLONE_GROUP_IDS union. */
export function assertRegistryIdsValid(): void {
  const allowed = new Set<string>(CLONE_GROUP_IDS);
  for (const group of PROPERTY_SETTINGS_CLONE_GROUPS) {
    if (!allowed.has(group.id)) {
      throw new Error(`Unknown clone group id in registry: ${group.id}`);
    }
  }
}
