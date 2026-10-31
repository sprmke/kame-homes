import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';
import { handleAiMutationError, isAiQuotaError } from '@/features/dashboard/org/lib/aiQuotaToast';
import type { TeamInviteCapacity } from '@/features/dashboard/plans/lib/planFeatures';
import { teamGet, teamMutate } from '@/features/dashboard/team/lib/teamApi';
import { teamRoleToastMessage } from '@/features/dashboard/team/lib/teamRoleToast';
import type {
  CustomPropertyRole,
  PropertyRoleId,
  TeamInvitation,
  TeamMember,
} from '@/features/dashboard/team/types/propertyTeam';

import { friendlyToastError } from '@/lib/feedback/toastMessages';

export const PROPERTY_TEAM_QUERY_KEY = ['property-team'] as const;

export type PropertyTeamData = {
  members: TeamMember[];
  invitations: TeamInvitation[];
  customRoles: CustomPropertyRole[];
  teamInviteCapacity: TeamInviteCapacity | null;
};

async function loadPropertyTeam(propertyId: string): Promise<PropertyTeamData> {
  const [membersPayload, invitationsPayload, customRolesPayload] = await Promise.all([
    teamGet<{ members: TeamMember[]; teamInviteCapacity?: TeamInviteCapacity }>(
      '/property-team-members',
      propertyId
    ),
    teamGet<{ invitations: TeamInvitation[] }>('/property-team-invitations', propertyId),
    teamGet<{ customRoles: CustomPropertyRole[] }>('/property-team-custom-roles', propertyId),
  ]);

  return {
    members: membersPayload.members ?? [],
    invitations: invitationsPayload.invitations ?? [],
    customRoles: customRolesPayload.customRoles ?? [],
    teamInviteCapacity: membersPayload.teamInviteCapacity ?? null,
  };
}

export function usePropertyTeam() {
  const propertyId = usePropertyIdParam();

  return useQuery({
    queryKey: [...PROPERTY_TEAM_QUERY_KEY, propertyId],
    queryFn: () => {
      if (!propertyId) throw new Error('Property not found');
      return loadPropertyTeam(propertyId);
    },
    enabled: Boolean(propertyId),
    // Membership/roles change infrequently; mutations already invalidate this exact key.
    staleTime: 60_000,
  });
}

export function usePropertyTeamMutations() {
  const propertyId = usePropertyIdParam();
  const queryClient = useQueryClient();

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: [...PROPERTY_TEAM_QUERY_KEY, propertyId],
    });
  };

  const requirePropertyId = () => {
    if (!propertyId) throw new Error('Property not found');
    return propertyId;
  };

  const inviteMember = useMutation({
    mutationFn: async (input: {
      email: string;
      contactPhone: string;
      roleId: PropertyRoleId;
      permissions?: string[];
    }) => {
      const pid = requirePropertyId();
      const body: Record<string, unknown> = {
        email: input.email.trim(),
        contactPhone: input.contactPhone.trim(),
        roleId: input.roleId,
      };
      if (input.permissions) body.permissions = input.permissions;
      return teamMutate<{ invitation: TeamInvitation }>(
        '/property-team-invitations',
        pid,
        'POST',
        body
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
      const pid = requirePropertyId();
      return teamMutate<{ invitation: TeamInvitation }>('/property-team-invitations', pid, 'POST', {
        action: 'resend',
        invitationId,
      });
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
      const pid = requirePropertyId();
      return teamMutate<{ cancelled: boolean }>('/property-team-invitations', pid, 'DELETE', {
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
      roleId?: PropertyRoleId;
      permissions?: string[];
      status?: 'active' | 'inactive';
      displayName?: string;
      contactPhone?: string;
    }) => {
      const pid = requirePropertyId();
      const body: Record<string, unknown> = { memberId: input.memberId };
      if (input.roleId !== undefined) body.roleId = input.roleId;
      if (input.permissions !== undefined) body.permissions = input.permissions;
      if (input.status !== undefined) body.status = input.status;
      if (input.displayName !== undefined) body.displayName = input.displayName;
      if (input.contactPhone !== undefined) body.contactPhone = input.contactPhone;
      return teamMutate<{ member: TeamMember }>('/property-team-members', pid, 'PATCH', body);
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
      const pid = requirePropertyId();
      return teamMutate<{ removed: boolean }>('/property-team-members', pid, 'DELETE', {
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
    mutationFn: async (input: { name: string; permissions: string[] }) => {
      const pid = requirePropertyId();
      return teamMutate<{ customRole: CustomPropertyRole }>(
        '/property-team-custom-roles',
        pid,
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
    mutationFn: async (input: { roleId: string; name?: string; permissions?: string[] }) => {
      const pid = requirePropertyId();
      return teamMutate<{ customRole: CustomPropertyRole }>(
        '/property-team-custom-roles',
        pid,
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
      const pid = requirePropertyId();
      return teamMutate<{ deleted: boolean }>('/property-team-custom-roles', pid, 'DELETE', {
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
