/**
 * feature-availability — super-admin GET/PUT/DELETE for `feature_availability_overrides`.
 * UI: `/admin/feature-availability`. See
 * docs/workflow/done/feature-availability-controls.md §4/§6.
 *
 * GET returns the full catalog + raw override rows + resolved state for every key
 * (not just off ones — the admin list needs everything). PUT turns a key on/off with a
 * reason. DELETE only removes rows whose key is no longer in the catalog ("Unused").
 */

import { createServiceClient } from '../_shared/orgAuth.ts';
import { jsonError, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import { serveSuperAdmin } from '../_shared/serveEdge.ts';
import { logSuperAdminAction } from '../_shared/superAdminAudit.ts';
import { requireSuperAdminStepUp } from '../_shared/superAdminVerification.ts';
import { invalidateFeatureAvailabilityCache } from '../_shared/featureAvailability.ts';
import {
  FEATURE_AVAILABILITY_CATALOG,
  getFeatureAvailabilityCatalogEntry,
  isFeatureAvailabilityKey,
} from '../_shared/featureAvailabilityCatalog.ts';
import {
  resolveFeatureAvailability,
  type FeatureAvailabilityOverrideRow,
} from '../_shared/featureAvailabilityResolve.ts';
import { validateFeatureAvailabilityOffPayload } from '../_shared/featureAvailabilityAdminValidation.ts';

type FullOverrideRow = FeatureAvailabilityOverrideRow & {
  disabled_at: string | null;
  updated_by: string | null;
  updated_at: string;
};

const OVERRIDE_COLUMNS =
  'feature_key, is_enabled, reason, message, expected_back_at, auto_restore, show_banner, super_admin_bypass, disabled_at, updated_by, updated_at';

serveSuperAdmin('feature-availability', async (req, user) => {
  const stepUp = await requireSuperAdminStepUp(req, user, 'feature_availability');
  if (stepUp) return stepUp;

  const supabase = createServiceClient();

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('feature_availability_overrides')
      .select(OVERRIDE_COLUMNS)
      .limit(500);
    if (error) return jsonError(req, error.message, 500);
    const rows = (data ?? []) as FullOverrideRow[];

    const resolved = resolveFeatureAvailability(FEATURE_AVAILABILITY_CATALOG, rows, new Date());
    const knownKeys = new Set<string>(FEATURE_AVAILABILITY_CATALOG.map((entry) => entry.key));
    const unusedKeys = rows
      .filter((row) => !knownKeys.has(row.feature_key))
      .map((row) => row.feature_key);

    return jsonSuccess(req, {
      catalog: FEATURE_AVAILABILITY_CATALOG,
      overrides: rows,
      resolved: Object.fromEntries(resolved),
      unusedKeys,
    });
  }

  if (req.method === 'PUT' || req.method === 'PATCH') {
    const body = await readJsonBody(req);
    const featureKey = typeof body.featureKey === 'string' ? body.featureKey.trim() : '';
    if (!featureKey || !isFeatureAvailabilityKey(featureKey)) {
      return jsonError(req, 'featureKey must be a known catalog key');
    }
    if (typeof body.isEnabled !== 'boolean') {
      return jsonError(req, 'isEnabled must be a boolean');
    }
    const entry = getFeatureAvailabilityCatalogEntry(featureKey)!;

    const { data: existingRows, error: readError } = await supabase
      .from('feature_availability_overrides')
      .select(OVERRIDE_COLUMNS)
      .limit(500);
    if (readError) return jsonError(req, readError.message, 500);
    const rows = (existingRows ?? []) as FullOverrideRow[];
    const before = rows.find((row) => row.feature_key === featureKey) ?? null;

    if (body.isEnabled === true && entry.parent) {
      const resolvedParent = resolveFeatureAvailability(
        FEATURE_AVAILABILITY_CATALOG,
        rows,
        new Date()
      ).get(entry.parent);
      if (resolvedParent && !resolvedParent.available) {
        return jsonError(
          req,
          `Cannot turn this on while its parent (${entry.parent}) is off.`,
          409
        );
      }
    }

    let patch: Record<string, unknown>;

    if (body.isEnabled === false) {
      const validated = validateFeatureAvailabilityOffPayload(body, entry, new Date());
      if (!validated.ok) return jsonError(req, validated.error);
      const { reason, message, expectedBackAt, autoRestore, showBanner, superAdminBypass } =
        validated.fields;

      patch = {
        feature_key: featureKey,
        is_enabled: false,
        reason,
        message,
        expected_back_at: expectedBackAt,
        auto_restore: autoRestore,
        show_banner: showBanner,
        super_admin_bypass: superAdminBypass,
        disabled_at: before && !before.is_enabled ? before.disabled_at : new Date().toISOString(),
        updated_by: user.id,
      };
    } else {
      patch = {
        feature_key: featureKey,
        is_enabled: true,
        reason: null,
        message: null,
        expected_back_at: null,
        auto_restore: false,
        show_banner: false,
        super_admin_bypass: before?.super_admin_bypass ?? true,
        disabled_at: null,
        updated_by: user.id,
      };
    }

    const { data: saved, error: upsertError } = await supabase
      .from('feature_availability_overrides')
      .upsert(patch, { onConflict: 'feature_key' })
      .select(OVERRIDE_COLUMNS)
      .single();
    if (upsertError) return jsonError(req, upsertError.message, 500);

    invalidateFeatureAvailabilityCache();

    await logSuperAdminAction(user, {
      action: 'feature_availability.update',
      targetType: 'feature',
      targetId: featureKey,
      summary:
        body.isEnabled === true
          ? `Turned on ${entry.label}`
          : `Turned off ${entry.label} (${patch.reason})`,
      metadata: { before, after: saved },
    });

    return jsonSuccess(req, { override: saved });
  }

  if (req.method === 'DELETE') {
    const body = await readJsonBody(req);
    const featureKey = typeof body.featureKey === 'string' ? body.featureKey.trim() : '';
    if (!featureKey) return jsonError(req, 'featureKey is required');
    if (isFeatureAvailabilityKey(featureKey)) {
      return jsonError(req, 'Cannot delete a row for a key that is still in the catalog.');
    }

    const { error: deleteError } = await supabase
      .from('feature_availability_overrides')
      .delete()
      .eq('feature_key', featureKey);
    if (deleteError) return jsonError(req, deleteError.message, 500);

    invalidateFeatureAvailabilityCache();

    await logSuperAdminAction(user, {
      action: 'feature_availability.delete_unused',
      targetType: 'feature',
      targetId: featureKey,
      summary: `Removed unused feature availability row ${featureKey}`,
    });

    return jsonSuccess(req, { deleted: true });
  }

  return jsonError(req, 'Method not allowed', 405);
});
