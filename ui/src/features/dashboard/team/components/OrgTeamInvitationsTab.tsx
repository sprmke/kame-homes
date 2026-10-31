import { Mail, UserPlus, X } from 'lucide-react';

import { TeamInviteTierBadgeAnchor } from '@/features/dashboard/plans/components/TierBadge';
import { OrgRoleBadge } from '@/features/dashboard/team/components/OrgRoleBadge';
import { formatTeamInvitationDate } from '@/features/dashboard/team/lib/formatTeamInvitationDate';
import type { CustomOrgRole, OrgTeamInvitation } from '@/features/dashboard/team/types/orgTeam';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Props = {
  invitations: OrgTeamInvitation[];
  customRoles: CustomOrgRole[];
  onCancel: (invitationId: string) => void;
  onResend: (invitationId: string) => void;
  onInvite: () => void;
  resendPending?: boolean;
  cancelPending?: boolean;
  canInvite?: boolean;
  /** From `teamInviteCapacity.canInvite` — drives the corner plan pill. */
  canInviteByPlan?: boolean;
  canManage?: boolean;
};

export function OrgTeamInvitationsTab({
  invitations,
  customRoles,
  onCancel,
  onResend,
  onInvite,
  resendPending = false,
  cancelPending = false,
  canInvite = true,
  canInviteByPlan,
  canManage = false,
}: Props) {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>Pending Invitations</CardTitle>
      </CardHeader>
      <CardContent>
        {invitations.length > 0 ? (
          <div className="space-y-3 sm:space-y-4">
            {invitations.map((invitation) => (
              <div
                key={invitation.id}
                className="flex flex-col gap-4 rounded-lg border border-dashed p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4"
              >
                <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                  <div className="bg-muted flex size-11 shrink-0 items-center justify-center rounded-full sm:size-12">
                    <Mail className="text-muted-foreground size-5" aria-hidden />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <p className="truncate font-medium">{invitation.email}</p>
                    <p className="text-muted-foreground text-sm">
                      Sent by {invitation.sentBy} on {formatTeamInvitationDate(invitation.sentAt)}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Expires: {formatTeamInvitationDate(invitation.expiresAt)}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <OrgRoleBadge
                    roleId={invitation.role}
                    customRoles={customRoles}
                    permissions={invitation.permissions}
                  />
                  {canManage ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="min-h-[44px]"
                        onClick={() => onResend(invitation.id)}
                        disabled={resendPending}
                      >
                        Resend
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive min-h-[44px]"
                        onClick={() => onCancel(invitation.id)}
                        disabled={cancelPending}
                        aria-label={`Cancel invitation for ${invitation.email}`}
                      >
                        <X className="size-4" aria-hidden />
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-10 text-center sm:py-12">
            <UserPlus className="text-muted-foreground mx-auto size-11" aria-hidden />
            <h3 className="text-card-title mt-4">No pending invitations</h3>
            {canInvite ? (
              <TeamInviteTierBadgeAnchor canInvite={canInviteByPlan} className="mt-4">
                <Button className="min-h-[44px]" onClick={onInvite}>
                  <UserPlus className="mr-2 size-4" aria-hidden />
                  Invite Member
                </Button>
              </TeamInviteTierBadgeAnchor>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
