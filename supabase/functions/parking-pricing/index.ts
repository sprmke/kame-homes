/**
 * parking-pricing — GET/PATCH parking nightly rates + calendar overrides.
 * Auth: verifyAdminJwt + org parking access (org:parkings:view | org:parkings:manage)
 */

import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import {
  loadParkingPricing,
  saveParkingPricing,
  type ParkingPricingPatch,
} from '../_shared/parkingPricing.ts';
import { isValidCalendarDateKey } from '../_shared/parkingBlockedDates.ts';
import { resolveScopedParkingAccess } from '../_shared/parkingScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { logAssetActivity } from '../_shared/assetActivity.ts';

serveAuthenticated('parking-pricing', async (req) => {
  const permission = req.method === 'GET' ? 'org.parkings:view' : 'org.parkings:manage';
  const access = await resolveScopedParkingAccess(req, permission);
  const { parkingRow, user } = access;
  const parkingId = parkingRow.id;
  const url = new URL(req.url);

  if (req.method === 'GET') {
    const month = url.searchParams.get('month')?.trim();
    let monthStart: string | undefined;
    let monthEnd: string | undefined;

    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [year, mon] = month.split('-').map(Number);
      const end = new Date(year, mon, 0);
      monthStart = `${year}-${String(mon).padStart(2, '0')}-01`;
      monthEnd = `${year}-${String(mon).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
    }

    const data = await loadParkingPricing(parkingId, { monthStart, monthEnd });
    return jsonSuccess(req, data);
  }

  if (req.method === 'PATCH') {
    requireHttpMethod(req, 'PATCH');
    const body = await readJsonBody(req);
    const patch: ParkingPricingPatch = {};

    if (body.weekdayNightlyRate !== undefined) {
      patch.weekdayNightlyRate = body.weekdayNightlyRate;
    }
    if (body.weekendNightlyRate !== undefined) {
      patch.weekendNightlyRate = body.weekendNightlyRate;
    }

    if (body.dateOverrides !== undefined) {
      if (
        typeof body.dateOverrides !== 'object' ||
        body.dateOverrides === null ||
        Array.isArray(body.dateOverrides)
      ) {
        return jsonError(req, 'dateOverrides must be an object', 400);
      }
      patch.dateOverrides = body.dateOverrides as Record<string, number>;
    }

    if (body.blockRange !== undefined) {
      const range = body.blockRange as Record<string, unknown> | null;
      if (
        !range ||
        typeof range !== 'object' ||
        typeof range.startDate !== 'string' ||
        typeof range.endDate !== 'string'
      ) {
        return jsonError(req, 'blockRange requires startDate and endDate', 400);
      }
      if (!isValidCalendarDateKey(range.startDate) || !isValidCalendarDateKey(range.endDate)) {
        return jsonError(
          req,
          'blockRange startDate and endDate must be valid YYYY-MM-DD dates',
          400
        );
      }
      patch.blockRange = {
        startDate: range.startDate,
        endDate: range.endDate,
        note: typeof range.note === 'string' ? range.note : undefined,
      };
    }

    if (body.unblockDateKeys !== undefined) {
      if (
        !Array.isArray(body.unblockDateKeys) ||
        body.unblockDateKeys.some((k) => typeof k !== 'string')
      ) {
        return jsonError(req, 'unblockDateKeys must be an array of date strings', 400);
      }
      if (body.unblockDateKeys.some((k) => !isValidCalendarDateKey(k))) {
        return jsonError(req, 'unblockDateKeys must contain only valid YYYY-MM-DD dates', 400);
      }
      patch.unblockDateKeys = body.unblockDateKeys as string[];
    }

    try {
      const data = await saveParkingPricing(parkingId, patch, { userId: user.id });

      const emit = (
        action: Parameters<typeof logAssetActivity>[0]['action'],
        metadata: Record<string, unknown>
      ) =>
        logAssetActivity({
          req,
          user,
          action,
          parkingId,
          organizationId: access.org.id,
          accessKind: access.accessKind,
          memberId: access.memberId,
          targetId: parkingId,
          targetLabel: parkingRow.name ?? null,
          metadata,
        });

      const rateFields = ['weekdayNightlyRate', 'weekendNightlyRate'].filter(
        (f) => (patch as Record<string, unknown>)[f] !== undefined
      );
      const overrideCount = patch.dateOverrides ? Object.keys(patch.dateOverrides).length : 0;
      if (rateFields.length > 0 || overrideCount > 0) {
        await emit('pricing.rates_updated', {
          scope: rateFields.length > 0 ? 'nightly rates' : 'calendar overrides',
          fields: rateFields,
          count: overrideCount,
        });
      }
      if (patch.blockRange) {
        await emit('pricing.dates_blocked', {
          start_date: patch.blockRange.startDate,
          end_date: patch.blockRange.endDate,
          count: 1,
        });
      }
      if (patch.unblockDateKeys && patch.unblockDateKeys.length > 0) {
        await emit('pricing.dates_unblocked', { count: patch.unblockDateKeys.length });
      }

      return jsonSuccess(req, data);
    } catch (e) {
      return jsonError(req, (e as Error).message, 400);
    }
  }

  return jsonError(req, 'Method not allowed', 405);
});
