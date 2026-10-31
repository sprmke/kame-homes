import { OrgRoleDot } from '@/features/dashboard/team/components/OrgRoleBadge';
import { ORG_ROLES } from '@/features/dashboard/team/lib/orgTeamConstants';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function BuiltinRoleRow({
  label,
  description,
  roleId,
}: {
  label: string;
  description: string;
  roleId: string;
}) {
  return (
    <div className="flex items-start gap-2.5 py-1 sm:items-center">
      <span className="mt-1.5 shrink-0 sm:mt-0">
        <OrgRoleDot roleId={roleId} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
          <p className="shrink-0 text-sm font-medium">{label}</p>
          <p className="text-muted-foreground text-xs leading-snug sm:truncate sm:text-sm">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}

export function OrgRolesSection() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Roles</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-lg border">
          <div className="px-3 pt-2.5 sm:px-4 sm:pt-3">
            <p className="text-sm font-medium">Standard roles</p>
          </div>
          <div className="px-3 py-2 sm:px-4">
            {ORG_ROLES.map((role) => (
              <BuiltinRoleRow
                key={role.value}
                roleId={role.value}
                label={role.label}
                description={role.description}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
