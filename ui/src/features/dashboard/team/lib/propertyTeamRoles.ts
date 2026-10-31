import {
  isPropertyAdminRoleId,
  PROPERTY_ADMIN_ROLE_ID,
  TEAM_PERMISSIONS,
} from '@/features/dashboard/team/lib/propertyTeamConstants';
import {
  isSeededTemplateName,
  sortTemplatesForDisplay,
} from '@/features/dashboard/team/lib/propertyTeamTemplates';
import type {
  CustomPropertyRole,
  PropertyRoleId,
} from '@/features/dashboard/team/types/propertyTeam';

export const CUSTOM_ROLE_COLOR = 'bg-violet-500';
export const SEEDED_TEMPLATE_COLOR = 'bg-sky-500';

export function isTemplateRoleId(
  roleId: PropertyRoleId,
  customRoles: CustomPropertyRole[]
): boolean {
  return customRoles.some((role) => role.id === roleId);
}

export function getRoleLabel(roleId: PropertyRoleId, customRoles: CustomPropertyRole[]): string {
  if (isPropertyAdminRoleId(roleId)) {
    return 'Custom';
  }
  return customRoles.find((role) => role.id === roleId)?.name ?? 'Custom';
}

export function getRoleColor(roleId: PropertyRoleId, customRoles: CustomPropertyRole[]): string {
  if (isPropertyAdminRoleId(roleId)) {
    return 'bg-slate-500';
  }
  const custom = customRoles.find((role) => role.id === roleId);
  if (custom && isSeededTemplateName(custom.name)) {
    return SEEDED_TEMPLATE_COLOR;
  }
  return CUSTOM_ROLE_COLOR;
}

export function getRolePermissions(
  roleId: PropertyRoleId,
  customRoles: CustomPropertyRole[]
): string[] {
  if (isPropertyAdminRoleId(roleId)) {
    return TEAM_PERMISSIONS.map((permission) => permission.id);
  }
  const custom = customRoles.find((role) => role.id === roleId);
  if (custom) {
    return [...custom.permissions];
  }
  return [];
}

export type RoleMatrixColumn = {
  id: PropertyRoleId;
  label: string;
  color: string;
  permissions: string[];
  isCustom: boolean;
};

export function buildRoleMatrixColumns(customRoles: CustomPropertyRole[]): RoleMatrixColumn[] {
  return sortTemplatesForDisplay(customRoles).map((role) => ({
    id: role.id,
    label: role.name,
    color: isSeededTemplateName(role.name) ? SEEDED_TEMPLATE_COLOR : CUSTOM_ROLE_COLOR,
    permissions: role.permissions,
    isCustom: !isSeededTemplateName(role.name),
  }));
}

export function countMembersWithRole(
  roleId: PropertyRoleId,
  members: { role: PropertyRoleId }[],
  invitations: { role: PropertyRoleId }[]
): number {
  return (
    members.filter((member) => member.role === roleId).length +
    invitations.filter((invitation) => invitation.role === roleId).length
  );
}

export function defaultInviteTemplateId(customRoles: CustomPropertyRole[]): PropertyRoleId {
  const operations = customRoles.find((role) => role.name.trim().toLowerCase() === 'operations');
  if (operations?.id) {
    return operations.id;
  }
  return customRoles[0]?.id ?? PROPERTY_ADMIN_ROLE_ID;
}
