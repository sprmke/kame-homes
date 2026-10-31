import type { InboxTemplate, SocialPlatform } from '@/features/dashboard/inbox/types/inbox';

/** Live inbox channels — Chat first, then Meta. */
export const INBOX_CHANNEL_ORDER = ['web', 'facebook', 'instagram'] as const;

/** Tabs in the quick replies management modal */
export type QuickReplyGroupTab = 'all' | (typeof INBOX_CHANNEL_ORDER)[number];

/** Assignable group when creating or editing a reply */
export type QuickReplyGroup = 'all' | (typeof INBOX_CHANNEL_ORDER)[number];

export const QUICK_REPLY_GROUP_TABS: QuickReplyGroupTab[] = ['all', ...INBOX_CHANNEL_ORDER];

export const QUICK_REPLY_ASSIGN_GROUPS: QuickReplyGroup[] = ['all', ...INBOX_CHANNEL_ORDER];

export function quickReplyGroupLabel(group: QuickReplyGroup | QuickReplyGroupTab): string {
  if (group === 'all') return 'All';
  if (group === 'facebook') return 'Facebook';
  if (group === 'instagram') return 'Instagram';
  return 'Chat';
}

export function platformFromQuickReplyGroup(group: QuickReplyGroup): SocialPlatform | null {
  return group === 'all' ? null : group;
}

export function quickReplyGroupFromPlatform(platform: SocialPlatform | null): QuickReplyGroup {
  if (platform === 'facebook' || platform === 'instagram' || platform === 'web') return platform;
  return 'all';
}

export function defaultQuickReplyGroupForTab(tab: QuickReplyGroupTab): QuickReplyGroup {
  return tab === 'all' ? 'all' : tab;
}

/** Management modal: All tab shows every reply; platform tabs include global + scoped */
export function templateMatchesQuickReplyTab(
  template: InboxTemplate,
  tab: QuickReplyGroupTab
): boolean {
  if (tab === 'all') return true;
  return template.platform === null || template.platform === tab;
}

/** Composer: global replies plus replies scoped to the active conversation platform */
export function templatesForConversationPlatform(
  templates: InboxTemplate[],
  platform: SocialPlatform
): InboxTemplate[] {
  return templates.filter((t) => t.platform === null || t.platform === platform);
}
