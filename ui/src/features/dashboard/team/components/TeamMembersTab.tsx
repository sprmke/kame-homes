import { useMemo } from 'react';

import { useNavigate } from 'react-router-dom';

import {
  Building2,
  ChevronDown,
  Filter,
  MoreHorizontal,
  Search,
  Sparkles,
  Users,
} from 'lucide-react';

import { useAdminSession } from '@/features/dashboard/bookings/hooks/useAdminSession';
import { useOptionalOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { useOptionalParkingContext } from '@/features/dashboard/org/components/RequireParkingContext';
import { orgTeamPath } from '@/features/dashboard/org/lib/tenantPaths';
import { PlanGatedText } from '@/features/dashboard/plans/components/PlanUpgradeLink';
import { TeamInviteTierBadgeAnchor } from '@/features/dashboard/plans/components/TierBadge';
import {
  OrgManagedMemberLink,
  useCanOpenOrgTeam,
} from '@/features/dashboard/team/components/OrgManagedMemberLink';
import { RoleBadge } from '@/features/dashboard/team/components/RoleBadge';
import { TeamMemberStatusBadge } from '@/features/dashboard/team/components/TeamMemberStatusBadge';
import { planLimitedTeamBannerMessage } from '@/features/dashboard/team/lib/planLimitedTeamCopy';
import {
  currentTeamMemberRowClassName,
  isCurrentTeamMember,
  sortTeamMembersWithCurrentUserFirst,
} from '@/features/dashboard/team/lib/sortTeamMembersByCurrentUser';
import { isTeamMemberActive } from '@/features/dashboard/team/lib/teamMemberAccess';
import {
  canEditPropertyMemberContact,
  memberContactLabel,
} from '@/features/dashboard/team/lib/teamMemberContact';
import { getTeamScopeConfig, type TeamScope } from '@/features/dashboard/team/lib/teamScopeConfig';
import type { CustomPropertyRole, TeamMember } from '@/features/dashboard/team/types/propertyTeam';

import { ResponsiveOverflowMenu } from '@/components/mobile/ResponsiveOverflowMenu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
  scope?: TeamScope;
  members: TeamMember[];
  customRoles: CustomPropertyRole[];
  searchQuery: string;
  filterRole: string;
  onSearchChange: (value: string) => void;
  onFilterRoleChange: (value: string) => void;
  onEditContact: (member: TeamMember) => void;
  onToggleStatus: (member: TeamMember) => void;
  onRemove: (member: TeamMember) => void;
  onInvite: () => void;
  canInvite?: boolean;
  /** From `teamInviteCapacity.canInvite` — drives the corner plan pill. */
  canInviteByPlan?: boolean;
  /** Legacy umbrella (parking). Prefer canEditMembers / canDeleteMembers on property. */
  canManage?: boolean;
  canEditMembers?: boolean;
  canDeleteMembers?: boolean;
  /** Built-in roles for filter (defaults to property roles). */
  builtinRoles?: Array<{ value: string; label: string }>;
  removeFromLabel?: string;
};

function memberInitials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function TeamMembersTab({
  scope = 'property',
  members,
  customRoles,
  searchQuery,
  filterRole,
  onSearchChange,
  onFilterRoleChange,
  onEditContact,
  onToggleStatus,
  onRemove,
  onInvite,
  canInvite = true,
  canInviteByPlan,
  canManage = true,
  canEditMembers,
  canDeleteMembers,
  removeFromLabel = getTeamScopeConfig(scope).removeFromLabel,
  builtinRoles = getTeamScopeConfig(scope).builtinRoles,
}: Props) {
  const allowEditMembers = canEditMembers ?? canManage;
  const allowDeleteMembers = canDeleteMembers ?? canManage;
  const orgContext = useOptionalOrgContext();
  const parkingContext = useOptionalParkingContext();
  const orgSlug = orgContext?.orgSlug ?? parkingContext?.orgSlug ?? null;
  if (!orgSlug) {
    throw new Error(
      'TeamMembersTab must be used within RequireOrgContext or RequireParkingContext'
    );
  }
  const { email: currentUserEmail } = useAdminSession();
  const canOpenOrgTeam = useCanOpenOrgTeam();
  const navigate = useNavigate();

  const planLimitedCount = useMemo(
    () => members.filter((member) => member.status === 'inactive' && member.planLimited).length,
    [members]
  );

  const filteredMembers = useMemo(() => {
    const filtered = members.filter((member) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        member.name.toLowerCase().includes(q) || member.email.toLowerCase().includes(q);
      const matchesRole = filterRole === 'all' || member.role === filterRole;
      return matchesSearch && matchesRole;
    });
    return sortTeamMembersWithCurrentUserFirst(filtered, currentUserEmail);
  }, [members, searchQuery, filterRole, currentUserEmail]);

  return (
    <div className="space-y-3 sm:space-y-4">
      {planLimitedCount > 0 ? (
        <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 sm:p-4">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
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
                  className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
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
                  {builtinRoles.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                  {customRoles.map((role) => (
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
            const isActive = isTeamMemberActive(member);
            const isCurrentUser = isCurrentTeamMember(member.email, currentUserEmail);
            const canEditContact = canEditPropertyMemberContact(member, allowEditMembers);
            const contactLine = memberContactLabel(member);

            return (
              <div
                key={member.id}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg border border-border/60 px-2.5 py-2 sm:gap-3 sm:p-3',
                  isCurrentUser && currentTeamMemberRowClassName,
                  !isActive && 'opacity-80'
                )}
                aria-current={isCurrentUser ? 'true' : undefined}
              >
                <Avatar className={cn('size-8 shrink-0 sm:size-9', !isActive && 'grayscale')}>
                  <AvatarImage src={member.avatar ?? undefined} />
                  <AvatarFallback className="bg-primary/10 text-[10px] text-primary sm:text-xs">
                    {memberInitials(member.name)}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold leading-tight text-foreground sm:text-sm">
                    {member.name}
                  </p>
                  <p className="truncate text-[11px] leading-tight text-muted-foreground sm:text-xs">
                    {member.email}
                  </p>
                  {contactLine ? (
                    <p className="truncate text-[11px] tabular-nums leading-tight text-muted-foreground sm:text-xs">
                      {contactLine}
                    </p>
                  ) : null}
                  <div
                    className={cn(
                      'mt-1 flex flex-wrap items-center gap-1',
                      !isActive && 'opacity-50'
                    )}
                    title={!isActive ? 'Role applies when member is active' : undefined}
                  >
                    <RoleBadge
                      scope={scope}
                      roleId={member.role}
                      customRoles={customRoles}
                      muted={!isActive || member.planLimited}
                    />
                    <TeamMemberStatusBadge
                      status={member.status}
                      planLimited={member.planLimited}
                    />
                  </div>
                </div>

                <div className="flex shrink-0 items-center justify-end">
                  {member.fromOrg ? (
                    canOpenOrgTeam ? (
                      <>
                        <div className="lg:hidden">
                          <ResponsiveOverflowMenu
                            label={`Manage ${member.name}`}
                            actionGroups={[
                              [
                                {
                                  key: 'org-team',
                                  label: 'Manage in org',
                                  icon: <Building2 className="size-4 shrink-0" aria-hidden />,
                                  onSelect: () => navigate(orgTeamPath(orgSlug)),
                                },
                              ],
                            ]}
                          />
                        </div>
                        <div className="hidden lg:block">
                          <OrgManagedMemberLink orgSlug={orgSlug} />
                        </div>
                      </>
                    ) : null
                  ) : canEditContact || allowEditMembers || allowDeleteMembers ? (
                    <ResponsiveOverflowMenu
                      label={`Manage ${member.name}`}
                      sheetTitle={`Manage ${member.name}`}
                      actionGroups={[
                        [
                          ...(canEditContact
                            ? [
                                {
                                  key: 'host-details',
                                  label: 'Host details',
                                  onSelect: () => {
                                    window.setTimeout(() => onEditContact(member), 0);
                                  },
                                },
                              ]
                            : []),
                          ...(allowEditMembers
                            ? [
                                {
                                  key: 'toggle-status',
                                  label: isActive ? 'Deactivate' : 'Activate',
                                  onSelect: () => onToggleStatus(member),
                                },
                              ]
                            : []),
                        ],
                        ...(allowDeleteMembers
                          ? [
                              [
                                {
                                  key: 'remove',
                                  label: removeFromLabel,
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
                            'lg:h-8 lg:w-auto lg:gap-1.5 lg:rounded-lg lg:border lg:border-input lg:bg-card lg:px-3 lg:text-foreground lg:hover:bg-accent'
                          )}
                        >
                          <MoreHorizontal className="size-3.5 lg:hidden" aria-hidden />
                          <span className="hidden text-xs font-semibold lg:inline">Manage</span>
                          <ChevronDown className="hidden size-3.5 lg:inline" aria-hidden />
                        </Button>
                      }
                    />
                  ) : null}
                </div>
              </div>
            );
          })}

          {filteredMembers.length === 0 ? (
            <div className="py-10 text-center sm:py-12">
              <Users className="mx-auto size-11 text-muted-foreground" aria-hidden />
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
