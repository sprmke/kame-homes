import {
  findOrgTemplateIdByName,
  isSeededOrgTemplateName,
  SEEDED_ORG_TEMPLATE_NAMES,
  sortOrgTemplatesForDisplay,
} from '@/features/dashboard/team/lib/orgTeamTemplates';
import { findMatchingTemplate } from '@/features/dashboard/team/lib/permissionTreeState';
import type { CustomOrgRole } from '@/features/dashboard/team/types/orgTeam';

export const ORG_OWNER_ROLE_ID = 'OWNER';
export const ORG_LEGACY_ADMIN_ROLE_ID = 'ADMIN';

export type RoleSubject = {
  role: string;
  isOwner?: boolean;
  permissions?: readonly string[];
};

export function isOrgOwnerRoleId(roleId: string): boolean {
  return roleId === ORG_OWNER_ROLE_ID;
}

function isOrgLegacyAdminRoleId(roleId: string): boolean {
  return roleId === ORG_LEGACY_ADMIN_ROLE_ID;
}

export function resolveOrgMemberTemplateRoleId(
  subject: RoleSubject,
  customRoles: CustomOrgRole[]
): string {
  if (subject.isOwner || isOrgOwnerRoleId(subject.role)) {
    return (
      findOrgTemplateIdByName(customRoles, SEEDED_ORG_TEMPLATE_NAMES.FULL_ACCESS) ?? subject.role
    );
  }

  if (customRoles.some((role) => role.id === subject.role)) {
    return subject.role;
  }

  if (isOrgLegacyAdminRoleId(subject.role)) {
    if (subject.permissions?.length) {
      const matched = findMatchingTemplate(subject.permissions, customRoles);
      if (matched) return matched.id;
    }
    return (
      findOrgTemplateIdByName(customRoles, SEEDED_ORG_TEMPLATE_NAMES.OPERATIONS) ?? subject.role
    );
  }

  return subject.role;
}

export function getOrgMemberRoleLabel(subject: RoleSubject, customRoles: CustomOrgRole[]): string {
  const roleId = resolveOrgMemberTemplateRoleId(subject, customRoles);
  const template = customRoles.find((role) => role.id === roleId);
  if (template) return template.name;
  if (subject.isOwner || isOrgOwnerRoleId(subject.role)) {
    return SEEDED_ORG_TEMPLATE_NAMES.FULL_ACCESS;
  }
  return roleId;
}

export function getOrgMemberRoleColor(subject: RoleSubject, customRoles: CustomOrgRole[]): string {
  const roleId = resolveOrgMemberTemplateRoleId(subject, customRoles);
  const template = customRoles.find((role) => role.id === roleId);
  if (template && isSeededOrgTemplateName(template.name)) {
    return 'bg-sky-500';
  }
  if (template) return 'bg-violet-500';
  return 'bg-gray-500';
}

export function listSeededOrgRoleFilters(customRoles: CustomOrgRole[]): CustomOrgRole[] {
  return sortOrgTemplatesForDisplay(customRoles).filter((role) =>
    isSeededOrgTemplateName(role.name)
  );
}
