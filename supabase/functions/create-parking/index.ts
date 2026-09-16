/**
 * create-parking — POST creates a parking slot within an org (org:parkings:create).
 */

import {
  allocateParkingSlug,
  createServiceClient,
  serializeParking,
  verifyOrgAccess,
} from '../_shared/orgAuth.ts';
import { buildActorContext, logActivity } from '../_shared/activityLog.ts';
import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import {
  DUPLICATE_PARKING_SLOT_MESSAGE,
  ensureOrgHostMode,
  findParkingSlotConflict,
  parseParkingSlotFromBody,
} from '../_shared/parkingSlotUnit.ts';
import { parseAcceptedVehicleTypes } from '../_shared/parkingDimensionDefaults.ts';
import { seedParkingSettings } from '../_shared/parkingSettingsSeed.ts';
import { syncPreferredOwnerParkingDefaults } from '../_shared/preferredOwnerParkingDefaults.ts';
import {
  azureNorthLocationSeed,
  isAzureNorthResidence,
} from '../_shared/propertyLocationDefaults.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('create-parking', async (req) => {
  requireHttpMethod(req, 'POST');
  const body = await readJsonBody(req);

  const orgId = typeof body.orgId === 'string' ? body.orgId.trim() : '';
  if (!orgId) {
    return jsonError(req, 'orgId is required');
  }

  const orgAccess = await verifyOrgAccess(req, { orgId }, 'org.parkings:create');

  const parsed = parseParkingSlotFromBody(body);
  if (!parsed.ok) {
    return jsonError(req, parsed.error);
  }

  const name =
    typeof body.name === 'string' && body.name.trim().length >= 2
      ? body.name.trim()
      : parsed.slotLabel;
  if (name.length < 2 || name.length > 120) {
    return jsonError(req, 'Parking name must be 2–120 characters');
  }

  const ratePerNight =
    typeof body.ratePerNight === 'number' && body.ratePerNight >= 0 ? body.ratePerNight : null;

  let acceptedVehicleTypes: string[] =
    parsed.parkingType === 'motorcycle' ? ['motorcycle'] : ['car'];
  if (body.acceptedVehicleTypes !== undefined) {
    const parsedTypes = parseAcceptedVehicleTypes(body.acceptedVehicleTypes);
    if (!parsedTypes.ok) {
      return jsonError(req, parsedTypes.error);
    }
    acceptedVehicleTypes = parsedTypes.value;
  }

  const supabase = createServiceClient();

  try {
    const conflict = await findParkingSlotConflict(
      supabase,
      parsed.residenceName,
      parsed.tower,
      parsed.level,
      parsed.slotLabel
    );
    if (conflict) {
      return jsonError(req, DUPLICATE_PARKING_SLOT_MESSAGE, 409);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Validation failed';
    return jsonError(req, msg, 500);
  }

  const slug = await allocateParkingSlug(supabase, name);

  const azureLocation = isAzureNorthResidence(parsed.residenceName)
    ? azureNorthLocationSeed()
    : null;

  const { data, error } = await supabase
    .from('parkings')
    .insert({
      organization_id: orgId,
      name,
      slug,
      residence_name: parsed.residenceName,
      tower: parsed.tower,
      level: parsed.level,
      slot_label: parsed.slotLabel,
      parking_type: parsed.parkingType,
      rate_per_night: ratePerNight,
      accepted_vehicle_types: acceptedVehicleTypes,
      settings: {
        enabledParkingAmenities: ['cctv', 'security_24_7'],
        customParkingAmenities: [],
        features: ['CCTV', '24/7 Security'],
        ...(azureLocation?.settings ?? {}),
      },
    })
    .select('*')
    .single();

  if (error) {
    console.error('[create-parking]', error.message);
    if (error.code === '23505') {
      return jsonError(req, DUPLICATE_PARKING_SLOT_MESSAGE, 409);
    }
    return jsonError(req, 'Failed to create parking', 500);
  }

  try {
    await seedParkingSettings(data.id as string);
    await ensureOrgHostMode(supabase, orgId, 'parking');
  } catch (e) {
    console.error('[create-parking] seed:', e);
    return jsonError(req, 'Parking created but settings seed failed', 500);
  }

  // Properties with no (valid) preferred listing get the earliest ACTIVE parking.
  try {
    await syncPreferredOwnerParkingDefaults(supabase, orgId);
  } catch (e) {
    console.error('[create-parking] preferred parking defaults:', e);
  }

  await logActivity({
    action: 'parking.created',
    organizationId: orgId,
    parkingId: data.id as string,
    scope: 'parking',
    actor: buildActorContext('dashboard', { orgAccess }, req),
    targetType: 'parking',
    targetId: data.id as string,
    targetLabel: (data.name as string | undefined) ?? null,
  });

  return jsonSuccess(req, { parking: serializeParking(data) });
});
