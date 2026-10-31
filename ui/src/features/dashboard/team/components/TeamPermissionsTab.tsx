import { Fragment } from 'react';

import { Check, X } from 'lucide-react';

import { CustomRolesSection } from '@/features/dashboard/team/components/CustomRolesSection';
import { RoleDot } from '@/features/dashboard/team/components/RoleBadge';
import { buildRoleMatrixColumnsForScope } from '@/features/dashboard/team/lib/teamRoleHelpers';
import { getTeamScopeConfig, type TeamScope } from '@/features/dashboard/team/lib/teamScopeConfig';
import type { CustomPropertyRole } from '@/features/dashboard/team/types/propertyTeam';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Props = {
  scope?: TeamScope;
  customRoles: CustomPropertyRole[];
  memberCountByRole: (roleId: string) => number;
  onCreateCustomRole: () => void;
  onEditCustomRole: (role: CustomPropertyRole) => void;
  onDeleteCustomRole: (role: CustomPropertyRole) => void;
  onDuplicateCustomRole?: (role: CustomPropertyRole) => void;
  canManage?: boolean;
};

export function TeamPermissionsTab({
  scope = 'property',
  customRoles,
  memberCountByRole,
  onCreateCustomRole,
  onEditCustomRole,
  onDeleteCustomRole,
  onDuplicateCustomRole,
  canManage = true,
}: Props) {
  const config = getTeamScopeConfig(scope);
  const columns = buildRoleMatrixColumnsForScope(scope, customRoles);
  const matrixTitle = 'Role permissions';

  return (
    <div className="space-y-3 sm:space-y-4">
      <CustomRolesSection
        scope={scope}
        customRoles={customRoles}
        memberCountByRole={memberCountByRole}
        onCreate={onCreateCustomRole}
        onEdit={onEditCustomRole}
        onDelete={onDeleteCustomRole}
        onDuplicate={onDuplicateCustomRole}
        canManage={canManage}
      />
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>{matrixTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-xl">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b">
                  <th className="px-3 py-3 text-left text-sm font-medium sm:px-4">Permission</th>
                  {columns.map((role) => (
                    <th key={role.id} className="px-3 py-3 text-center sm:px-4">
                      <div className="flex flex-col items-center gap-1">
                        <RoleDot scope={scope} roleId={role.id} customRoles={customRoles} />
                        <span className="max-w-[5.5rem] truncate text-xs font-medium sm:max-w-none sm:text-sm">
                          {role.label}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {config.categories.map((category) => (
                  <Fragment key={category}>
                    <tr className="bg-muted/50">
                      <td
                        colSpan={columns.length + 1}
                        className="px-3 py-2 text-sm font-medium sm:px-4"
                      >
                        {category}
                      </td>
                    </tr>
                    {config.permissions
                      .filter((permission) => permission.category === category)
                      .map((permission) => {
                        const Icon = permission.icon;
                        return (
                          <tr key={permission.id} className="hover:bg-muted/30 border-b">
                            <td className="px-3 py-2 sm:px-4">
                              <div className="flex items-start gap-2">
                                <Icon
                                  className="text-muted-foreground mt-0.5 size-4 shrink-0"
                                  aria-hidden
                                />
                                <div className="min-w-0">
                                  <p className="text-sm">{permission.name}</p>
                                  <p className="text-muted-foreground text-xs">
                                    {permission.description}
                                  </p>
                                </div>
                              </div>
                            </td>
                            {columns.map((role) => (
                              <td key={role.id} className="px-3 py-2 text-center sm:px-4">
                                {role.permissions.includes(permission.id) ? (
                                  <Check
                                    className="mx-auto size-5 text-green-500"
                                    aria-label="Allowed"
                                  />
                                ) : (
                                  <X
                                    className="text-muted-foreground/30 mx-auto size-5"
                                    aria-label="Not allowed"
                                  />
                                )}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
