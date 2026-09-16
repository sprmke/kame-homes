/**
 * Org team roles — server contract (mirrors ui/.../orgTeamConstants.ts).
 *
 * Standard roles: OWNER (virtual via organizations.owner_id) | ADMIN (organization_members)
 * Org hub permissions only — listing modules use property_members / parking_members.
 */

import { expandLegacyOrgPermissionIds } from './orgLegacyPermissionExpansion.ts';

export const BUILTIN_ORG_ROLES = ['OWNER', 'ADMIN'] as const;
export type BuiltinOrgRole = (typeof BUILTIN_ORG_ROLES)[number];

export const ORG_INVITE_TTL_DAYS = 7;

export const ORG_ADMIN_ROLE_ID = 'ADMIN' as const;

/** Canonical org hub permission ids — keep in sync with ui/.../orgTeamConstants.ts */
export const ORG_PERMISSION_IDS = [
  'org.dashboard:view',
  'org.bookings:view',
  'org.properties:view',
  'org.properties:create',
  'org.properties:manage',
  'org.parkings:view',
  'org.parkings:create',
  'org.parkings:manage',
  'org.settings:view',
  'org.settings.basic:edit',
  'org.settings.socials:edit',
  'org.settings.aiPlatform:edit',
  'org.settings.aiAssistant:edit',
  'org.plans:view',
  'org.analytics:view',
  'org.analytics:export',
  'org.team:view',
  'org.team.invitations:add',
  'org.team.invitations:edit',
  'org.team.invitations:delete',
  'org.team.members:edit',
  'org.team.members:delete',
  'org.team.roles:add',
  'org.team.roles:edit',
  'org.team.roles:delete',
] as const;

/** Legacy coarse ids — expanded at read time; do not grant org:delete to members. */
export const LEGACY_ORG_PERMISSION_IDS = [
  'org:dashboard:view',
  'org:bookings:view',
  'org:properties:view',
  'org:properties:create',
  'org:properties:manage',
  'org:parkings:view',
  'org:parkings:create',
  'org:parkings:manage',
  'org:settings:view',
  'org:settings:edit',
  'org:team:view',
  'org:team:invite',
  'org:team:manage',
] as const;

export type OrgPermissionId = (typeof ORG_PERMISSION_IDS)[number];
/** Canonical or legacy colon ids accepted by server RBAC helpers. */
export type OrgPermissionParam = OrgPermissionId | (typeof LEGACY_ORG_PERMISSION_IDS)[number];

const ORG_PERMISSION_ID_SET = new Set<string>([
  ...ORG_PERMISSION_IDS,
  ...LEGACY_ORG_PERMISSION_IDS,
]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Default presets per built-in org role (granular leaves). */
export const ORG_ROLE_PERMISSIONS: Record<BuiltinOrgRole, OrgPermissionId[]> = {
  OWNER: [...ORG_PERMISSION_IDS],
  ADMIN: [
    'org.dashboard:view',
    'org.bookings:view',
    'org.properties:view',
    'org.properties:manage',
    'org.parkings:view',
    'org.parkings:manage',
    'org.analytics:view',
    'org.analytics:export',
    'org.team:view',
    'org.team.invitations:add',
    'org.team.invitations:edit',
    'org.team.invitations:delete',
    'org.team.members:edit',
    'org.team.members:delete',
  ],
};

/** Property-only members have no org-scoped screens (property routes only). */
export const ORG_PROPERTY_MEMBER_PERMISSIONS: OrgPermissionId[] = [];

export type OrgListingPropertyAssignment = {
  propertyId: string;
  roleId: string;
  permissions: string[];
};

export type OrgListingParkingAssignment = {
  parkingId: string;
  roleId: string;
  permissions: string[];
};

export type OrgListingAssignments = {
  properties?: OrgListingPropertyAssignment[];
  parkings?: OrgListingParkingAssignment[];
};

export type OrgMemberRow = {
  id: string;
  organization_id: string;
  user_id: string;
  role_id: string;
  permissions: string[];
  saved_permissions: string[] | null;
  all_listings: boolean;
  listing_assignments: OrgListingAssignments | null;
  status: 'active' | 'inactive';
  plan_limited?: boolean;
};

export function allOrgPermissions(): OrgPermissionId[] {
  return [...ORG_PERMISSION_IDS];
}

export function normalizeOrgPermissionIds(ids: readonly string[]): OrgPermissionId[] {
  const expanded = expandLegacyOrgPermissionIds(ids);
  return expanded.filter((id): id is OrgPermissionId => ORG_PERMISSION_ID_SET.has(id));
}

export function hasOrgPermission(granted: readonly string[], required: string): boolean {
  const normalizedGranted = normalizeOrgPermissionIds(granted);
  const expandedRequired = expandLegacyOrgPermissionIds([required]);
  return expandedRequired.some((id) => normalizedGranted.includes(id as OrgPermissionId));
}

export function effectiveOrgMemberPermissions(row: {
  permissions: unknown;
  status: string;
  role_id: string;
  saved_permissions?: unknown;
}): OrgPermissionId[] {
  if (row.status !== 'active') {
    return [];
  }
  const raw = Array.isArray(row.permissions)
    ? (row.permissions as string[])
    : row.role_id === 'ADMIN'
      ? [...ORG_ROLE_PERMISSIONS.ADMIN]
      : [];
  return normalizeOrgPermissionIds(raw);
}

export function assertValidOrgRoleId(roleId: string): void {
  if (roleId !== ORG_ADMIN_ROLE_ID && !UUID_RE.test(roleId)) {
    throw new Error('Invalid org role');
  }
}

/**
 * True for legacy `ADMIN` or a template UUID on `organization_members.role_id`.
 * After org template migration, invited org members use UUIDs — do not gate on `ADMIN` alone.
 */
export function isOrgHubMemberRoleId(roleId: string | null | undefined): boolean {
  if (!roleId || typeof roleId !== 'string') return false;
  const trimmed = roleId.trim();
  return trimmed === ORG_ADMIN_ROLE_ID || UUID_RE.test(trimmed);
}

export function parseOrgListingAssignments(raw: unknown): OrgListingAssignments | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const properties = Array.isArray(obj.properties)
    ? obj.properties.filter(
        (entry): entry is OrgListingPropertyAssignment =>
          typeof entry === 'object' &&
          entry !== null &&
          typeof (entry as OrgListingPropertyAssignment).propertyId === 'string'
      )
    : undefined;
  const parkings = Array.isArray(obj.parkings)
    ? obj.parkings.filter(
        (entry): entry is OrgListingParkingAssignment =>
          typeof entry === 'object' &&
          entry !== null &&
          typeof (entry as OrgListingParkingAssignment).parkingId === 'string'
      )
    : undefined;
  if (!properties?.length && !parkings?.length) return null;
  return { properties, parkings };
}

export function normalizeInviteEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function inviteExpiresAt(): Date {
  const d = new Date();
  d.setDate(d.getDate() + ORG_INVITE_TTL_DAYS);
  return d;
}

export function virtualOrgOwnerMemberId(ownerId: string): string {
  return `org-owner-${ownerId}`;
}

export const ORG_ADMIN_EMAIL_DESCRIPTION =
  'Admins have the org hub permissions and listing access assigned on this invitation.';

export const ORG_TEAM_API_PERMISSIONS = {
  listCustomRoles: 'org.team:view' as const,
  createCustomRole: 'org.team.roles:add' as const,
  updateCustomRole: 'org.team.roles:edit' as const,
  deleteCustomRole: 'org.team.roles:delete' as const,
};
