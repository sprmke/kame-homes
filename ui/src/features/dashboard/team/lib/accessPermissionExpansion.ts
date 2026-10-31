/**
 * Client mirror of supabase/functions/_shared/accessPermissionExpansion.ts
 */

export const NOTIFICATION_MODULE_EDIT_IDS = [
  'notifications.chat:edit',
  'notifications.marketing:edit',
  'notifications.staff:edit',
  'notifications.operations:edit',
  'notifications.finance:edit',
  'notifications.maintenance:edit',
] as const;

export const INBOX_PHASE6_MANAGE_LEAF_IDS = [
  'inbox.channels:add',
  'inbox.channels:delete',
  'inbox.quickReplies:add',
  'inbox.quickReplies:edit',
  'inbox.quickReplies:delete',
  'inbox.automation:edit',
] as const;

export const TEAM_PHASE6_MANAGE_LEAF_IDS = [
  'team.members:edit',
  'team.members:delete',
  'team.customRoles:add',
  'team.customRoles:edit',
  'team.customRoles:delete',
] as const;

export const TEAM_PHASE6_INVITE_LEAF_IDS = [
  'team.invitations:add',
  'team.invitations:edit',
  'team.invitations:delete',
] as const;

export const ACCESS_PHASE6_EXPANSION: Record<string, readonly string[]> = {
  'notifications:edit': [...NOTIFICATION_MODULE_EDIT_IDS],
  'inbox:reply': ['inbox.messages:edit'],
  'inbox:manage': [...INBOX_PHASE6_MANAGE_LEAF_IDS],
  'team:invite': [...TEAM_PHASE6_INVITE_LEAF_IDS],
  'team:manage': [...TEAM_PHASE6_MANAGE_LEAF_IDS],
};

export function expandAccessPhase6PermissionIds(ids: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of ids) {
    const id = raw.trim();
    if (!id) continue;
    const expansion = ACCESS_PHASE6_EXPANSION[id];
    const next = expansion ?? [id];
    for (const leaf of next) {
      if (seen.has(leaf)) continue;
      seen.add(leaf);
      out.push(leaf);
    }
  }
  return out;
}
