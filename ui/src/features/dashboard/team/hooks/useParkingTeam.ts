import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useParkingIdParam } from '@/features/dashboard/org/lib/adminParkingScope';
import { teamGetParking, teamMutateParking } from '@/features/dashboard/team/lib/teamApi';
import { teamRoleToastMessage } from '@/features/dashboard/team/lib/teamRoleToast';
import type {
  CustomPropertyRole,
  PropertyRoleId,
  TeamInvitation,
  TeamMember,
} from '@/features/dashboard/team/types/propertyTeam';

import { friendlyToastError } from '@/lib/feedback/toastMessages';

export const PARKING_TEAM_QUERY_KEY = ['parking-team'] as const;

export type ParkingTeamData = {
  members: TeamMember[];
  invitations: TeamInvitation[];
  customRoles: CustomPropertyRole[];
};

export async function loadParkingTeam(parkingId: string): Promise<ParkingTeamData> {
  const [membersPayload, invitationsPayload, customRolesPayload] = await Promise.all([
    teamGetParking<{ members: TeamMember[] }>('/parking-team-members', parkingId),
    teamGetParking<{ invitations: TeamInvitation[] }>('/parking-team-invitations', parkingId),
    teamGetParking<{ customRoles: CustomPropertyRole[] }>('/parking-team-custom-roles', parkingId),
  ]);

  return {
    members: membersPayload.members ?? [],
    invitations: invitationsPayload.invitations ?? [],
    customRoles: customRolesPayload.customRoles ?? [],
  };
}

export function useParkingTeam() {
  const parkingId = useParkingIdParam();

  return useQuery({
    queryKey: [...PARKING_TEAM_QUERY_KEY, parkingId],
    queryFn: () => {
      if (!parkingId) throw new Error('Parking not found');
      return loadParkingTeam(parkingId);
    },
    enabled: Boolean(parkingId),
  });
}

export function useParkingTeamMutations() {
  const parkingId = useParkingIdParam();
  const queryClient = useQueryClient();

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: [...PARKING_TEAM_QUERY_KEY, parkingId],
    });
  };

  const requireParkingId = () => {
    if (!parkingId) throw new Error('Parking not found');
    return parkingId;
  };

  const inviteMember = useMutation({
    mutationFn: async (input: {
      email: string;
      contactPhone: string;
      roleId: PropertyRoleId;
      permissions?: string[];
    }) => {
      const pid = requireParkingId();
      const body: Record<string, unknown> = {
        email: input.email.trim(),
        contactPhone: input.contactPhone.trim(),
        roleId: input.roleId,
      };
      if (input.permissions) body.permissions = input.permissions;
      return teamMutateParking<{ invitation: TeamInvitation }>(
        '/parking-team-invitations',
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
      toast.error(friendlyToastError(error, 'Failed to send invitation'));
    },
  });

  const resendInvitation = useMutation({
    mutationFn: async (invitationId: string) => {
      const pid = requireParkingId();
      return teamMutateParking<{ invitation: TeamInvitation }>(
        '/parking-team-invitations',
        pid,
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
      const pid = requireParkingId();
      return teamMutateParking<{ cancelled: boolean }>('/parking-team-invitations', pid, 'DELETE', {
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
      const pid = requireParkingId();
      const body: Record<string, unknown> = { memberId: input.memberId };
      if (input.roleId !== undefined) body.roleId = input.roleId;
      if (input.permissions !== undefined) body.permissions = input.permissions;
      if (input.status !== undefined) body.status = input.status;
      if (input.displayName !== undefined) body.displayName = input.displayName;
      if (input.contactPhone !== undefined) body.contactPhone = input.contactPhone;
      return teamMutateParking<{ member: TeamMember }>('/parking-team-members', pid, 'PATCH', body);
    },
    onSuccess: () => {
      invalidate();
    },
    onError: (error: Error) => {
      toast.error(friendlyToastError(error, 'Failed to update member'));
    },
  });

  const removeMember = useMutation({
    mutationFn: async (memberId: string) => {
      const pid = requireParkingId();
      return teamMutateParking<{ removed: boolean }>('/parking-team-members', pid, 'DELETE', {
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
      const pid = requireParkingId();
      return teamMutateParking<{ customRole: CustomPropertyRole }>(
        '/parking-team-custom-roles',
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
      const pid = requireParkingId();
      return teamMutateParking<{ customRole: CustomPropertyRole }>(
        '/parking-team-custom-roles',
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
      const pid = requireParkingId();
      return teamMutateParking<{ deleted: boolean }>('/parking-team-custom-roles', pid, 'DELETE', {
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
