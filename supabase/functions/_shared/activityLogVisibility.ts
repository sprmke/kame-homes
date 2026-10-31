/**
 * Who sees which activity rows — shared by `list-activity-log` and the assistant's
 * `list_activity_log` tool so both apply the same rule.
 *
 * Owner / platform admin / org admin with `org.activity:view` see every row of the org.
 * Everyone else (org admins without it, listing-scoped members) sees only rows for listings where
 * they hold the listing-level `activity:view`, and never `scope = 'org'` rows.
 */

import { hasOrgPermission } from './orgTeamPermissions.ts';
import { resolveActivityViewableListingIdsForOrgUser } from './orgAuth.ts';

export type ActivityVisibility =
  | { kind: 'all' }
  | { kind: 'listings'; propertyIds: string[]; parkingIds: string[] }
  | { kind: 'none' };

export async function resolveActivityVisibility(input: {
  userId: string;
  orgId: string;
  accessKind: string;
  permissions: readonly string[];
}): Promise<ActivityVisibility> {
  const isAdminView =
    input.accessKind === 'owner' ||
    input.accessKind === 'platform_admin' ||
    (input.accessKind === 'org_admin' && hasOrgPermission(input.permissions, 'org.activity:view'));
  if (isAdminView) return { kind: 'all' };

  const assigned = await resolveActivityViewableListingIdsForOrgUser(input.userId, input.orgId);
  if (assigned.propertyIds.length === 0 && assigned.parkingIds.length === 0) {
    return { kind: 'none' };
  }
  return { kind: 'listings', propertyIds: assigned.propertyIds, parkingIds: assigned.parkingIds };
}

/** PostgREST `.or()` filter for listing-scoped visibility (use with `.neq('scope', 'org')`). */
export function activityListingOrFilter(visibility: {
  propertyIds: string[];
  parkingIds: string[];
}): string {
  const clauses: string[] = [];
  if (visibility.propertyIds.length > 0) {
    clauses.push(`property_id.in.(${visibility.propertyIds.join(',')})`);
  }
  if (visibility.parkingIds.length > 0) {
    clauses.push(`parking_id.in.(${visibility.parkingIds.join(',')})`);
  }
  return clauses.join(',');
}
