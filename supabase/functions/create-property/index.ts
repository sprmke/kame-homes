/**
 * create-property — POST creates a property within an org (org:properties:create — owner only by default).
 */

import {
  allocatePropertySlug,
  createServiceClient,
  serializeProperty,
  verifyOrgAccess,
} from '../_shared/orgAuth.ts';
import { buildActorContext, logActivity } from '../_shared/activityLog.ts';
import {
  DUPLICATE_PROPERTY_NAME_MESSAGE,
  findPropertyNameConflict,
} from '../_shared/propertyNameConflict.ts';
import { getReservedDisplayNameViolation } from '../_shared/reservedDisplayNames.ts';
import { defaultPropertySettingsForResidence } from '../_shared/propertyResidenceDefaults.ts';
import {
  azureNorthLocationSeed,
  isAzureNorthResidence,
} from '../_shared/propertyLocationDefaults.ts';
import {
  DUPLICATE_TOWER_UNIT_MESSAGE,
  parsePropertyTowerUnitFromBody,
} from '../_shared/propertyTowerUnit.ts';
import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { seedPropertySettings } from '../_shared/propertySettingsSeed.ts';
import { seedPropertyTeamTemplates } from '../_shared/propertyTeamTemplates.ts';
import { ensureOrgHostMode } from '../_shared/parkingSlotUnit.ts';
import {
  autoEnrollPropertyInOrgSubscription,
  orgHasLivePaidSubscription,
} from '../_shared/planEntitlements.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('create-property', async (req, user) => {
  requireHttpMethod(req, 'POST');
  const body = await readJsonBody(req);

  const orgId = typeof body.orgId === 'string' ? body.orgId.trim() : '';
  if (!orgId) {
    return jsonError(req, 'orgId is required');
  }

  const orgAccess = await verifyOrgAccess(req, { orgId }, 'org:properties:create');

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (name.length < 2 || name.length > 120) {
    return jsonError(req, 'Property name must be 2–120 characters');
  }

  const nameReserved = getReservedDisplayNameViolation(name);
  if (nameReserved) {
    return jsonError(req, nameReserved, 409);
  }

  const residenceName =
    typeof body.residenceName === 'string' ? body.residenceName.trim() || null : null;
  const address = typeof body.address === 'string' ? body.address.trim() || null : null;
  const maxGuests =
    typeof body.maxGuests === 'number' && body.maxGuests > 0 ? Math.round(body.maxGuests) : null;

  const hasTowerUnitFields =
    typeof body.tower === 'string' ||
    typeof body.unitNumber === 'string' ||
    typeof body.towerAndUnit === 'string';

  let tower: string | null = null;
  let unitNumber: string | null = null;
  let towerAndUnit: string | null = null;

  const supabase = createServiceClient();

  if (hasTowerUnitFields) {
    const parsed = parsePropertyTowerUnitFromBody(body);
    if (!parsed.ok) {
      return jsonError(req, parsed.error);
    }
    tower = parsed.tower;
    unitNumber = parsed.unitNumber;
    towerAndUnit = parsed.towerAndUnit;
  }

  try {
    const nameConflict = await findPropertyNameConflict(supabase, name);
    if (nameConflict) {
      return jsonError(req, DUPLICATE_PROPERTY_NAME_MESSAGE, 409);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Validation failed';
    return jsonError(req, msg, 500);
  }

  const slug = await allocatePropertySlug(supabase, name);
  const effectiveResidence = residenceName ?? 'Azure North Residences';
  const defaultSettings = defaultPropertySettingsForResidence(effectiveResidence);
  const azureLocation = isAzureNorthResidence(effectiveResidence) ? azureNorthLocationSeed() : null;

  const { data, error } = await supabase
    .from('properties')
    .insert({
      organization_id: orgId,
      name,
      slug,
      status: 'INACTIVE',
      tower,
      unit_number: unitNumber,
      tower_and_unit: towerAndUnit,
      residence_name: residenceName,
      address: address ?? azureLocation?.address ?? null,
      max_guests: maxGuests ?? (defaultSettings.maxGuests as number),
      settings: azureLocation ? { ...defaultSettings, ...azureLocation.settings } : defaultSettings,
    })
    .select('*')
    .single();

  if (error) {
    console.error('[create-property]', error.message);
    if (error.code === '23505') {
      if (tower || unitNumber) {
        return jsonError(req, DUPLICATE_TOWER_UNIT_MESSAGE, 409);
      }
      return jsonError(req, DUPLICATE_PROPERTY_NAME_MESSAGE, 409);
    }
    return jsonError(req, 'Failed to create property', 500);
  }

  try {
    await seedPropertySettings(data.id as string, { residenceName });
    await seedPropertyTeamTemplates(supabase, data.id as string);
    await ensureOrgHostMode(supabase, orgId, 'property');
  } catch (e) {
    console.error('[create-property] settings seed:', e);
    return jsonError(req, 'Property created but settings seed failed', 500);
  }

  let billingRequired = false;
  try {
    billingRequired = await orgHasLivePaidSubscription(orgId);
    if (!billingRequired) {
      await autoEnrollPropertyInOrgSubscription(orgId, data.id as string, user.id);
    }
  } catch (e) {
    console.error('[create-property] subscription auto-enroll:', e);
  }

  await logActivity({
    action: 'property.created',
    organizationId: orgId,
    propertyId: data.id as string,
    scope: 'property',
    actor: buildActorContext('dashboard', { orgAccess }, req),
    targetType: 'property',
    targetId: data.id as string,
    targetLabel: (data.name as string | undefined) ?? name,
  });

  return jsonSuccess(req, {
    property: serializeProperty(data),
    billingRequired,
  });
});
