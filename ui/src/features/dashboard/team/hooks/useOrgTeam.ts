import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useOrgScopeKey } from '@/features/dashboard/org/lib/adminApiScope';
import { handleAiMutationError, isAiQuotaError } from '@/features/dashboard/org/lib/aiQuotaToast';
import type { TeamInviteCapacity } from '@/features/dashboard/plans/lib/planFeatures';
import type { OrgListingAssignments } from '@/features/dashboard/team/components/OrgListingAssignmentPicker';
import { orgTeamGet, orgTeamMutate } from '@/features/dashboard/team/lib/orgTeamApi';
import { teamRoleToastMessage } from '@/features/dashboard/team/lib/teamRoleToast';
import type {
  CustomOrgRole,
  OrgRoleId,
  OrgTeamAccess,
  OrgTeamInvitation,
  OrgTeamMember,
} from '@/features/dashboard/team/types/orgTeam';

import { friendlyToastError } from '@/lib/feedback/toastMessages';

export const ORG_TEAM_QUERY_KEY = ['org-team'] as const;

export type OrgTeamData = {
  members: OrgTeamMember[];
  invitations: OrgTeamInvitation[];
  customRoles: CustomOrgRole[];
  access: OrgTeamAccess;
  teamInviteCapacity: TeamInviteCapacity | null;
};

async function loadOrgTeam(orgSlug: string, orgId: string): Promise<OrgTeamData> {
  const [membersResult, invitationsResult, customRolesResult] = await Promise.allSettled([
    orgTeamGet<{
      members: OrgTeamMember[];
      access: OrgTeamAccess;
      teamInviteCapacity?: TeamInviteCapacity;
    }>('/org-team-members', orgSlug, orgId),
    orgTeamGet<{ invitations: OrgTeamInvitation[] }>('/org-team-invitations', orgSlug, orgId),
    orgTeamGet<{ customRoles: CustomOrgRole[] }>('/org-team-custom-roles', orgSlug, orgId),
  ]);

  if (membersResult.status === 'rejected') {
    throw membersResult.reason instanceof Error
      ? membersResult.reason
      : new Error('Failed to load team members');
  }

  const membersPayload = membersResult.value;
  const invitationsPayload =
    invitationsResult.status === 'fulfilled' ? invitationsResult.value : { invitations: [] };

  // Roles are required for Default/Custom sections and invite templates — do not
  // swallow failures as an empty list (that renders as misleading "DEFAULT 0").
  if (customRolesResult.status === 'rejected') {
    throw customRolesResult.reason instanceof Error
      ? customRolesResult.reason
      : new Error('Failed to load organization roles');
  }
  const customRolesPayload = customRolesResult.value;

  return {
    members: membersPayload.members ?? [],
    invitations: invitationsPayload.invitations ?? [],
    customRoles: customRolesPayload.customRoles ?? [],
    access: membersPayload.access ?? { canManage: false, accessKind: 'org_admin' },
    teamInviteCapacity: membersPayload.teamInviteCapacity ?? null,
  };
}

export function useOrgTeam(orgId: string | null) {
  const { orgSlug } = useOrgScopeKey();

  return useQuery({
    queryKey: [...ORG_TEAM_QUERY_KEY, orgSlug, orgId],
    queryFn: () => {
      if (!orgSlug || !orgId) throw new Error('Organization not found');
      return loadOrgTeam(orgSlug, orgId);
    },
    enabled: Boolean(orgSlug && orgId),
    // Membership/roles change infrequently; mutations already invalidate this exact key.
    staleTime: 60_000,
  });
}

export function useOrgTeamMutations(orgId: string | null) {
  const { orgSlug } = useOrgScopeKey();
  const queryClient = useQueryClient();

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: [...ORG_TEAM_QUERY_KEY, orgSlug, orgId],
    });
  };

  const requireOrg = () => {
    if (!orgSlug) throw new Error('Organization not found');
    return { orgSlug, orgId };
  };

  const inviteMember = useMutation({
    mutationFn: async (input: {
      email: string;
      contactPhone: string;
      roleId: OrgRoleId;
      permissions: string[];
      allListings: boolean;
      listingAssignments: OrgListingAssignments;
    }) => {
      const { orgSlug: slug, orgId: id } = requireOrg();
      return orgTeamMutate<{ invitation: OrgTeamInvitation }>(
        '/org-team-invitations',
        slug,
        id,
        'POST',
        {
          email: input.email.trim(),
          contactPhone: input.contactPhone.trim(),
          roleId: input.roleId,
          permissions: input.permissions,
          allListings: input.allListings,
          listingAssignments: input.listingAssignments,
        }
      );
    },
    onSuccess: () => {
      invalidate();
      toast.success('Invitation sent');
    },
    onError: (error: Error) => {
      if (isAiQuotaError(error)) {
        handleAiMutationError(error);
        return;
      }
      toast.error(friendlyToastError(error, 'Failed to send invitation'));
    },
  });

  const resendInvitation = useMutation({
    mutationFn: async (invitationId: string) => {
      const { orgSlug: slug, orgId: id } = requireOrg();
      return orgTeamMutate<{ invitation: OrgTeamInvitation }>(
        '/org-team-invitations',
        slug,
        id,
        'POST',
        { action: 'resend', invitationId }
      );
    },
    onSuccess: () => {
      invalidate();
      toast.success('Invitation resent');
    },
    onError: (error: Error) => {
      toast.error(friendlyToastError(error, 'Failed to resend invitation'));
    },
  });

  const cancelInvitation = useMutation({
    mutationFn: async (invitationId: string) => {
      const { orgSlug: slug, orgId: id } = requireOrg();
      return orgTeamMutate<{ cancelled: boolean }>('/org-team-invitations', slug, id, 'DELETE', {
        invitationId,
      });
    },
    onSuccess: () => {
      invalidate();
      toast.success('Invitation cancelled');
    },
    onError: (error: Error) => {
      toast.error(friendlyToastError(error, 'Failed to cancel invitation'));
    },
  });

  const updateMember = useMutation({
    mutationFn: async (input: {
      memberId: string;
      status?: 'active' | 'inactive';
      displayName?: string;
      contactPhone?: string;
      roleId?: string;
      permissions?: string[];
      allListings?: boolean;
      listingAssignments?: OrgListingAssignments;
    }) => {
      const { orgSlug: slug, orgId: id } = requireOrg();
      return orgTeamMutate<{ member: OrgTeamMember }>(
        '/org-team-members',
        slug,
        id,
        'PATCH',
        input
      );
    },
    onSuccess: () => {
      invalidate();
    },
    onError: (error: Error) => {
      if (isAiQuotaError(error)) {
        handleAiMutationError(error);
        return;
      }
      toast.error(friendlyToastError(error, 'Failed to update member'));
    },
  });

  const removeMember = useMutation({
    mutationFn: async (memberId: string) => {
      const { orgSlug: slug, orgId: id } = requireOrg();
      return orgTeamMutate<{ removed: boolean }>('/org-team-members', slug, id, 'DELETE', {
        memberId,
      });
    },
    onSuccess: () => {
      invalidate();
      toast.success('Member removed');
    },
    onError: (error: Error) => {
      toast.error(friendlyToastError(error, 'Failed to remove member'));
    },
  });

  const createCustomRole = useMutation({
    mutationFn: async (input: {
      name: string;
      permissions: string[];
      allListings?: boolean;
      listingAssignments?: OrgListingAssignments;
    }) => {
      const { orgSlug: slug, orgId: id } = requireOrg();
      return orgTeamMutate<{ customRole: CustomOrgRole }>(
        '/org-team-custom-roles',
        slug,
        id,
        'POST',
        input
      );
    },
    onSuccess: (_data, variables) => {
      invalidate();
      toast.success(teamRoleToastMessage('created', variables.name));
    },
    onError: (error: Error) => {
      toast.error(friendlyToastError(error, 'Failed to create role'));
    },
  });

  const updateCustomRole = useMutation({
    mutationFn: async (input: {
      roleId: string;
      name?: string;
      permissions?: string[];
      allListings?: boolean;
      listingAssignments?: OrgListingAssignments;
    }) => {
      const { orgSlug: slug, orgId: id } = requireOrg();
      return orgTeamMutate<{ customRole: CustomOrgRole }>(
        '/org-team-custom-roles',
        slug,
        id,
        'PATCH',
        input
      );
    },
    onSuccess: (data, variables) => {
      invalidate();
      toast.success(teamRoleToastMessage('updated', variables.name ?? data.customRole.name));
    },
    onError: (error: Error) => {
      toast.error(friendlyToastError(error, 'Failed to update role'));
    },
  });

  const deleteCustomRole = useMutation({
    mutationFn: async (input: { roleId: string; name?: string }) => {
      const { orgSlug: slug, orgId: id } = requireOrg();
      return orgTeamMutate<{ deleted: boolean }>('/org-team-custom-roles', slug, id, 'DELETE', {
        roleId: input.roleId,
      });
    },
    onSuccess: (_data, variables) => {
      invalidate();
      toast.success(teamRoleToastMessage('deleted', variables.name));
    },
    onError: (error: Error) => {
      toast.error(friendlyToastError(error, 'Failed to delete role'));
    },
  });

  return {
    inviteMember,
    resendInvitation,
    cancelInvitation,
    updateMember,
    removeMember,
    createCustomRole,
    updateCustomRole,
    deleteCustomRole,
  };
}
