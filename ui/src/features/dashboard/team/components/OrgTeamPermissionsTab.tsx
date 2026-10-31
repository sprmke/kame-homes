import { TeamPermissionsTab } from '@/features/dashboard/team/components/TeamPermissionsTab';
import { countOrgMembersWithTemplateRole } from '@/features/dashboard/team/lib/orgTeamRoles';
import type {
  CustomOrgRole,
  OrgTeamInvitation,
  OrgTeamMember,
} from '@/features/dashboard/team/types/orgTeam';

type Props = {
  customRoles: CustomOrgRole[];
  members: OrgTeamMember[];
  invitations: OrgTeamInvitation[];
  onCreateCustomRole: () => void;
  onEditCustomRole: (role: CustomOrgRole) => void;
  onDeleteCustomRole: (role: CustomOrgRole) => void;
  onDuplicateCustomRole?: (role: CustomOrgRole) => void;
  canManage?: boolean;
};

export function OrgTeamPermissionsTab({
  customRoles,
  members,
  invitations,
  onCreateCustomRole,
  onEditCustomRole,
  onDeleteCustomRole,
  onDuplicateCustomRole,
  canManage = true,
}: Props) {
  return (
    <TeamPermissionsTab
      scope="org"
      customRoles={customRoles}
      memberCountByRole={(roleId) =>
        countOrgMembersWithTemplateRole(roleId, members, invitations, customRoles)
      }
      onCreateCustomRole={onCreateCustomRole}
      onEditCustomRole={onEditCustomRole}
      onDeleteCustomRole={onDeleteCustomRole}
      onDuplicateCustomRole={onDuplicateCustomRole}
      canManage={canManage}
    />
  );
}
