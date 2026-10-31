/**
 * Resolve support-ticket scope for host (org/property/parking) or guest explore (no org).
 * Host Help & Support: every team member. Guest Contact /account/tickets: any signed-in user.
 */

import {
  type AuthenticatedUser,
  type OrgRow,
  verifyAuthenticatedUser,
  verifyOrgAccess,
  verifyParkingTeamAccess,
  verifyPropertyAccess,
} from './orgAuth.ts';

export type SupportTicketChannel = 'host' | 'guest';

export type SupportTicketScope = {
  user: AuthenticatedUser;
  channel: SupportTicketChannel;
  org: OrgRow | null;
  propertyId: string | null;
  propertyName: string | null;
  parkingId: string | null;
  parkingName: string | null;
};

export type SupportTicketScopeInput = {
  orgSlug?: string | null;
  orgId?: string | null;
  propertyId?: string | null;
  parkingId?: string | null;
};

function hasHostScope(scope: SupportTicketScopeInput): boolean {
  return Boolean(scope.propertyId || scope.parkingId || scope.orgSlug || scope.orgId);
}

/** Host org-scoped access, or guest channel when no org/property/parking is provided. */
export async function resolveSupportTicketScope(
  req: Request,
  scope: SupportTicketScopeInput
): Promise<SupportTicketScope> {
  if (!hasHostScope(scope)) {
    const user = await verifyAuthenticatedUser(req);
    return {
      user,
      channel: 'guest',
      org: null,
      propertyId: null,
      propertyName: null,
      parkingId: null,
      parkingName: null,
    };
  }

  if (scope.propertyId) {
    const access = await verifyPropertyAccess(req, scope.propertyId);
    return {
      user: access.user,
      channel: 'host',
      org: access.org,
      propertyId: access.property.id,
      propertyName: access.property.name,
      parkingId: null,
      parkingName: null,
    };
  }

  if (scope.parkingId) {
    const access = await verifyParkingTeamAccess(req, scope.parkingId);
    return {
      user: access.user,
      channel: 'host',
      org: access.org,
      propertyId: null,
      propertyName: null,
      parkingId: access.parking.id,
      parkingName: access.parking.name,
    };
  }

  const orgAccess = await verifyOrgAccess(req, {
    orgSlug: scope.orgSlug ?? undefined,
    orgId: scope.orgId ?? undefined,
  });
  return {
    user: orgAccess.user,
    channel: 'host',
    org: orgAccess.org,
    propertyId: null,
    propertyName: null,
    parkingId: null,
    parkingName: null,
  };
}
