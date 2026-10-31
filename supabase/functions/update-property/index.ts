/**
 * update-property — PATCH property details (team RBAC + Phase 5 section leaves).
 * Permanent delete stays on delete-property (owner-only). Archive/restore uses
 * settings.dangerZone:edit.
 */

import {
  allocatePropertySlug,
  createServiceClient,
  serializeProperty,
  verifyPropertyAccess,
} from '../_shared/orgAuth.ts';
import { buildActorContext, diffRecord, logActivity } from '../_shared/activityLog.ts';
import {
  DUPLICATE_PROPERTY_NAME_MESSAGE,
  findPropertyNameConflict,
} from '../_shared/propertyNameConflict.ts';
import { validatePropertyMediaArray } from '../_shared/propertyMedia.ts';
import { validatePropertySettingsPatch } from '../_shared/propertySettingsValidation.ts';
import {
  DUPLICATE_TOWER_UNIT_MESSAGE,
  findPropertyTowerUnitConflict,
  parsePropertyTowerUnitFromBody,
} from '../_shared/propertyTowerUnit.ts';
import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { catchPlanFeatureError, requirePropertyFeature } from '../_shared/planEntitlements.ts';
import { updatePropertyPatchPermissions } from '../_shared/settingsPatchPermissions.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('update-property', async (req) => {
  requireHttpMethod(req, 'PATCH');
  const body = await readJsonBody(req);

  const propertyId = typeof body.propertyId === 'string' ? body.propertyId.trim() : '';
  if (!propertyId) {
    return jsonError(req, 'propertyId is required');
  }

  const needed = updatePropertyPatchPermissions(body);
  if (needed.length === 0) {
    return jsonError(req, 'No valid fields to update');
  }

  const propertyAccess = await verifyPropertyAccess(req, propertyId, needed[0]!);
  const { property } = propertyAccess;
  for (const perm of needed.slice(1)) {
    await verifyPropertyAccess(req, propertyId, perm);
  }

  if (body.publicPagesAutosaveGate === true) {
    try {
      await requirePropertyFeature(propertyId, 'publicPagesAutosave');
    } catch (err) {
      const planErr = catchPlanFeatureError(req, err);
      if (planErr) return planErr;
      throw err;
    }
  }

  const patch: Record<string, unknown> = {};

  if (typeof body.name === 'string') {
    const name = body.name.trim();
    if (name.length < 2 || name.length > 120) {
      return jsonError(req, 'Property name must be 2–120 characters');
    }
    try {
      const nameConflict = await findPropertyNameConflict(createServiceClient(), name, property.id);
      if (nameConflict) {
        return jsonError(req, DUPLICATE_PROPERTY_NAME_MESSAGE, 409);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Validation failed';
      return jsonError(req, msg, 500);
    }
    patch.name = name;
  }

  if (typeof body.tower === 'string' || typeof body.unitNumber === 'string') {
    const residenceForTower =
      typeof body.residenceName === 'string' ? body.residenceName.trim() : property.residence_name;
    const parsed = parsePropertyTowerUnitFromBody(
      {
        tower: body.tower,
        unitNumber: body.unitNumber,
      },
      { residenceName: residenceForTower }
    );
    if (!parsed.ok) {
      return jsonError(req, parsed.error);
    }
    patch.tower = parsed.tower;
    patch.unit_number = parsed.unitNumber;
    patch.tower_and_unit = parsed.towerAndUnit;
  } else if (typeof body.towerAndUnit === 'string') {
    patch.tower_and_unit = body.towerAndUnit.trim() || null;
  }

  if (typeof body.residenceName === 'string') {
    patch.residence_name = body.residenceName.trim() || null;
  }

  if (typeof body.address === 'string') {
    patch.address = body.address.trim() || null;
  }

  if (typeof body.maxGuests === 'number') {
    if (body.maxGuests <= 0) {
      return jsonError(req, 'maxGuests must be positive');
    }
    patch.max_guests = Math.round(body.maxGuests);
  }

  if (typeof body.status === 'string') {
    const status = body.status.trim().toUpperCase();
    if (status !== 'ACTIVE' && status !== 'INACTIVE') {
      return jsonError(req, 'status must be ACTIVE or INACTIVE');
    }
    patch.status = status;
  }

  if (body.settings && typeof body.settings === 'object' && !Array.isArray(body.settings)) {
    const incoming = body.settings as Record<string, unknown>;
    const currentSettings =
      property.settings &&
      typeof property.settings === 'object' &&
      !Array.isArray(property.settings)
        ? (property.settings as Record<string, unknown>)
        : {};

    if (incoming.media !== undefined) {
      const mediaCheck = validatePropertyMediaArray(incoming.media);
      if (!mediaCheck.ok) {
        return jsonError(req, mediaCheck.error);
      }
      incoming.media = mediaCheck.items;
    }

    const residenceForValidation =
      typeof patch.residence_name === 'string'
        ? (patch.residence_name as string)
        : property.residence_name;
    const settingsValidationError = validatePropertySettingsPatch(incoming, {
      residenceName: residenceForValidation,
    });
    if (settingsValidationError) {
      return jsonError(req, settingsValidationError);
    }

    patch.settings = { ...currentSettings, ...incoming };
  }

  if (Object.keys(patch).length === 0) {
    return jsonError(req, 'No valid fields to update');
  }

  const supabase = createServiceClient();

  const resultingStatus = String(
    (patch.status as string | undefined) ?? property.status ?? 'ACTIVE'
  ).toUpperCase();
  const resultingTower = (patch.tower as string | undefined) ?? property.tower;
  const resultingUnit = (patch.unit_number as string | undefined) ?? property.unit_number;

  if (
    resultingStatus === 'ACTIVE' &&
    typeof resultingTower === 'string' &&
    resultingTower &&
    typeof resultingUnit === 'string' &&
    resultingUnit
  ) {
    try {
      const conflict = await findPropertyTowerUnitConflict(
        supabase,
        resultingTower,
        resultingUnit,
        property.id
      );
      if (conflict) {
        return jsonError(req, DUPLICATE_TOWER_UNIT_MESSAGE, 409);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Validation failed';
      return jsonError(req, msg, 500);
    }
  }

  if (typeof patch.name === 'string') {
    patch.slug = await allocatePropertySlug(supabase, patch.name as string, undefined, property.id);
  }

  const { data, error } = await supabase
    .from('properties')
    .update(patch)
    .eq('id', property.id)
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') {
      if (patch.tower || patch.unit_number) {
        return jsonError(req, DUPLICATE_TOWER_UNIT_MESSAGE, 409);
      }
      if (patch.name) {
        return jsonError(req, DUPLICATE_PROPERTY_NAME_MESSAGE, 409);
      }
      return jsonError(req, 'Slug is already taken');
    }
    console.error('[update-property]', error.message);
    return jsonError(req, 'Failed to update property', 500);
  }

  await logActivity({
    action: 'property.updated',
    organizationId: property.organization_id,
    propertyId: property.id,
    scope: 'property',
    actor: buildActorContext('dashboard', { propertyAccess }, req),
    targetType: 'property',
    targetId: property.id,
    targetLabel: (data.name as string | undefined) ?? property.name,
    changes: diffRecord(
      property as unknown as Record<string, unknown>,
      data as Record<string, unknown>,
      { include: Object.keys(patch), exclude: ['slug', 'updated_at'] }
    ),
  });

  return jsonSuccess(req, { property: serializeProperty(data) });
});
