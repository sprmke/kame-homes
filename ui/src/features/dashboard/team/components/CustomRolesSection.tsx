import type { ReactNode } from 'react';

import { Copy, Edit3, Plus, Trash2 } from 'lucide-react';

import { TierBadge, TierBadgeAnchor } from '@/features/dashboard/plans/components/TierBadge';
import { orgListingScopeSummary } from '@/features/dashboard/team/lib/orgRoleListingScope';
import {
  isSeededOrgTemplateName,
  sortOrgTemplatesForDisplay,
} from '@/features/dashboard/team/lib/orgTeamTemplates';
import {
  isSeededTemplateName,
  sortTemplatesForDisplay,
} from '@/features/dashboard/team/lib/propertyTeamTemplates';
import { getTeamScopeConfig, type TeamScope } from '@/features/dashboard/team/lib/teamScopeConfig';
import type { CustomOrgRole } from '@/features/dashboard/team/types/orgTeam';
import type { CustomPropertyRole } from '@/features/dashboard/team/types/propertyTeam';

import { ResponsiveOverflowMenu } from '@/components/mobile/ResponsiveOverflowMenu';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type Props = {
  scope?: TeamScope;
  customRoles: CustomPropertyRole[];
  memberCountByRole: (roleId: string) => number;
  onCreate: () => void;
  onEdit: (role: CustomPropertyRole) => void;
  onDelete: (role: CustomPropertyRole) => void;
  onDuplicate?: (role: CustomPropertyRole) => void;
  canManage?: boolean;
};

function RoleGroup({
  title,
  count,
  action,
  children,
  className,
}: {
  title: string;
  count: number;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('space-y-2', className)}>
      <div className="flex min-h-8 items-center justify-between gap-2 px-1 sm:px-2">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {title}
          </h3>
          <span className="text-xs tabular-nums text-muted-foreground/80">{count}</span>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function BuiltinRoleRow({
  label,
  description,
  roleId,
}: {
  label: string;
  description: string;
  roleId: string;
}) {
  void roleId;
  return (
    <div className="flex items-start gap-2.5 py-2 sm:items-center sm:py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
          <p className="shrink-0 text-sm font-medium">{label}</p>
          <p className="text-xs leading-snug text-muted-foreground sm:truncate sm:text-sm">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}

function RoleRow({
  role,
  assignedCount,
  canManage,
  isDefault,
  onEdit,
  onDelete,
  onDuplicate,
  scope = 'property',
}: {
  role: CustomPropertyRole;
  assignedCount: number;
  canManage: boolean;
  isDefault: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate?: () => void;
  scope?: TeamScope;
}) {
  const canDelete = !isDefault && assignedCount === 0;
  const orgRole = scope === 'org' ? (role as CustomOrgRole) : null;
  const listingLine =
    orgRole != null
      ? orgListingScopeSummary(orgRole.allListings ?? false, orgRole.listingAssignments)
      : null;

  return (
    <div className="flex items-center gap-3 rounded-lg px-1 py-2.5 hover:bg-muted/40 sm:px-2">
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <p className="truncate text-sm font-medium">{role.name}</p>
          {assignedCount > 0 ? (
            <Badge variant="secondary" className="h-5 shrink-0 px-1.5 text-[10px]">
              {assignedCount} assigned
            </Badge>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          {role.permissions.length} permission
          {role.permissions.length === 1 ? '' : 's'}
          {listingLine ? ` · ${listingLine}` : null}
        </p>
      </div>
      {canManage ? (
        <div className="flex shrink-0 items-center gap-0.5">
          <ResponsiveOverflowMenu
            label={`Actions for ${role.name}`}
            sheetTitle={role.name}
            actionGroups={[
              [
                {
                  key: 'edit',
                  label: 'Edit',
                  icon: <Edit3 className="size-4 shrink-0" aria-hidden />,
                  onSelect: onEdit,
                },
                ...(onDuplicate
                  ? [
                      {
                        key: 'duplicate',
                        label: 'Duplicate',
                        icon: <Copy className="size-4 shrink-0" aria-hidden />,
                        onSelect: onDuplicate,
                      },
                    ]
                  : []),
              ],
              ...(!isDefault
                ? [
                    [
                      {
                        key: 'delete',
                        label: 'Delete',
                        icon: <Trash2 className="size-4 shrink-0" aria-hidden />,
                        destructive: true,
                        disabled: !canDelete,
                        onSelect: onDelete,
                      },
                    ],
                  ]
                : []),
            ]}
          />
        </div>
      ) : null}
    </div>
  );
}

export function CustomRolesSection({
  scope = 'property',
  customRoles,
  memberCountByRole,
  onCreate,
  onEdit,
  onDelete,
  onDuplicate,
  canManage = true,
}: Props) {
  const config = getTeamScopeConfig(scope);
  const isProperty = scope === 'property';
  const isOrg = scope === 'org';
  const usesTemplates = isProperty || isOrg;

  const defaultRoles = isProperty
    ? sortTemplatesForDisplay(customRoles.filter((role) => isSeededTemplateName(role.name)))
    : isOrg
      ? sortOrgTemplatesForDisplay(customRoles.filter((role) => isSeededOrgTemplateName(role.name)))
      : [];
  const customOnly = isProperty
    ? sortTemplatesForDisplay(customRoles.filter((role) => !isSeededTemplateName(role.name)))
    : isOrg
      ? sortOrgTemplatesForDisplay(
          customRoles.filter((role) => !isSeededOrgTemplateName(role.name))
        )
      : customRoles;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2">
          Roles
          <TierBadge feature="customRoles" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 pt-0">
        {usesTemplates ? (
          <>
            <RoleGroup title="Default" count={defaultRoles.length}>
              <ul className="divide-y divide-border rounded-lg border border-border">
                {defaultRoles.map((role) => (
                  <li key={role.id} className="px-1 sm:px-1.5">
                    <RoleRow
                      role={role}
                      assignedCount={memberCountByRole(role.id)}
                      canManage={canManage}
                      isDefault
                      scope={scope}
                      onEdit={() => onEdit(role)}
                      onDelete={() => onDelete(role)}
                      onDuplicate={onDuplicate ? () => onDuplicate(role) : undefined}
                    />
                  </li>
                ))}
              </ul>
            </RoleGroup>

            <RoleGroup
              title="Custom"
              count={customOnly.length}
              action={
                canManage && customOnly.length > 0 ? (
                  <TierBadgeAnchor feature="customRoles">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="min-h-[44px] shrink-0 text-muted-foreground"
                      onClick={onCreate}
                    >
                      <Plus className="mr-1.5 size-4" aria-hidden />
                      New role
                    </Button>
                  </TierBadgeAnchor>
                ) : undefined
              }
            >
              {customOnly.length === 0 ? (
                <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-border bg-muted/30 px-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-4">
                  <p className="text-sm text-muted-foreground">
                    Duplicate a default role, or create your own.
                  </p>
                  {canManage ? (
                    <TierBadgeAnchor feature="customRoles">
                      <Button
                        variant="outline"
                        size="sm"
                        className="min-h-[44px] shrink-0"
                        onClick={onCreate}
                      >
                        <Plus className="mr-1.5 size-4" aria-hidden />
                        New role
                      </Button>
                    </TierBadgeAnchor>
                  ) : null}
                </div>
              ) : (
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {customOnly.map((role) => (
                    <li key={role.id} className="px-1 sm:px-1.5">
                      <RoleRow
                        role={role}
                        assignedCount={memberCountByRole(role.id)}
                        canManage={canManage}
                        isDefault={false}
                        scope={scope}
                        onEdit={() => onEdit(role)}
                        onDelete={() => onDelete(role)}
                        onDuplicate={onDuplicate ? () => onDuplicate(role) : undefined}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </RoleGroup>
          </>
        ) : (
          <div className="px-1 sm:px-2">
            {config.builtinRoles.map((role) => (
              <BuiltinRoleRow
                key={role.value}
                roleId={role.value}
                label={role.label}
                description={role.description}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
