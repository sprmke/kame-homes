/**
 * Parking team RBAC — server-side contract (mirrors property team; parking-scoped catalog).
 *
 * Standard roles: MANAGER | STAFF | VIEWER
 * Custom roles: parking_custom_roles.id (UUID string on member/invite rows)
 */

export const BUILTIN_PARKING_ROLES = ['MANAGER', 'STAFF', 'VIEWER'] as const;
export type BuiltinParkingRole = (typeof BUILTIN_PARKING_ROLES)[number];

export const PARKING_INVITE_TTL_DAYS = 7;

export const PARKING_TEAM_PERMISSION_IDS = [
  'bookings:view',
  'bookings:edit',
  'finance:view',
  'finance:edit',
  'pricing:view',
  'pricing:edit',
  'notifications:view',
  'notifications:edit',
  'settings:view',
  'settings:edit',
  'team:view',
  'team:invite',
  'team:manage',
  'inbox:view',
  'inbox:reply',
  'inbox:manage',
  'activity:view',
] as const;

export type ParkingTeamPermissionId = (typeof PARKING_TEAM_PERMISSION_IDS)[number];

const PARKING_PERMISSION_ID_SET = new Set<string>(PARKING_TEAM_PERMISSION_IDS);

export const BUILTIN_PARKING_ROLE_EMAIL_DESCRIPTIONS: Record<BuiltinParkingRole, string> = {
  MANAGER:
    'Full Access includes bookings, finance, settings, and team management for this parking slot.',
  STAFF: 'Operations can manage parking bookings, pricing, and notifications for this slot.',
  VIEWER: 'Read Only has view access to this parking slot.',
};

export const BUILTIN_PARKING_ROLE_PERMISSIONS: Record<
  BuiltinParkingRole,
  ParkingTeamPermissionId[]
> = {
  MANAGER: [...PARKING_TEAM_PERMISSION_IDS],
  STAFF: [
    'bookings:view',
    'bookings:edit',
    'notifications:view',
    'pricing:view',
    'inbox:view',
    'inbox:reply',
    'activity:view',
  ],
  VIEWER: [
    'bookings:view',
    'notifications:view',
    'pricing:view',
    'team:view',
    'inbox:view',
    'activity:view',
  ],
};

export const ROLE_PERMISSIONS = BUILTIN_PARKING_ROLE_PERMISSIONS;

export type ParkingCustomRoleRow = {
  id: string;
  parking_id: string;
  name: string;
  permissions: string[];
};

export type ParkingMemberRow = {
  id: string;
  parking_id: string;
  user_id: string;
  role_id: string;
  permissions: string[];
  saved_permissions: string[] | null;
  status: 'active' | 'inactive';
  invited_by: string | null;
  assigned_at: string;
  last_active_at: string | null;
  display_name: string | null;
  contact_phone: string | null;
};

export type ParkingInvitationRow = {
  id: string;
  parking_id: string;
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
  display_name: string | null;
  contact_phone: string | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isBuiltinParkingRole(roleId: string): roleId is BuiltinParkingRole {
  return (BUILTIN_PARKING_ROLES as readonly string[]).includes(roleId);
}

export function isCustomRoleId(roleId: string): boolean {
  return UUID_RE.test(roleId);
}

export function assertValidRoleId(roleId: string): void {
  if (isBuiltinParkingRole(roleId) || isCustomRoleId(roleId)) return;
  throw new Error(`Invalid role_id: ${roleId}`);
}

export function normalizePermissionIds(raw: unknown): ParkingTeamPermissionId[] {
  if (!Array.isArray(raw)) return [];
  const out: ParkingTeamPermissionId[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const id = item.trim();
    if (!PARKING_PERMISSION_ID_SET.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id as ParkingTeamPermissionId);
  }
  return out;
}

export function hasParkingPermission(
  granted: readonly string[],
  required: ParkingTeamPermissionId
): boolean {
  return granted.includes(required);
}

export function allParkingTeamPermissions(): ParkingTeamPermissionId[] {
  return [...PARKING_TEAM_PERMISSION_IDS];
}

export function builtinRolePreset(roleId: BuiltinParkingRole): ParkingTeamPermissionId[] {
  return [...BUILTIN_PARKING_ROLE_PERMISSIONS[roleId]];
}

export function resolvePresetPermissions(
  roleId: string,
  customRolesById: Map<string, ParkingCustomRoleRow>
): ParkingTeamPermissionId[] {
  if (isBuiltinParkingRole(roleId)) {
    return builtinRolePreset(roleId);
  }
  const custom = customRolesById.get(roleId);
  return normalizePermissionIds(custom?.permissions ?? []);
}

export function effectiveMemberPermissions(
  member: Pick<ParkingMemberRow, 'permissions' | 'status'>
): ParkingTeamPermissionId[] {
  if (member.status !== 'active') return [];
  const stored = normalizePermissionIds(member.permissions);
  return stored.length > 0 ? stored : [];
}

export function defaultPermissionsForRole(
  roleId: string,
  customRolesById: Map<string, ParkingCustomRoleRow>
): ParkingTeamPermissionId[] {
  assertValidRoleId(roleId);
  return resolvePresetPermissions(roleId, customRolesById);
}

export const PARKING_TEAM_API_PERMISSIONS = {
  listMembers: 'team:view',
  listInvitations: 'team:view',
  listCustomRoles: 'team:view',
  inviteMember: 'team:invite',
  resendInvitation: 'team:invite',
  cancelInvitation: 'team:invite',
  updateMember: 'team:manage',
  removeMember: 'team:manage',
  createCustomRole: 'team:manage',
  updateCustomRole: 'team:manage',
  deleteCustomRole: 'team:manage',
} as const satisfies Record<string, ParkingTeamPermissionId>;

export function inviteExpiresAt(from = new Date()): Date {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() + PARKING_INVITE_TTL_DAYS);
  return d;
}

export function normalizeInviteEmail(email: string): string {
  return email.trim().toLowerCase();
}
