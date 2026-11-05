import { Mail, Shield, Users } from 'lucide-react';

import { AdminMetricCard } from '@/features/dashboard/bookings/components/AdminMetricCard';
import {
  listSeededOrgRoleFilters,
  resolveOrgMemberTemplateRoleId,
} from '@/features/dashboard/team/lib/orgMemberRoleDisplay';
import type {
  CustomOrgRole,
  OrgTeamInvitation,
  OrgTeamMember,
} from '@/features/dashboard/team/types/orgTeam';

import { InfoHint } from '@/components/help/InfoHint';
import { cn } from '@/lib/utils';

type Props = {
  members: OrgTeamMember[];
  invitations: OrgTeamInvitation[];
  customRoles: CustomOrgRole[];
};

function countByTemplateRole(
  roleId: string,
  members: OrgTeamMember[],
  invitations: OrgTeamInvitation[],
  customRoles: CustomOrgRole[]
): number {
  const memberCount = members.filter(
    (member) => resolveOrgMemberTemplateRoleId(member, customRoles) === roleId
  ).length;
  const inviteCount = invitations.filter(
    (invitation) => resolveOrgMemberTemplateRoleId(invitation, customRoles) === roleId
  ).length;
  return memberCount + inviteCount;
}

export function OrgTeamStatsCards({ members, invitations, customRoles }: Props) {
  const seededRoles = listSeededOrgRoleFilters(customRoles);
  const pendingInvites = invitations.length;

  const metricCards = [
    {
      title: 'Total Members',
      value: String(members.length),
      icon: Users,
    },
    ...seededRoles.map((role) => ({
      title: role.name,
      value: String(countByTemplateRole(role.id, members, invitations, customRoles)),
      icon: Shield,
      hint: `Members and pending invites with the ${role.name} role.`,
    })),
    {
      title: 'Pending Invites',
      value: String(pendingInvites),
      icon: Mail,
      valueClassName: pendingInvites > 0 ? 'text-amber-600 dark:text-amber-400' : undefined,
    },
  ];

  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-2.5 sm:gap-3 lg:gap-4',
        metricCards.length <= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-5'
      )}
    >
      {metricCards.map((card) => (
        <AdminMetricCard
          key={card.title}
          title={card.title}
          value={card.value}
          icon={card.icon}
          valueClassName={'valueClassName' in card ? card.valueClassName : undefined}
          titleAdornment={
            'hint' in card && card.hint ? (
              <InfoHint label={card.title} text={card.hint} variant="metric" />
            ) : undefined
          }
        />
      ))}
    </div>
  );
}
