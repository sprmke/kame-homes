import type { PropertyRoleId } from '@/features/dashboard/team/types/propertyTeam';

/** Sentinel value for the “Add Custom Role” dropdown action — never stored as roleId. */
export const ADD_CUSTOM_ROLE_VALUE = '__add_custom_role__';

export function handleRoleSelectChange(
  value: string,
  onRoleChange: (roleId: PropertyRoleId) => void,
  onAddCustomRole?: () => void
): void {
  if (value === ADD_CUSTOM_ROLE_VALUE) {
    onAddCustomRole?.();
    return;
  }
  onRoleChange(value as PropertyRoleId);
}
