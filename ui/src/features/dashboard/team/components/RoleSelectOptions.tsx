import type { ReactNode } from 'react';

import { Plus } from 'lucide-react';

import { RoleDot } from '@/features/dashboard/team/components/RoleBadge';
import {
  isSeededOrgTemplateName,
  sortOrgTemplatesForDisplay,
} from '@/features/dashboard/team/lib/orgTeamTemplates';
import { PROPERTY_ADMIN_ROLE_ID } from '@/features/dashboard/team/lib/propertyTeamConstants';
import {
  isSeededTemplateName,
  sortTemplatesForDisplay,
} from '@/features/dashboard/team/lib/propertyTeamTemplates';
import { ADD_CUSTOM_ROLE_VALUE } from '@/features/dashboard/team/lib/roleSelectUtils';
import { getTeamScopeConfig, type TeamScope } from '@/features/dashboard/team/lib/teamScopeConfig';
import type {
  CustomPropertyRole,
  PropertyRoleId,
} from '@/features/dashboard/team/types/propertyTeam';

import { SelectGroup, SelectItem, SelectLabel, SelectSeparator } from '@/components/ui/select';

type BuiltinRoleOption = {
  value: string;
  label: string;
};

type Props = {
  scope?: TeamScope;
  customRoles: CustomPropertyRole[];
  builtinRoles?: BuiltinRoleOption[];
  showAddCustomRole?: boolean;
  /** When the member uses `ADMIN` for a non-template permission set, keep it selectable. */
  selectedRoleId?: PropertyRoleId;
};

function partitionTemplateRoles<T extends { id: string; name: string }>(
  roles: T[],
  isSeeded: (name: string) => boolean
): { seeded: T[]; custom: T[] } {
  const seeded: T[] = [];
  const custom: T[] = [];
  for (const role of roles) {
    if (isSeeded(role.name)) {
      seeded.push(role);
    } else {
      custom.push(role);
    }
  }
  return { seeded, custom };
}

function renderRoleItem(
  scope: TeamScope,
  role: CustomPropertyRole,
  customRoles: CustomPropertyRole[]
) {
  return (
    <SelectItem key={role.id} value={role.id}>
      <div className="flex items-center gap-2">
        <RoleDot scope={scope} roleId={role.id} customRoles={customRoles} />
        <span>{role.name}</span>
      </div>
    </SelectItem>
  );
}

export function RoleSelectOptions({
  scope = 'property',
  customRoles,
  builtinRoles,
  showAddCustomRole = false,
  selectedRoleId,
}: Props) {
  const nodes: ReactNode[] = [];

  if (scope === 'property' || scope === 'org') {
    const sorted =
      scope === 'property'
        ? sortTemplatesForDisplay(customRoles)
        : sortOrgTemplatesForDisplay(customRoles);
    const isSeeded = scope === 'property' ? isSeededTemplateName : isSeededOrgTemplateName;
    const { seeded, custom } = partitionTemplateRoles(sorted, isSeeded);

    if (seeded.length > 0) {
      nodes.push(
        <SelectGroup key="seeded-roles">
          <SelectLabel>Roles</SelectLabel>
          {seeded.map((role) => renderRoleItem(scope, role, customRoles))}
        </SelectGroup>
      );
    }

    if (custom.length > 0) {
      nodes.push(<SelectSeparator key="sep-custom-roles" />);
      nodes.push(
        <SelectGroup key="custom-roles">
          <SelectLabel>Custom roles</SelectLabel>
          {custom.map((role) => renderRoleItem(scope, role, customRoles))}
        </SelectGroup>
      );
    }

    const showCustomPermissionsOption =
      scope === 'property' && selectedRoleId === PROPERTY_ADMIN_ROLE_ID;
    if (showCustomPermissionsOption) {
      nodes.push(<SelectSeparator key="sep-custom-perms" />);
      nodes.push(
        <SelectItem key={PROPERTY_ADMIN_ROLE_ID} value={PROPERTY_ADMIN_ROLE_ID}>
          <div className="flex items-center gap-2">
            <RoleDot scope={scope} roleId={PROPERTY_ADMIN_ROLE_ID} customRoles={customRoles} />
            <span>Custom</span>
          </div>
        </SelectItem>
      );
    }
  } else {
    const resolvedBuiltinRoles = builtinRoles ?? getTeamScopeConfig(scope).builtinRoles;
    nodes.push(
      <SelectGroup key="builtin">
        <SelectLabel>Built-in</SelectLabel>
        {resolvedBuiltinRoles.map((role) => (
          <SelectItem key={role.value} value={role.value}>
            <div className="flex items-center gap-2">
              <RoleDot scope={scope} roleId={role.value} />
              <span>{role.label}</span>
            </div>
          </SelectItem>
        ))}
      </SelectGroup>
    );

    if (customRoles.length > 0) {
      nodes.push(<SelectSeparator key="sep-custom" />);
      nodes.push(
        <SelectGroup key="custom">
          <SelectLabel>Custom</SelectLabel>
          {customRoles.map((role) => (
            <SelectItem key={role.id} value={role.id}>
              <div className="flex items-center gap-2">
                <RoleDot scope={scope} roleId={role.id} customRoles={customRoles} />
                <span>{role.name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectGroup>
      );
    }
  }

  if (showAddCustomRole) {
    nodes.push(<SelectSeparator key="sep-add" />);
    nodes.push(
      <SelectItem key="add-custom-role" value={ADD_CUSTOM_ROLE_VALUE}>
        <div className="flex items-center gap-2">
          <Plus className="text-muted-foreground size-4" aria-hidden />
          <span>Add role</span>
        </div>
      </SelectItem>
    );
  }

  return <>{nodes}</>;
}
