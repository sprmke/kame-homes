/**
 * update-parking — PATCH parking slot details (org:parkings:manage).
 */

import { allocateParkingSlug, createServiceClient, serializeParking } from '../_shared/orgAuth.ts';
import { buildActorContext, diffRecord, logActivity } from '../_shared/activityLog.ts';
import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { parseAcceptedVehicleTypes } from '../_shared/parkingDimensionDefaults.ts';
import { resolveScopedParkingAccess } from '../_shared/parkingScope.ts';
import {
  DUPLICATE_PARKING_SLOT_MESSAGE,
  findParkingSlotConflict,
  parseParkingSlotFromBody,
} from '../_shared/parkingSlotUnit.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { validateOrgBrandColor } from '../_shared/orgSettingsValidation.ts';
import { invalidateParkingBrandColorCache } from '../_shared/parkingBranding.ts';

serveAuthenticated('update-parking', async (req) => {
  requireHttpMethod(req, 'PATCH');
  const body = await readJsonBody(req);

  const parkingId = typeof body.parkingId === 'string' ? body.parkingId.trim() : '';
  if (!parkingId) {
    return jsonError(req, 'parkingId is required');
  }

  const url = new URL(req.url);
  url.searchParams.set('parking_id', parkingId);
  const scopedReq = new Request(url.toString(), {
    method: req.method,
    headers: req.headers,
  });

  const parkingAccess = await resolveScopedParkingAccess(scopedReq, 'org.parkings:manage');
  const { parkingRow } = parkingAccess;
  const patch: Record<string, unknown> = {};

  if (typeof body.name === 'string') {
    const name = body.name.trim();
    if (name.length < 2 || name.length > 120) {
      return jsonError(req, 'Parking name must be 2–120 characters');
    }
    patch.name = name;
  }

  const hasSlotFields =
    typeof body.tower === 'string' ||
    typeof body.level === 'string' ||
    typeof body.slotLabel === 'string' ||
    typeof body.parkingType === 'string' ||
    typeof body.type === 'string';

  if (hasSlotFields) {
    const parsed = parseParkingSlotFromBody({
      residenceName: body.residenceName ?? parkingRow.residence_name,
      tower: body.tower ?? parkingRow.tower,
      level: body.level ?? parkingRow.level,
      slotLabel: body.slotLabel ?? parkingRow.slot_label,
      parkingType: body.parkingType ?? body.type ?? parkingRow.parking_type,
    });
    if (!parsed.ok) {
      return jsonError(req, parsed.error);
    }
    const supabase = createServiceClient();
    try {
      const conflict = await findParkingSlotConflict(
        supabase,
        parsed.residenceName,
        parsed.tower,
        parsed.level,
        parsed.slotLabel,
        parkingRow.id
      );
      if (conflict) {
        return jsonError(req, DUPLICATE_PARKING_SLOT_MESSAGE, 409);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Validation failed';
      return jsonError(req, msg, 500);
    }
    patch.residence_name = parsed.residenceName;
    patch.tower = parsed.tower;
    patch.level = parsed.level;
    patch.slot_label = parsed.slotLabel;
    patch.parking_type = parsed.parkingType;
  } else if (typeof body.residenceName === 'string') {
    patch.residence_name = body.residenceName.trim() || null;
  }

  if (typeof body.ratePerNight === 'number') {
    if (body.ratePerNight < 0) {
      return jsonError(req, 'ratePerNight must be non-negative');
    }
    patch.rate_per_night = body.ratePerNight;
  }

  if (body.acceptedVehicleTypes !== undefined) {
    const parsedTypes = parseAcceptedVehicleTypes(body.acceptedVehicleTypes);
    if (!parsedTypes.ok) {
      return jsonError(req, parsedTypes.error);
    }
    patch.accepted_vehicle_types = parsedTypes.value;
  }

  if (typeof body.status === 'string') {
    const status = body.status.trim().toUpperCase();
    if (status !== 'ACTIVE' && status !== 'INACTIVE') {
      return jsonError(req, 'status must be ACTIVE or INACTIVE');
    }
    patch.status = status;
  }

  if (body.settings && typeof body.settings === 'object' && !Array.isArray(body.settings)) {
    const incoming = { ...(body.settings as Record<string, unknown>) };
    if (typeof incoming.brandColor === 'string') {
      const trimmed = incoming.brandColor.trim();
      if (trimmed) {
        const brandErr = validateOrgBrandColor(trimmed);
        if (brandErr) return jsonError(req, brandErr);
        incoming.brandColor = trimmed;
      } else {
        delete incoming.brandColor;
      }
    }
    if (typeof incoming.description === 'string') {
      incoming.description = incoming.description.trim().slice(0, 1000);
      if (incoming.description) {
        incoming.notes = null;
      }
    }
    const currentSettings =
      parkingRow.settings &&
      typeof parkingRow.settings === 'object' &&
      !Array.isArray(parkingRow.settings)
        ? (parkingRow.settings as Record<string, unknown>)
        : {};
    patch.settings = { ...currentSettings, ...incoming };
  }

  if (Object.keys(patch).length === 0) {
    return jsonError(req, 'No valid fields to update');
  }

  const supabase = createServiceClient();

  if (typeof patch.name === 'string') {
    patch.slug = await allocateParkingSlug(
      supabase,
      patch.name as string,
      undefined,
      parkingRow.id
    );
  }

  patch.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('parkings')
    .update(patch)
    .eq('id', parkingRow.id)
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') {
      return jsonError(req, DUPLICATE_PARKING_SLOT_MESSAGE, 409);
    }
    console.error('[update-parking]', error.message);
    return jsonError(req, 'Failed to update parking', 500);
  }

  invalidateParkingBrandColorCache(parkingRow.id);

  await logActivity({
    action: 'parking.updated',
    organizationId: parkingRow.organization_id,
    parkingId: parkingRow.id,
    scope: 'parking',
    actor: buildActorContext('dashboard', { orgAccess: parkingAccess }, req),
    targetType: 'parking',
    targetId: parkingRow.id,
    targetLabel: (data.name as string | undefined) ?? parkingRow.name,
    changes: diffRecord(
      parkingRow as unknown as Record<string, unknown>,
      data as Record<string, unknown>,
      { include: Object.keys(patch), exclude: ['slug', 'updated_at'] }
    ),
  });

  return jsonSuccess(req, { parking: serializeParking(data) });
});
