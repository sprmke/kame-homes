import {
  buildOrgTemplateMatrixColumns,
  getOrgRoleColor,
  getOrgRoleLabel,
  getOrgRolePermissions,
  isOrgAdminRoleId,
  ORG_SEEDED_TEMPLATE_COLOR,
} from '@/features/dashboard/team/lib/orgTeamRoles';
import { isSeededOrgTemplateName } from '@/features/dashboard/team/lib/orgTeamTemplates';
import { isPropertyAdminRoleId } from '@/features/dashboard/team/lib/propertyTeamConstants';
import {
  buildRoleMatrixColumns,
  getRoleColor,
  getRoleLabel,
  getRolePermissions,
  SEEDED_TEMPLATE_COLOR,
} from '@/features/dashboard/team/lib/propertyTeamRoles';
import { isSeededTemplateName } from '@/features/dashboard/team/lib/propertyTeamTemplates';
import {
  getTeamScopeConfig,
  type TeamScope,
  type TeamScopeConfig,
} from '@/features/dashboard/team/lib/teamScopeConfig';
import type {
  CustomPropertyRole,
  PropertyRoleId,
} from '@/features/dashboard/team/types/propertyTeam';

export const CUSTOM_ROLE_COLOR = 'bg-violet-500';

export type RoleMatrixColumn = {
  id: PropertyRoleId;
  label: string;
  color: string;
  permissions: string[];
  isCustom: boolean;
};

function configFor(scope: TeamScope): TeamScopeConfig {
  return getTeamScopeConfig(scope);
}

export function isBuiltinRoleIdForScope(scope: TeamScope, roleId: PropertyRoleId): boolean {
  if (scope === 'property') {
    return isPropertyAdminRoleId(roleId);
  }
  if (scope === 'org') {
    return isOrgAdminRoleId(roleId);
  }
  return configFor(scope).builtinRoles.some((role) => role.value === roleId);
}

export function getRoleLabelForScope(
  scope: TeamScope,
  roleId: PropertyRoleId,
  customRoles: CustomPropertyRole[]
): string {
  if (scope === 'property') {
    return getRoleLabel(roleId, customRoles);
  }
  if (scope === 'org') {
    return getOrgRoleLabel(roleId, customRoles);
  }
  const config = configFor(scope);
  const builtin = config.builtinRoles.find((role) => role.value === roleId);
  if (builtin) return builtin.label;
  return customRoles.find((role) => role.id === roleId)?.name ?? 'Custom';
}

export function getRoleColorForScope(
  scope: TeamScope,
  roleId: PropertyRoleId,
  customRoles: CustomPropertyRole[]
): string {
  if (scope === 'property') {
    return getRoleColor(roleId, customRoles);
  }
  if (scope === 'org') {
    return getOrgRoleColor(roleId, customRoles);
  }
  const config = configFor(scope);
  const builtin = config.builtinRoles.find((role) => role.value === roleId);
  if (builtin) return builtin.color;
  void customRoles;
  return CUSTOM_ROLE_COLOR;
}

export function getRolePermissionsForScope(
  scope: TeamScope,
  roleId: PropertyRoleId,
  customRoles: CustomPropertyRole[]
): string[] {
  if (scope === 'property') {
    return getRolePermissions(roleId, customRoles);
  }
  if (scope === 'org') {
    return getOrgRolePermissions(roleId, customRoles);
  }
  const config = configFor(scope);
  const preset = config.rolePermissions[roleId];
  if (preset) return [...preset];
  const custom = customRoles.find((role) => role.id === roleId);
  return custom ? [...custom.permissions] : [];
}

export function buildRoleMatrixColumnsForScope(
  scope: TeamScope,
  customRoles: CustomPropertyRole[]
): RoleMatrixColumn[] {
  if (scope === 'property') {
    return buildRoleMatrixColumns(customRoles);
  }
  if (scope === 'org') {
    return buildOrgTemplateMatrixColumns(customRoles);
  }

  const config = configFor(scope);
  const builtIn = config.builtinRoles.map((role) => ({
    id: role.value as PropertyRoleId,
    label: role.label,
    color: role.color,
    permissions: config.rolePermissions[role.value] ?? [],
    isCustom: false,
  }));

  const custom = customRoles.map((role) => ({
    id: role.id as PropertyRoleId,
    label: role.name,
    color: CUSTOM_ROLE_COLOR,
    permissions: role.permissions,
    isCustom: true,
  }));

  return [...builtIn, ...custom];
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

export {
  SEEDED_TEMPLATE_COLOR,
  ORG_SEEDED_TEMPLATE_COLOR,
  isSeededTemplateName,
  isSeededOrgTemplateName,
};
