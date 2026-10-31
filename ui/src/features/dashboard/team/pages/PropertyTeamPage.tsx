import { useCallback, useState } from 'react';

import { Mail, Shield, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';

import { TeamInviteTierBadgeAnchor } from '@/features/dashboard/plans/components/TierBadge';
import { useUpgradeModal } from '@/features/dashboard/plans/components/UpgradeModalProvider';
import { useFeatureGate } from '@/features/dashboard/plans/hooks/useFeatureGate';
import { CustomRoleFormDialog } from '@/features/dashboard/team/components/CustomRoleFormDialog';
import { EditMemberContactDialog } from '@/features/dashboard/team/components/EditMemberContactDialog';
import {
  defaultInviteRoleId,
  InviteMemberDialog,
} from '@/features/dashboard/team/components/InviteMemberDialog';
import { RemoveMemberDialog } from '@/features/dashboard/team/components/RemoveMemberDialog';
import { TeamInvitationsTab } from '@/features/dashboard/team/components/TeamInvitationsTab';
import { TeamMembersTab } from '@/features/dashboard/team/components/TeamMembersTab';
import { TeamPermissionsTab } from '@/features/dashboard/team/components/TeamPermissionsTab';
import { TeamStatsCards } from '@/features/dashboard/team/components/TeamStatsCards';
import { usePropertyPermissions } from '@/features/dashboard/team/hooks/usePropertyPermissions';
import {
  usePropertyTeam,
  usePropertyTeamMutations,
} from '@/features/dashboard/team/hooks/usePropertyTeam';
import { hasPropertyPermission } from '@/features/dashboard/team/lib/propertyPermissions';
import { defaultBaselineRolePermissions } from '@/features/dashboard/team/lib/customRoleFormSteps';
import {
  countMembersWithRole,
  getRolePermissions,
} from '@/features/dashboard/team/lib/propertyTeamRoles';
import { defaultInviteTemplateId } from '@/features/dashboard/team/lib/propertyTeamRoles';
import { isTeamMemberActive } from '@/features/dashboard/team/lib/teamMemberAccess';
import { canEditPropertyMemberContact } from '@/features/dashboard/team/lib/teamMemberContact';
import type {
  CustomPropertyRole,
  CustomRoleFormMode,
  PropertyRoleId,
  TeamMember,
  TeamTab,
} from '@/features/dashboard/team/types/propertyTeam';
import type { EditMemberContactSaveInput } from '@/features/dashboard/team/types/teamContact';

import { AdminMobilePage } from '@/components/mobile/MobileBrandHero';
import { MobileHeroActionButton } from '@/components/mobile/MobileHeroActionButton';
import { TeamPageSkeleton } from '@/components/skeletons/AdminSkeletons';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SlidingTabs, SlidingTabsList, SlidingTabsTrigger } from '@/components/ui/sliding-tabs';
import { TooltipProvider } from '@/components/ui/tooltip';

export function PropertyTeamPage() {
  const { data, isLoading, error } = usePropertyTeam();
  const { data: access } = usePropertyPermissions();
  const canViewTeam = hasPropertyPermission(access?.permissions, 'team:view');
  const canInvite = hasPropertyPermission(access?.permissions, 'team.invitations:add');
  const canResendInvite = hasPropertyPermission(access?.permissions, 'team.invitations:edit');
  const canCancelInvite = hasPropertyPermission(access?.permissions, 'team.invitations:delete');
  const canEditMembers = hasPropertyPermission(access?.permissions, 'team.members:edit');
  const canDeleteMembers = hasPropertyPermission(access?.permissions, 'team.members:delete');
  const canManageCustomRoles =
    hasPropertyPermission(access?.permissions, 'team.customRoles:add') ||
    hasPropertyPermission(access?.permissions, 'team.customRoles:edit') ||
    hasPropertyPermission(access?.permissions, 'team.customRoles:delete');
  const {
    inviteMember,
    resendInvitation,
    cancelInvitation,
    updateMember,
    removeMember,
    createCustomRole,
    updateCustomRole,
    deleteCustomRole,
  } = usePropertyTeamMutations();

  const members = data?.members ?? [];
  const invitations = data?.invitations ?? [];
  const customRoles = data?.customRoles ?? [];
  useFeatureGate('teamManagement');
  const { canUse: canUseCustomRoles, isLoading: customRolesLoading } =
    useFeatureGate('customRoles');
  const { open: openUpgradeModal } = useUpgradeModal();
  const canInviteByPlan = data?.teamInviteCapacity?.canInvite ?? false;
  const teamInviteCapacityKnown = data?.teamInviteCapacity?.canInvite;

  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [selectedTab, setSelectedTab] = useState<TeamTab>('members');

  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showContactDialog, setShowContactDialog] = useState(false);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);

  const [showCustomRoleDialog, setShowCustomRoleDialog] = useState(false);
  const [customRoleFormMode, setCustomRoleFormMode] = useState<CustomRoleFormMode>('create');
  const [editingCustomRoleId, setEditingCustomRoleId] = useState<string | null>(null);
  const [customRoleName, setCustomRoleName] = useState('');
  const [customRolePermissions, setCustomRolePermissions] = useState<string[]>([]);

  const defaultRoleId = defaultInviteTemplateId(customRoles);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteContactPhone, setInviteContactPhone] = useState('');
  const [inviteRoleId, setInviteRoleId] = useState<PropertyRoleId>(defaultRoleId);

  const memberCountByRole = useCallback(
    (roleId: string) => countMembersWithRole(roleId, members, invitations),
    [members, invitations]
  );

  const openInviteDialog = () => {
    if (!canInviteByPlan) {
      openUpgradeModal('teamManagement');
      return;
    }
    const roleId = defaultInviteRoleId(customRoles);
    setInviteEmail('');
    setInviteContactPhone('');
    setInviteRoleId(roleId);
    setShowInviteDialog(true);
  };

  const handleInvite = async (): Promise<boolean> => {
    const email = inviteEmail.trim();
    if (!email) return false;

    if (!canInviteByPlan) {
      openUpgradeModal('teamManagement');
      return false;
    }

    try {
      await inviteMember.mutateAsync({
        email,
        contactPhone: inviteContactPhone,
        roleId: inviteRoleId,
        permissions: getRolePermissions(inviteRoleId, customRoles),
      });
      setShowInviteDialog(false);
      return true;
    } catch {
      /* toast handled in mutation */
      return false;
    }
  };

  const handleToggleMemberStatus = async (member: TeamMember) => {
    if (!isTeamMemberActive(member) && member.planLimited && !canInviteByPlan) {
      openUpgradeModal('teamManagement');
      return;
    }

    try {
      await updateMember.mutateAsync({
        memberId: member.id,
        status: isTeamMemberActive(member) ? 'inactive' : 'active',
      });
      toast.success(isTeamMemberActive(member) ? 'Member deactivated' : 'Member activated');
    } catch {
      /* toast handled in mutation */
    }
  };

  const handleEditContact = (member: TeamMember) => {
    setSelectedMember(member);
    setShowContactDialog(true);
  };

  const handleSaveContact = async (input: EditMemberContactSaveInput): Promise<boolean> => {
    if (!selectedMember) return false;
    if (!canEditPropertyMemberContact(selectedMember, canEditMembers)) return false;

    try {
      await updateMember.mutateAsync({
        memberId: selectedMember.id,
        displayName: input.displayName,
        contactPhone: input.contactPhone,
        ...(input.roleId ? { roleId: input.roleId } : {}),
      });
      toast.success('Member updated');
      setShowContactDialog(false);
      setSelectedMember(null);
      return true;
    } catch {
      /* toast handled in mutation */
      return false;
    }
  };

  const handleRemoveMember = async () => {
    if (!selectedMember) return;
    try {
      await removeMember.mutateAsync(selectedMember.id);
      setShowRemoveDialog(false);
      setSelectedMember(null);
    } catch {
      /* toast handled in mutation */
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      await cancelInvitation.mutateAsync(invitationId);
    } catch {
      /* toast handled in mutation */
    }
  };

  const handleResendInvitation = async (invitationId: string) => {
    try {
      await resendInvitation.mutateAsync(invitationId);
    } catch {
      /* toast handled in mutation */
    }
  };

  const openCreateCustomRole = () => {
    if (!canUseCustomRoles) {
      if (!customRolesLoading) openUpgradeModal('customRoles');
      return;
    }
    setCustomRoleFormMode('create');
    setEditingCustomRoleId(null);
    setCustomRoleName('');
    setCustomRolePermissions(defaultBaselineRolePermissions(customRoles));
    setShowCustomRoleDialog(true);
  };

  const openEditCustomRole = (role: CustomPropertyRole) => {
    if (!canUseCustomRoles) {
      if (!customRolesLoading) openUpgradeModal('customRoles');
      return;
    }
    setCustomRoleFormMode('edit');
    setEditingCustomRoleId(role.id);
    setCustomRoleName(role.name);
    setCustomRolePermissions([...role.permissions]);
    setShowCustomRoleDialog(true);
  };

  const openDuplicateCustomRole = (role: CustomPropertyRole) => {
    if (!canUseCustomRoles) {
      if (!customRolesLoading) openUpgradeModal('customRoles');
      return;
    }
    setCustomRoleFormMode('create');
    setEditingCustomRoleId(null);
    setCustomRoleName(`${role.name} copy`);
    setCustomRolePermissions([...role.permissions]);
    setShowCustomRoleDialog(true);
  };

  const handleSaveCustomRole = async (): Promise<boolean> => {
    const name = customRoleName.trim();
    if (!name || customRolePermissions.length === 0) return false;

    try {
      if (customRoleFormMode === 'create') {
        await createCustomRole.mutateAsync({
          name,
          permissions: customRolePermissions,
        });
      } else if (editingCustomRoleId) {
        await updateCustomRole.mutateAsync({
          roleId: editingCustomRoleId,
          name,
          permissions: customRolePermissions,
        });
      }
      setShowCustomRoleDialog(false);
      return true;
    } catch {
      /* toast handled in mutation */
      return false;
    }
  };

  const handleDeleteCustomRole = async (role: CustomPropertyRole) => {
    if (!canUseCustomRoles) {
      if (!customRolesLoading) openUpgradeModal('customRoles');
      return;
    }
    if (memberCountByRole(role.id) > 0) {
      toast.error('Remove members from this role before deleting');
      return;
    }
    try {
      await deleteCustomRole.mutateAsync({ roleId: role.id, name: role.name });
    } catch {
      /* toast handled in mutation */
    }
  };

  const toggleCustomRolePermission = (permissionId: string) => {
    setCustomRolePermissions((prev) =>
      prev.includes(permissionId)
        ? prev.filter((id) => id !== permissionId)
        : [...prev, permissionId]
    );
  };

  const inviteAction = canInvite ? (
    <TeamInviteTierBadgeAnchor canInvite={teamInviteCapacityKnown} className="w-full sm:w-auto">
      <Button
        variant="outline"
        className="min-h-[44px] w-full sm:w-auto"
        onClick={openInviteDialog}
        disabled={isLoading || Boolean(error)}
        aria-disabled={!canInviteByPlan || undefined}
      >
        <UserPlus className="mr-2 size-4" aria-hidden />
        Invite Member
      </Button>
    </TeamInviteTierBadgeAnchor>
  ) : undefined;

  const heroInviteAction = canInvite ? (
    <TeamInviteTierBadgeAnchor canInvite={teamInviteCapacityKnown}>
      <MobileHeroActionButton
        aria-label="Invite member"
        onClick={openInviteDialog}
        disabled={isLoading || Boolean(error)}
      >
        <UserPlus className="size-5" aria-hidden />
      </MobileHeroActionButton>
    </TeamInviteTierBadgeAnchor>
  ) : undefined;

  return (
    <TooltipProvider>
      <AdminMobilePage
        title="Team"
        subtitle="Manage your property's team members and permissions."
        heroTrailing={heroInviteAction}
        desktopActions={inviteAction}
        desktopActionsClassName="w-full sm:w-auto"
      >
        {isLoading ? <TeamPageSkeleton /> : null}

        {error ? (
          <Card>
            <CardContent className="text-destructive py-8 text-center text-sm">
              {(error as Error).message}
            </CardContent>
          </Card>
        ) : null}

        {!isLoading && !error ? (
          <>
            <TeamStatsCards members={members} invitations={invitations} />

            <div className="space-y-3 sm:space-y-4">
              <SlidingTabs
                value={selectedTab}
                onValueChange={(value) => setSelectedTab(value as TeamTab)}
              >
                <SlidingTabsList
                  size="primary"
                  remeasureDeps={[canInvite, canViewTeam, invitations.length > 0]}
                >
                  <SlidingTabsTrigger value="members">
                    <Users className="size-4" aria-hidden />
                    <span className="hidden sm:inline">Members</span>
                  </SlidingTabsTrigger>
                  {canInvite || canResendInvite || canCancelInvite || invitations.length > 0 ? (
                    <SlidingTabsTrigger value="invitations">
                      <Mail className="size-4" aria-hidden />
                      <span className="hidden sm:inline">Invitations</span>
                    </SlidingTabsTrigger>
                  ) : null}
                  {canViewTeam ? (
                    <SlidingTabsTrigger value="permissions">
                      <Shield className="size-4" aria-hidden />
                      <span className="hidden sm:inline">Permissions</span>
                    </SlidingTabsTrigger>
                  ) : null}
                </SlidingTabsList>
              </SlidingTabs>

              {selectedTab === 'members' ? (
                <TeamMembersTab
                  members={members}
                  customRoles={customRoles}
                  searchQuery={searchQuery}
                  filterRole={filterRole}
                  onSearchChange={setSearchQuery}
                  onFilterRoleChange={setFilterRole}
                  onEditContact={handleEditContact}
                  onToggleStatus={handleToggleMemberStatus}
                  onRemove={(member) => {
                    setSelectedMember(member);
                    setShowRemoveDialog(true);
                  }}
                  onInvite={openInviteDialog}
                  canInvite={canInvite}
                  canInviteByPlan={teamInviteCapacityKnown}
                  canEditMembers={canEditMembers}
                  canDeleteMembers={canDeleteMembers}
                />
              ) : null}

              {selectedTab === 'invitations' ? (
                <TeamInvitationsTab
                  invitations={invitations}
                  customRoles={customRoles}
                  onCancel={handleCancelInvitation}
                  onResend={handleResendInvitation}
                  resendPending={resendInvitation.isPending}
                  cancelPending={cancelInvitation.isPending}
                  onInvite={openInviteDialog}
                  canInvite={canInvite}
                  canInviteByPlan={teamInviteCapacityKnown}
                  canResend={canResendInvite}
                  canCancel={canCancelInvite}
                />
              ) : null}

              {selectedTab === 'permissions' ? (
                <TeamPermissionsTab
                  customRoles={customRoles}
                  memberCountByRole={memberCountByRole}
                  onCreateCustomRole={openCreateCustomRole}
                  onEditCustomRole={openEditCustomRole}
                  onDeleteCustomRole={handleDeleteCustomRole}
                  onDuplicateCustomRole={openDuplicateCustomRole}
                  canManage={canManageCustomRoles}
                />
              ) : null}
            </div>
          </>
        ) : null}

        <InviteMemberDialog
          open={showInviteDialog}
          onOpenChange={setShowInviteDialog}
          email={inviteEmail}
          contactPhone={inviteContactPhone}
          roleId={inviteRoleId}
          customRoles={customRoles}
          onEmailChange={setInviteEmail}
          onContactPhoneChange={setInviteContactPhone}
          onRoleChange={setInviteRoleId}
          onAddCustomRole={canManageCustomRoles ? openCreateCustomRole : undefined}
          showAddCustomRole={canManageCustomRoles}
          onSubmit={handleInvite}
          submitPending={inviteMember.isPending}
        />

        <EditMemberContactDialog
          open={showContactDialog}
          member={selectedMember}
          roleConfig={
            selectedMember && !selectedMember.fromOrg
              ? {
                  scope: 'property',
                  roleId: selectedMember.role,
                  customRoles,
                  editable: canEditMembers,
                  onAddCustomRole: canManageCustomRoles ? openCreateCustomRole : undefined,
                }
              : null
          }
          onOpenChange={setShowContactDialog}
          onSave={handleSaveContact}
          savePending={updateMember.isPending}
        />

        <RemoveMemberDialog
          open={showRemoveDialog}
          member={selectedMember}
          onOpenChange={setShowRemoveDialog}
          onConfirm={handleRemoveMember}
          confirmPending={removeMember.isPending}
        />

        <CustomRoleFormDialog
          open={showCustomRoleDialog}
          mode={customRoleFormMode}
          name={customRoleName}
          permissions={customRolePermissions}
          roles={customRoles}
          onOpenChange={setShowCustomRoleDialog}
          onNameChange={setCustomRoleName}
          onTogglePermission={toggleCustomRolePermission}
          onPermissionsChange={setCustomRolePermissions}
          onSubmit={handleSaveCustomRole}
          submitPending={createCustomRole.isPending || updateCustomRole.isPending}
        />
      </AdminMobilePage>
    </TooltipProvider>
  );
}
