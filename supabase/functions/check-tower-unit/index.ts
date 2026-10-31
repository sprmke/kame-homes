/**
 * check-tower-unit — GET tower + unit availability for succession UX.
 * Auth: verifyAuthenticatedUser.
 *
 * available: true when format is valid (create is never blocked by peers).
 * hasActiveListing: true when another ACTIVE property already uses this pair.
 */

import {
  isPropertyTower,
  isValidUnitNumber,
  lookupPropertyTowerUnitConflict,
} from '../_shared/propertyTowerUnit.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { jsonSuccess, requireHttpMethod } from '../_shared/httpResponse.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('check-tower-unit', async (req) => {
  requireHttpMethod(req, 'GET');

  const url = new URL(req.url);
  const tower = url.searchParams.get('tower')?.trim() ?? '';
  const unitNumber = url.searchParams.get('unitNumber')?.trim() ?? '';
  const excludePropertyId = url.searchParams.get('excludePropertyId')?.trim() || undefined;

  if (!isPropertyTower(tower) || !isValidUnitNumber(unitNumber)) {
    return jsonSuccess(req, {
      available: false,
      reason: 'invalid',
      hasActiveListing: false,
      message: null,
      conflict: null,
    });
  }

  const supabase = createServiceClient();
  const conflict = await lookupPropertyTowerUnitConflict(
    supabase,
    tower,
    unitNumber,
    excludePropertyId
  );

  return jsonSuccess(req, {
    available: true,
    hasActiveListing: Boolean(conflict),
    message: conflict
      ? `This unit is already listed under ${conflict.orgName ?? 'another organization'}`
      : null,
    conflict: conflict
      ? {
          propertyId: conflict.id,
          propertyName: conflict.name,
          orgName: conflict.orgName,
        }
      : null,
  });
});
