import { isCurrentTeamMember } from '@/features/dashboard/team/lib/sortTeamMembersByCurrentUser';
import type { OrgTeamMember } from '@/features/dashboard/team/types/orgTeam';
import type { TeamMember } from '@/features/dashboard/team/types/propertyTeam';

export function canEditOrgMemberContact(
  member: OrgTeamMember,
  currentUserEmail: string | null | undefined,
  canManage: boolean
): boolean {
  if (isCurrentTeamMember(member.email, currentUserEmail)) return true;
  if (canManage && !member.isOwner) return true;
  return false;
}

export function canEditPropertyMemberContact(
  member: TeamMember,
  canManageProperty: boolean
): boolean {
  if (member.fromOrg) return false;
  return canManageProperty;
}

export function memberContactLabel(member: {
  displayName?: string;
  contactPhone?: string;
}): string | null {
  const phone = member.contactPhone?.trim();
  if (phone) return phone;
  return null;
}
