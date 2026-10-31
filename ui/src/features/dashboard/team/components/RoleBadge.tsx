import {
  CUSTOM_ROLE_COLOR,
  getRoleColorForScope,
  getRoleLabelForScope,
  isBuiltinRoleIdForScope,
} from '@/features/dashboard/team/lib/teamRoleHelpers';
import { getTeamScopeConfig, type TeamScope } from '@/features/dashboard/team/lib/teamScopeConfig';
import type {
  CustomPropertyRole,
  PropertyRoleId,
} from '@/features/dashboard/team/types/propertyTeam';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type Props = {
  scope?: TeamScope;
  roleId: PropertyRoleId;
  customRoles: CustomPropertyRole[];
  muted?: boolean;
};

export function RoleBadge({ scope = 'property', roleId, customRoles, muted = false }: Props) {
  const label = getRoleLabelForScope(scope, roleId, customRoles);
  const color = getRoleColorForScope(scope, roleId, customRoles);

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
  scope?: TeamScope;
  roleId: PropertyRoleId;
  customRoles?: CustomPropertyRole[];
  className?: string;
};

export function RoleDot({ scope = 'property', roleId, customRoles = [], className }: DotProps) {
  if (isBuiltinRoleIdForScope(scope, roleId)) {
    const config = getTeamScopeConfig(scope).builtinRoles.find((role) => role.value === roleId);
    if (!config) return null;
    return <div className={cn('size-2 shrink-0 rounded-full', config.color, className)} />;
  }

  void customRoles;
  return <div className={cn('size-2 shrink-0 rounded-full', CUSTOM_ROLE_COLOR, className)} />;
}
