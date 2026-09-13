import { useMemo } from 'react';

import { ChevronDown, MoreHorizontal, Filter, Search, Sparkles, Users } from 'lucide-react';

import { useAdminSession } from '@/features/dashboard/bookings/hooks/useAdminSession';
import { PlanGatedText } from '@/features/dashboard/plans/components/PlanUpgradeLink';
import { TeamInviteTierBadgeAnchor } from '@/features/dashboard/plans/components/TierBadge';
import { OrgRoleBadge } from '@/features/dashboard/team/components/OrgRoleBadge';
import { TeamMemberStatusBadge } from '@/features/dashboard/team/components/TeamMemberStatusBadge';
import {
  listSeededOrgRoleFilters,
  resolveOrgMemberTemplateRoleId,
} from '@/features/dashboard/team/lib/orgMemberRoleDisplay';
import { planLimitedTeamBannerMessage } from '@/features/dashboard/team/lib/planLimitedTeamCopy';
import {
  currentTeamMemberRowClassName,
  isCurrentTeamMember,
  sortTeamMembersWithCurrentUserFirst,
} from '@/features/dashboard/team/lib/sortTeamMembersByCurrentUser';
import {
  canEditOrgMemberContact,
  memberContactLabel,
} from '@/features/dashboard/team/lib/teamMemberContact';
import type { CustomOrgRole, OrgTeamMember } from '@/features/dashboard/team/types/orgTeam';

import { ResponsiveOverflowMenu } from '@/components/mobile/ResponsiveOverflowMenu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

type Props = {
  members: OrgTeamMember[];
  customRoles: CustomOrgRole[];
  searchQuery: string;
  filterRole: string;
  onSearchChange: (value: string) => void;
  onFilterRoleChange: (value: string) => void;
  onToggleStatus: (member: OrgTeamMember) => void;
  onEditContact: (member: OrgTeamMember) => void;
  onRemove: (member: OrgTeamMember) => void;
  onInvite: () => void;
  canInvite?: boolean;
  /** From `teamInviteCapacity.canInvite` — drives the corner plan pill. */
  canInviteByPlan?: boolean;
  canManage?: boolean;
};

function memberInitials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function OrgTeamMembersTab({
  members,
  customRoles,
  searchQuery,
  filterRole,
  onSearchChange,
  onFilterRoleChange,
  onToggleStatus,
  onEditContact,
  onRemove,
  onInvite,
  canInvite = true,
  canInviteByPlan,
  canManage = true,
}: Props) {
  const { email: currentUserEmail } = useAdminSession();

  const planLimitedCount = useMemo(
    () => members.filter((member) => member.status === 'inactive' && member.planLimited).length,
    [members]
  );

  const roleFilterOptions = useMemo(() => listSeededOrgRoleFilters(customRoles), [customRoles]);

  const filteredMembers = useMemo(() => {
    const filtered = members.filter((member) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        member.name.toLowerCase().includes(q) || member.email.toLowerCase().includes(q);
      const matchesRole =
        filterRole === 'all' || resolveOrgMemberTemplateRoleId(member, customRoles) === filterRole;
      return matchesSearch && matchesRole;
    });
    return sortTeamMembersWithCurrentUserFirst(filtered, currentUserEmail);
  }, [members, searchQuery, filterRole, customRoles, currentUserEmail]);

  return (
    <div className="space-y-3 sm:space-y-4">
      {planLimitedCount > 0 ? (
        <div className="border-warning/30 bg-warning/10 flex items-start gap-2 rounded-lg border p-3 sm:p-4">
          <Sparkles className="text-warning mt-0.5 size-4 shrink-0" aria-hidden />
          <p className="text-sm">
            <PlanGatedText
              feature="teamManagement"
              text={planLimitedTeamBannerMessage(planLimitedCount)}
              linkClassName="text-warning"
            />
          </p>
        </div>
      ) : null}

      <Card>
        <CardHeader className="space-y-0 pb-2">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <CardTitle className="shrink-0">Team Members ({filteredMembers.length})</CardTitle>
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
              <div className="relative w-full sm:w-[260px]">
                <Search
                  className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2"
                  aria-hidden
                />
                <Input
                  inputSize="sm"
                  placeholder="Search members..."
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="pl-8 text-[13px]"
                  aria-label="Search team members"
                />
              </div>
              <Select value={filterRole} onValueChange={onFilterRoleChange}>
                <SelectTrigger className="h-8 w-full shrink-0 px-2.5 text-xs sm:w-[136px]">
                  <Filter className="mr-1.5 size-3.5 shrink-0" aria-hidden />
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {roleFilterOptions.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-1.5 sm:space-y-2">
          {filteredMembers.map((member) => {
            const isActive = member.status === 'active';
            const isCurrentUser = isCurrentTeamMember(member.email, currentUserEmail);
            const canEditContact = canEditOrgMemberContact(member, currentUserEmail, canManage);
            const contactLine = memberContactLabel(member);

            return (
              <div
                key={member.id}
                className={cn(
                  'border-border/60 flex items-center gap-2.5 rounded-lg border px-2.5 py-2 sm:gap-3 sm:p-3',
                  isCurrentUser && currentTeamMemberRowClassName,
                  !isActive && 'opacity-80'
                )}
                aria-current={isCurrentUser ? 'true' : undefined}
              >
                <Avatar className={cn('size-8 shrink-0 sm:size-9', !isActive && 'grayscale')}>
                  <AvatarImage src={member.avatar ?? undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary text-[10px] sm:text-xs">
                    {memberInitials(member.name)}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <p className="text-foreground truncate text-[13px] font-semibold leading-tight sm:text-sm">
                    {member.name}
                  </p>
                  <p className="text-muted-foreground truncate text-[11px] leading-tight sm:text-xs">
                    {member.email}
                  </p>
                  {contactLine ? (
                    <p className="text-muted-foreground truncate text-[11px] tabular-nums leading-tight sm:text-xs">
                      {contactLine}
                    </p>
                  ) : null}
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    <OrgRoleBadge
                      roleId={member.role}
                      customRoles={customRoles}
                      isOwner={member.isOwner}
                      permissions={member.permissions}
                      muted={!isActive || member.planLimited}
                    />
                    {!member.isOwner ? (
                      <Badge variant="outline" className="font-normal">
                        {member.listingScopeSummary}
                      </Badge>
                    ) : null}
                    <TeamMemberStatusBadge
                      status={member.status}
                      planLimited={member.planLimited}
                    />
                  </div>
                </div>

                {canEditContact || (!member.isOwner && canManage) ? (
                  <div className="flex shrink-0 items-center justify-end">
                    <ResponsiveOverflowMenu
                      label={`Manage ${member.name}`}
                      sheetTitle={`Manage ${member.name}`}
                      actionGroups={[
                        [
                          ...(canEditContact
                            ? [
                                {
                                  key: 'member-details',
                                  label: 'Member details',
                                  onSelect: () => {
                                    window.setTimeout(() => onEditContact(member), 0);
                                  },
                                },
                              ]
                            : []),
                          ...(!member.isOwner && canManage
                            ? [
                                {
                                  key: 'toggle-status',
                                  label: isActive ? 'Deactivate' : 'Activate',
                                  onSelect: () => onToggleStatus(member),
                                },
                              ]
                            : []),
                        ],
                        ...(!member.isOwner && canManage
                          ? [
                              [
                                {
                                  key: 'remove',
                                  label: 'Remove from Organization',
                                  destructive: true,
                                  onSelect: () => {
                                    window.setTimeout(() => onRemove(member), 0);
                                  },
                                },
                              ],
                            ]
                          : []),
                      ]}
                      trigger={
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className={cn(
                            'admin-overflow-trigger',
                            'lg:border-input lg:bg-card lg:text-foreground lg:hover:bg-accent lg:h-8 lg:w-auto lg:gap-1.5 lg:rounded-lg lg:border lg:px-3'
                          )}
                        >
                          <MoreHorizontal className="size-3.5 lg:hidden" aria-hidden />
                          <span className="hidden text-xs font-semibold lg:inline">Manage</span>
                          <ChevronDown className="hidden size-3.5 lg:inline" aria-hidden />
                        </Button>
                      }
                    />
                  </div>
                ) : null}
              </div>
            );
          })}

          {filteredMembers.length === 0 ? (
            <div className="py-10 text-center sm:py-12">
              <Users className="text-muted-foreground mx-auto size-11" aria-hidden />
              <h3 className="text-card-title mt-4">No members found</h3>
              {!searchQuery && canInvite ? (
                <TeamInviteTierBadgeAnchor canInvite={canInviteByPlan} className="mt-4">
                  <Button className="min-h-[44px]" onClick={onInvite}>
                    Invite Member
                  </Button>
                </TeamInviteTierBadgeAnchor>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
