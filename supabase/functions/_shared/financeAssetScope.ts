/**
 * Resolve property or parking scope for finance admin edge handlers.
 */

import { verifyParkingTeamAccess } from './orgAuth.ts';
import type { ParkingTeamPermissionId } from './parkingTeamPermissions.ts';
import { readParkingIdFromUrl } from './parkingScope.ts';
import { readPropertyIdFromUrl, resolveScopedPropertyAccess } from './propertyScope.ts';
import type { TeamPermissionId } from './propertyTeamPermissions.ts';

export type FinanceAssetScope = (
  { kind: 'property'; id: string } | { kind: 'parking'; id: string }
) & {
  /** Org root + actor snapshot for activity-log emission. */
  orgId: string;
  accessKind: string;
  memberId?: string;
};

export type FinanceDbScope = {
  propertyId?: string;
  parkingId?: string;
};

export function financeDbScope(scope: FinanceAssetScope): FinanceDbScope {
  if (scope.kind === 'property') return { propertyId: scope.id };
  return { parkingId: scope.id };
}

export async function resolveFinanceAssetAccess(
  req: Request,
  requiredPermission: TeamPermissionId | ParkingTeamPermissionId
): Promise<FinanceAssetScope> {
  const url = new URL(req.url);
  const parkingId = readParkingIdFromUrl(url);
  const propertyId = readPropertyIdFromUrl(url);

  if (parkingId && propertyId) {
    throw new Response(
      JSON.stringify({ success: false, error: 'Provide only one of property_id or parking_id' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (parkingId) {
    const parkingAccess = await verifyParkingTeamAccess(
      req,
      parkingId,
      requiredPermission as ParkingTeamPermissionId
    );
    return {
      kind: 'parking',
      id: parkingId,
      orgId: parkingAccess.org.id,
      accessKind: parkingAccess.accessKind,
      memberId: parkingAccess.memberId,
    };
  }

  const propertyAccess = await resolveScopedPropertyAccess(
    req,
    requiredPermission as TeamPermissionId
  );
  return {
    kind: 'property',
    id: propertyAccess.property.id,
    orgId: propertyAccess.org.id,
    accessKind: propertyAccess.accessKind,
    memberId: propertyAccess.memberId,
  };
}
