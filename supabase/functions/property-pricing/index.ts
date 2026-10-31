/**
 * property-pricing — GET/PATCH property nightly rates, fee defaults, calendar overrides.
 * Auth: verifyAdminJwt + property team pricing:view | pricing.rates:edit | pricing.blocks:*
 */

import { jsonError, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import { verifyPropertyAccess } from '../_shared/orgAuth.ts';
import { isValidCalendarDateKey } from '../_shared/propertyBlockedDates.ts';
import {
  loadPropertyPricing,
  savePropertyPricing,
  type PropertyPricingPatch,
} from '../_shared/propertyPricing.ts';
import { resolveScopedPropertyAccess } from '../_shared/propertyScope.ts';
import type { TeamPermissionId } from '../_shared/propertyTeamPermissions.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { logAssetActivity } from '../_shared/assetActivity.ts';

function pricingPatchPermissions(patch: PropertyPricingPatch): TeamPermissionId[] {
  const needed: TeamPermissionId[] = [];
  const hasRates =
    patch.weekdayNightlyRate !== undefined ||
    patch.weekendNightlyRate !== undefined ||
    patch.downPayment !== undefined ||
    patch.securityDeposit !== undefined ||
    patch.petFee !== undefined ||
    patch.parkingRateGuest !== undefined ||
    patch.guestAdditionalFee !== undefined ||
    patch.holidayRules !== undefined ||
    patch.dateOverrides !== undefined;
  if (hasRates) needed.push('pricing.rates:edit');
  if (patch.blockRange !== undefined) needed.push('pricing.blocks:add');
  if (patch.unblockDateKeys !== undefined) needed.push('pricing.blocks:delete');
  return needed;
}

serveAuthenticated('property-pricing', async (req) => {
  if (req.method === 'GET') {
    const { property } = await resolveScopedPropertyAccess(req, 'pricing:view');
    const propertyId = property.id;
    const url = new URL(req.url);

    const month = url.searchParams.get('month')?.trim();
    let monthStart: string | undefined;
    let monthEnd: string | undefined;

    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [year, mon] = month.split('-').map(Number);
      const end = new Date(year, mon, 0);
      monthStart = `${year}-${String(mon).padStart(2, '0')}-01`;
      monthEnd = `${year}-${String(mon).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
    }

    const data = await loadPropertyPricing(propertyId, { monthStart, monthEnd });
    return jsonSuccess(req, data);
  }

  if (req.method !== 'PATCH') {
    return jsonError(req, 'Method not allowed', 405);
  }

  const body = await readJsonBody(req);
  const patch: PropertyPricingPatch = {};

  if (body.weekdayNightlyRate !== undefined) {
    patch.weekdayNightlyRate = body.weekdayNightlyRate;
  }
  if (body.weekendNightlyRate !== undefined) {
    patch.weekendNightlyRate = body.weekendNightlyRate;
  }
  if (body.downPayment !== undefined) patch.downPayment = body.downPayment;
  if (body.securityDeposit !== undefined) {
    patch.securityDeposit = body.securityDeposit;
  }
  if (body.petFee !== undefined) patch.petFee = body.petFee;
  if (body.parkingRateGuest !== undefined) {
    patch.parkingRateGuest = body.parkingRateGuest;
  }
  if (body.guestAdditionalFee !== undefined) {
    patch.guestAdditionalFee = body.guestAdditionalFee;
  }

  if (body.holidayRules !== undefined) {
    patch.holidayRules = body.holidayRules;
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
      return jsonError(req, 'blockRange startDate and endDate must be valid YYYY-MM-DD dates', 400);
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

  const needed = pricingPatchPermissions(patch);
  if (needed.length === 0) {
    return jsonError(req, 'No valid fields to update', 400);
  }

  const access = await resolveScopedPropertyAccess(req, needed[0]!);
  const { property, user } = access;
  for (const perm of needed.slice(1)) {
    await verifyPropertyAccess(req, property.id, perm);
  }

  try {
    const data = await savePropertyPricing(property.id, patch, { userId: user.id });

    const emit = (
      action: Parameters<typeof logAssetActivity>[0]['action'],
      metadata: Record<string, unknown>
    ) =>
      logAssetActivity({
        req,
        user,
        action,
        propertyId: property.id,
        organizationId: access.org.id,
        accessKind: access.accessKind,
        memberId: access.memberId,
        targetId: property.id,
        targetLabel: property.name ?? null,
        metadata,
      });

    const rateFields = [
      'weekdayNightlyRate',
      'weekendNightlyRate',
      'downPayment',
      'securityDeposit',
      'petFee',
      'parkingRateGuest',
      'guestAdditionalFee',
      'holidayRules',
    ].filter((f) => (patch as Record<string, unknown>)[f] !== undefined);
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
});
