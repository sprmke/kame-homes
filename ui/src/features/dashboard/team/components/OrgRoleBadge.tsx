import {
  getOrgMemberRoleColor,
  getOrgMemberRoleLabel,
  type RoleSubject,
} from '@/features/dashboard/team/lib/orgMemberRoleDisplay';
import type { CustomOrgRole } from '@/features/dashboard/team/types/orgTeam';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type Props = {
  roleId: string;
  customRoles?: CustomOrgRole[];
  muted?: boolean;
  isOwner?: boolean;
  permissions?: string[];
};

function toSubject(props: Props): RoleSubject {
  return {
    role: props.roleId,
    isOwner: props.isOwner,
    permissions: props.permissions,
  };
}

export function OrgRoleBadge({
  roleId,
  customRoles = [],
  muted = false,
  isOwner,
  permissions,
}: Props) {
  const subject = toSubject({ roleId, customRoles, isOwner, permissions });
  const label = getOrgMemberRoleLabel(subject, customRoles);
  const color = getOrgMemberRoleColor(subject, customRoles);

  return (
    <Badge
      className={cn(
        muted
          ? 'border-border bg-muted text-muted-foreground font-normal'
          : cn('border-transparent text-white', color)
      )}
    >
      {label}
    </Badge>
  );
}

type DotProps = {
  roleId: string;
  customRoles?: CustomOrgRole[];
  isOwner?: boolean;
  permissions?: string[];
  className?: string;
};

export function OrgRoleDot({
  roleId,
  customRoles = [],
  isOwner,
  permissions,
  className,
}: DotProps) {
  const subject = toSubject({ roleId, customRoles, isOwner, permissions });
  const color = getOrgMemberRoleColor(subject, customRoles);
  return <div className={cn('size-2 shrink-0 rounded-full', color, className)} />;
}
