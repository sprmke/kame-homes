import { useMemo } from 'react';

import { findMatchingTemplate } from '@/features/dashboard/team/lib/permissionTreeState';
import { PROPERTY_ADMIN_ROLE_ID } from '@/features/dashboard/team/lib/propertyTeamConstants';
import { getRolePermissions } from '@/features/dashboard/team/lib/propertyTeamRoles';
import { sortTemplatesForDisplay } from '@/features/dashboard/team/lib/propertyTeamTemplates';
import type {
  CustomPropertyRole,
  PropertyRoleId,
} from '@/features/dashboard/team/types/propertyTeam';

import { FieldLabel } from '@/components/forms/FieldLabel';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const CUSTOM_VALUE = '__custom__';

const BASED_ON_HELP = 'Copies checkboxes from this role. Adjust them below.';

type Props = {
  roleId?: PropertyRoleId;
  permissions: string[];
  templates: CustomPropertyRole[];
  /**
   * When true, only copies permission checkboxes from the chosen role
   * (does not require / report a member role id). Used when creating/editing a role definition.
   */
  permissionsOnly?: boolean;
  onApply: (roleId: PropertyRoleId, permissions: string[]) => void;
  onManageTemplates?: () => void;
  showManageTemplates?: boolean;
  disabled?: boolean;
};

export function ApplyTemplatePicker({
  permissions,
  templates,
  onApply,
  onManageTemplates,
  showManageTemplates = false,
  disabled = false,
}: Props) {
  const sorted = useMemo(() => sortTemplatesForDisplay(templates), [templates]);
  const matched = useMemo(
    () => findMatchingTemplate(permissions, templates),
    [permissions, templates]
  );
  const selectValue = matched?.id ?? CUSTOM_VALUE;

  const applyValue = (value: string) => {
    if (value === CUSTOM_VALUE) {
      onApply(PROPERTY_ADMIN_ROLE_ID, []);
      return;
    }
    onApply(value, getRolePermissions(value, templates));
  };

  return (
    <div className="space-y-2">
      <FieldLabel htmlFor="apply-baseline-role" label="Based on" help={BASED_ON_HELP} />
      <Select
        value={selectValue}
        onValueChange={(value) => {
          if (value === '__manage__') {
            onManageTemplates?.();
            return;
          }
          if (value === selectValue) return;
          applyValue(value);
        }}
        disabled={disabled || sorted.length === 0}
      >
        <SelectTrigger id="apply-baseline-role" className="h-11">
          <SelectValue placeholder="Choose a role">{matched?.name ?? 'Custom'}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {sorted.map((template) => (
            <SelectItem key={template.id} value={template.id}>
              {template.name}
            </SelectItem>
          ))}
          <SelectItem value={CUSTOM_VALUE}>Custom</SelectItem>
          {showManageTemplates && onManageTemplates ? (
            <SelectItem value="__manage__">Manage roles…</SelectItem>
          ) : null}
        </SelectContent>
      </Select>
    </div>
  );
}
