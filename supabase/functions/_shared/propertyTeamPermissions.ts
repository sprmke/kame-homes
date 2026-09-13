import { expandLegacyPropertyPermissionIds } from './legacyPermissionExpansion.ts';

/**
 * Property team RBAC — server-side contract (mirrors ui/.../propertyTeamConstants.ts).
 *
 * Stored member role: ADMIN (fixed tier) or property_custom_roles.id (named template).
 * Permission overrides: JSONB array on property_members / property_invitations
 *
 * Org owner, org ADMIN, and platform admin: implicit full access (no property_members row).
 */

export const PROPERTY_ADMIN_ROLE_ID = 'ADMIN' as const;

/** @deprecated Phase 1 migration only — removed from schema after backfill. */
export const LEGACY_BUILTIN_PROPERTY_ROLES = ['MANAGER', 'STAFF', 'VIEWER'] as const;
export type LegacyBuiltinPropertyRole = (typeof LEGACY_BUILTIN_PROPERTY_ROLES)[number];

export const PROPERTY_INVITE_TTL_DAYS = 7;

/** Canonical permission ids — keep in sync with ui/src/features/dashboard/team/lib/propertyTeamConstants.ts */
export const TEAM_PERMISSION_IDS = [
  'bookings:view',
  'bookings.create:add',
  'bookings.import:add',
  'bookings.detail.stay:edit',
  'bookings.detail.guests:edit',
  'bookings.detail.parking:edit',
  'bookings.detail.pets:edit',
  'bookings.detail.pricing:edit',
  'bookings.detail.workflow:edit',
  'finance:view',
  'finance.transactions:add',
  'finance.transactions:edit',
  'finance.transactions:delete',
  'finance.export:view',
  'pricing:view',
  'pricing.rates:edit',
  'pricing.blocks:add',
  'pricing.blocks:delete',
  'pricing.channels:view',
  'pricing.channels:edit',
  'maintenance:view',
  'maintenance.reminders:add',
  'maintenance.reminders:edit',
  'maintenance.reminders:delete',
  'maintenance.export:view',
  'marketing:view',
  'marketing.content:add',
  'marketing.content:edit',
  'marketing.templates:add',
  'marketing.templates:edit',
  'marketing.templates:delete',
  'marketing.generate:add',
  'marketing.generate.video:add',
  'marketing.publish:add',
  'notifications:view',
  'notifications.chat:edit',
  'notifications.marketing:edit',
  'notifications.staff:edit',
  'notifications.operations:edit',
  'notifications.finance:edit',
  'notifications.maintenance:edit',
  'templates:view',
  'templates.standard:edit',
  'templates.email:edit',
  'templates.custom:add',
  'templates.custom:edit',
  'templates.custom:delete',
  'publicPages:view',
  'publicPages.property:edit',
  'publicPages.stayGuide:edit',
  'publicPages.showcase:edit',
  'settings:view',
  'settings.integrations:view',
  'settings.basicInfo:edit',
  'settings.media:edit',
  'settings.propertyDetails:edit',
  'settings.amenities:edit',
  'settings.houseRules:edit',
  'settings.guestForm:edit',
  'settings.cancellationPolicy:edit',
  'settings.location:edit',
  'settings.socials:edit',
  'settings.payment:edit',
  'settings.buildingForms:edit',
  'settings.emailAutomations:edit',
  'settings.voiceReceptionist:edit',
  'settings.aiOverrides:edit',
  'settings.dangerZone:edit',
  'team:view',
  'team.invitations:add',
  'team.invitations:edit',
  'team.invitations:delete',
  'team.members:edit',
  'team.members:delete',
  'team.customRoles:add',
  'team.customRoles:edit',
  'team.customRoles:delete',
  'inbox:view',
  'inbox.messages:edit',
  'inbox.channels:add',
  'inbox.channels:delete',
  'inbox.quickReplies:add',
  'inbox.quickReplies:edit',
  'inbox.quickReplies:delete',
  'inbox.automation:edit',
  'analytics:view',
  'analytics:export',
] as const;

export type TeamPermissionId = (typeof TEAM_PERMISSION_IDS)[number];

const TEAM_PERMISSION_ID_SET = new Set<string>(TEAM_PERMISSION_IDS);

/** Invite email copy when role_id is ADMIN without a named template label at send time. */
export const PROPERTY_ADMIN_EMAIL_DESCRIPTION =
  'Admins have the permissions assigned on this property — use a template or customize access in Team settings.';

export type PropertyCustomRoleRow = {
  id: string;
  property_id: string;
  name: string;
  permissions: string[];
};

export type PropertyMemberRow = {
  id: string;
  property_id: string;
  user_id: string;
  role_id: string;
  permissions: string[];
  saved_permissions: string[] | null;
  status: 'active' | 'inactive';
  invited_by: string | null;
  assigned_at: string;
  last_active_at: string | null;
};

export type PropertyInvitationRow = {
  id: string;
  property_id: string;
  email: string;
  role_id: string;
  permissions: string[];
  token: string;
  expires_at: string;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
  sent_by: string;
  sent_at: string;
  accepted_at: string | null;
  accepted_by: string | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isPropertyAdminRoleId(roleId: string): roleId is typeof PROPERTY_ADMIN_ROLE_ID {
  return roleId === PROPERTY_ADMIN_ROLE_ID;
}

/** @deprecated Use isPropertyAdminRoleId — kept for callers mid-migration. */
export function isBuiltinPropertyRole(roleId: string): roleId is typeof PROPERTY_ADMIN_ROLE_ID {
  return isPropertyAdminRoleId(roleId);
}

export function isLegacyBuiltinPropertyRole(roleId: string): roleId is LegacyBuiltinPropertyRole {
  return (LEGACY_BUILTIN_PROPERTY_ROLES as readonly string[]).includes(roleId);
}

export function isCustomRoleId(roleId: string): boolean {
  return UUID_RE.test(roleId);
}

export function assertValidRoleId(roleId: string): void {
  if (isPropertyAdminRoleId(roleId) || isCustomRoleId(roleId)) return;
  throw new Error(`Invalid role_id: ${roleId}`);
}

/** Any subset of the catalog (supports granting beyond template preset). Expands Phase 3–4 legacy ids. */
export function normalizePermissionIds(raw: unknown): TeamPermissionId[] {
  if (!Array.isArray(raw)) return [];
  const expanded = expandLegacyPropertyPermissionIds(
    raw.filter((item): item is string => typeof item === 'string')
  );
  const out: TeamPermissionId[] = [];
  const seen = new Set<string>();
  for (const id of expanded) {
    if (!TEAM_PERMISSION_ID_SET.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id as TeamPermissionId);
  }
  return out;
}

export function permissionsInclude(
  granted: readonly string[],
  required: TeamPermissionId
): boolean {
  return granted.includes(required);
}

export function hasPropertyPermission(
  granted: readonly string[],
  required: TeamPermissionId
): boolean {
  return permissionsInclude(granted, required);
}

export function allTeamPermissions(): TeamPermissionId[] {
  return [...TEAM_PERMISSION_IDS];
}

export function resolvePresetPermissions(
  roleId: string,
  customRolesById: Map<string, PropertyCustomRoleRow>
): TeamPermissionId[] {
  // ADMIN = property team member with full catalog (mirrors org Admin), unless the
  // caller passes an explicit non-empty permissions array via resolveAssignPermissions.
  if (isPropertyAdminRoleId(roleId)) {
    return allTeamPermissions();
  }
  const custom = customRolesById.get(roleId);
  return normalizePermissionIds(custom?.permissions ?? []);
}

/**
 * Effective permissions for an active member row.
 * Inactive members must not receive API access — caller checks status first.
 */
export function effectiveMemberPermissions(
  member: Pick<PropertyMemberRow, 'permissions' | 'status'>
): TeamPermissionId[] {
  if (member.status !== 'active') return [];
  const stored = normalizePermissionIds(member.permissions);
  return stored.length > 0 ? stored : [];
}

/** Preset for new invite/member when client omits explicit permissions. */
export function defaultPermissionsForRole(
  roleId: string,
  customRolesById: Map<string, PropertyCustomRoleRow>
): TeamPermissionId[] {
  assertValidRoleId(roleId);
  return resolvePresetPermissions(roleId, customRolesById);
}

/** Team API gates (Full Access template includes both). */
export const TEAM_API_PERMISSIONS = {
  listMembers: 'team:view',
  listInvitations: 'team:view',
  listCustomRoles: 'team:view',
  inviteMember: 'team.invitations:add',
  resendInvitation: 'team.invitations:edit',
  cancelInvitation: 'team.invitations:delete',
  updateMember: 'team.members:edit',
  removeMember: 'team.members:delete',
  createCustomRole: 'team.customRoles:add',
  updateCustomRole: 'team.customRoles:edit',
  deleteCustomRole: 'team.customRoles:delete',
} as const satisfies Record<string, TeamPermissionId>;

/** True if member can change other members' access (ex-`team:manage`). */
export function hasPropertyTeamManageAccess(granted: readonly string[]): boolean {
  return (
    hasPropertyPermission(granted, 'team.members:edit') ||
    hasPropertyPermission(granted, 'team.members:delete') ||
    hasPropertyPermission(granted, 'team.customRoles:add') ||
    hasPropertyPermission(granted, 'team.customRoles:edit') ||
    hasPropertyPermission(granted, 'team.customRoles:delete')
  );
}

export function inviteExpiresAt(from = new Date()): Date {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() + PROPERTY_INVITE_TTL_DAYS);
  return d;
}

export function normalizeInviteEmail(email: string): string {
  return email.trim().toLowerCase();
}
