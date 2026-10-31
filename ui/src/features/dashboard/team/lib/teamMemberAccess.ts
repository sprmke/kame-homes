import { getRolePermissions } from '@/features/dashboard/team/lib/propertyTeamRoles';
import type { CustomPropertyRole, TeamMember } from '@/features/dashboard/team/types/propertyTeam';

export function isTeamMemberActive(member: TeamMember) {
  return member.status === 'active';
}

export function deactivateTeamMember(member: TeamMember): TeamMember {
  return {
    ...member,
    status: 'inactive',
    savedPermissions: [...member.permissions],
    permissions: [],
  };
}

export function activateTeamMember(
  member: TeamMember,
  customRoles: CustomPropertyRole[]
): TeamMember {
  const restored =
    member.savedPermissions && member.savedPermissions.length > 0
      ? [...member.savedPermissions]
      : getRolePermissions(member.role, customRoles);

  return {
    ...member,
    status: 'active',
    permissions: restored,
    savedPermissions: undefined,
  };
}
