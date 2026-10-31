export type TeamRoleToastAction = 'created' | 'updated' | 'deleted';

export function teamRoleToastMessage(
  action: TeamRoleToastAction,
  roleName?: string | null
): string {
  const name = roleName?.trim();
  if (name) {
    const verb = action === 'created' ? 'created' : action === 'updated' ? 'updated' : 'deleted';
    return `${name} ${verb}`;
  }
  return action === 'created'
    ? 'Role created'
    : action === 'updated'
      ? 'Role updated'
      : 'Role deleted';
}
