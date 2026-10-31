import type { OrgAccessKind } from '@/features/dashboard/team/lib/orgPermissions';

export function isPropertyOnlyOrgAccess(accessKind: OrgAccessKind | undefined): boolean {
  return accessKind === 'property_member';
}

export function canSelectOrgInSwitcher(accessKind: OrgAccessKind | undefined): boolean {
  return Boolean(accessKind && !isPropertyOnlyOrgAccess(accessKind));
}

/** Owner (and platform admin) may create properties; org ADMIN does not — unless
 *  `canCreateProperties` from org-access is provided (honors `org.properties:create`). */
export function canCreatePropertiesInOrg(
  accessKind: OrgAccessKind | undefined,
  canCreateProperties?: boolean
): boolean {
  if (typeof canCreateProperties === 'boolean') return canCreateProperties;
  return accessKind === 'owner' || accessKind === 'platform_admin';
}

export function canCreateParkingsInOrg(
  accessKind: OrgAccessKind | undefined,
  canCreateParkings?: boolean
): boolean {
  if (typeof canCreateParkings === 'boolean') return canCreateParkings;
  return accessKind === 'owner' || accessKind === 'platform_admin';
}

/** Org owner (or platform admin) may start checkout or confirm a downgrade. */
export function canManageOrgBilling(accessKind: OrgAccessKind | undefined): boolean {
  return accessKind === 'owner' || accessKind === 'platform_admin';
}
