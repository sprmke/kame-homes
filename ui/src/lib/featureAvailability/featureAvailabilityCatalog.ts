/**
 * Hand mirror of `supabase/functions/_shared/featureAvailabilityCatalog.ts`.
 * Keep in sync — enforced by `featureAvailabilityParity.test.ts`.
 */

export const FEATURE_AVAILABILITY_KEYS = [
  'inbox.meta',
  'inbox.meta.connect',
  'inbox.meta.reply',
  'inbox.meta.auto_reply',
  'inbox.meta.sync',
  'pricing.channel_sync',
  'pricing.channel_sync.import',
  'marketing.ai_studio',
  'marketing.ai_studio.generate',
  'analytics.ai_review',
  'analytics.ai_review.regenerate',
  'notifications.telegram',
  'notifications.telegram.settings',
  'notifications.telegram.delivery',
] as const;

export type FeatureAvailabilityKey = (typeof FEATURE_AVAILABILITY_KEYS)[number];

export type FeatureAvailabilityModule =
  'inbox' | 'pricing' | 'marketing' | 'analytics' | 'notifications';

export type FeatureAvailabilitySurface =
  | 'section'
  | 'section (tab)'
  | 'section (composer)'
  | 'modal'
  | 'button'
  | 'button + modal'
  | 'background'
  | 'background + button'
  | 'button + background';

export type FeatureAvailabilityProvider = 'Meta' | 'Airbnb' | 'Google' | 'Telegram';

export interface FeatureAvailabilityCatalogEntry {
  key: FeatureAvailabilityKey;
  parent: FeatureAvailabilityKey | null;
  module: FeatureAvailabilityModule;
  surface: FeatureAvailabilitySurface;
  label: string;
  description: string;
  provider?: FeatureAvailabilityProvider;
}

export const FEATURE_AVAILABILITY_CATALOG: readonly FeatureAvailabilityCatalogEntry[] = [
  {
    key: 'inbox.meta',
    parent: null,
    module: 'inbox',
    surface: 'section',
    label: 'Facebook and Instagram chat',
    description: 'Everything below. FB/IG threads stay readable.',
    provider: 'Meta',
  },
  {
    key: 'inbox.meta.connect',
    parent: 'inbox.meta',
    module: 'inbox',
    surface: 'button + modal',
    label: 'Connect / reconnect Meta',
    description:
      'Connect / Reconnect / Resubscribe / page picker / Disconnect in the Channels modal; meta-inbox-oauth-*, meta-inbox-resubscribe, meta-inbox-disconnect',
    provider: 'Meta',
  },
  {
    key: 'inbox.meta.reply',
    parent: 'inbox.meta',
    module: 'inbox',
    surface: 'section (composer)',
    label: 'Reply on Facebook and Instagram',
    description:
      'Composer on FB/IG threads, edit/unsend, AI suggest on FB/IG threads, assistant propose_send_inbox_reply / draft_inbox_reply on FB/IG',
    provider: 'Meta',
  },
  {
    key: 'inbox.meta.auto_reply',
    parent: 'inbox.meta',
    module: 'inbox',
    surface: 'background',
    label: 'Auto-reply on Facebook and Instagram',
    description: 'AI auto-reply to inbound FB/IG DMs; Automation tab Meta toggles show the notice',
    provider: 'Meta',
  },
  {
    key: 'inbox.meta.sync',
    parent: 'inbox.meta',
    module: 'inbox',
    surface: 'background + button',
    label: 'Sync from Meta',
    description: 'meta-inbox-backfill, "Load older from Meta", initial sync after connect',
    provider: 'Meta',
  },
  {
    key: 'pricing.channel_sync',
    parent: null,
    module: 'pricing',
    surface: 'modal',
    label: 'Channel sync',
    description: 'Everything below. Header button stays, dialog opens to the reason.',
    provider: 'Airbnb',
  },
  {
    key: 'pricing.channel_sync.import',
    parent: 'pricing.channel_sync',
    module: 'pricing',
    surface: 'background + button',
    label: 'Channel sync imports',
    description:
      'calendar-sync-cron global sweep, "Sync now", add/edit/remove feed, assistant propose_run_channel_sync',
    provider: 'Airbnb',
  },
  {
    key: 'marketing.ai_studio',
    parent: null,
    module: 'marketing',
    surface: 'section (tab)',
    label: 'AI studio',
    description: 'AI studio tab content, all AI studio generation and session writes',
  },
  {
    key: 'marketing.ai_studio.generate',
    parent: 'marketing.ai_studio',
    module: 'marketing',
    surface: 'button',
    label: 'AI studio generation',
    description:
      'New creation, refine, references upload. Past sessions and outputs stay viewable.',
  },
  {
    key: 'analytics.ai_review',
    parent: null,
    module: 'analytics',
    surface: 'section (tab)',
    label: 'AI review',
    description: '"AI review" section content and the weekly cron',
  },
  {
    key: 'analytics.ai_review.regenerate',
    parent: 'analytics.ai_review',
    module: 'analytics',
    surface: 'button + background',
    label: 'AI review regenerate',
    description: 'Regenerate button + analytics-ai-review-cron. Last review stays visible.',
  },
  {
    key: 'notifications.telegram',
    parent: null,
    module: 'notifications',
    surface: 'section (tab)',
    label: 'Telegram',
    description: 'Everything below, property and parking',
    provider: 'Telegram',
  },
  {
    key: 'notifications.telegram.settings',
    parent: 'notifications.telegram',
    module: 'notifications',
    surface: 'section',
    label: 'Telegram settings',
    description: 'Telegram setting cards read-only (save, test, discover chats, bot token)',
    provider: 'Telegram',
  },
  {
    key: 'notifications.telegram.delivery',
    parent: 'notifications.telegram',
    module: 'notifications',
    surface: 'background',
    label: 'Telegram delivery',
    description:
      'Every Telegram sendMessage from the app, all channels and crons. Settings stay editable.',
    provider: 'Telegram',
  },
] as const;

const CATALOG_BY_KEY: ReadonlyMap<FeatureAvailabilityKey, FeatureAvailabilityCatalogEntry> =
  new Map(FEATURE_AVAILABILITY_CATALOG.map((entry) => [entry.key, entry]));

export function getFeatureAvailabilityCatalogEntry(
  key: string
): FeatureAvailabilityCatalogEntry | null {
  return CATALOG_BY_KEY.get(key as FeatureAvailabilityKey) ?? null;
}

export function isFeatureAvailabilityKey(key: string): key is FeatureAvailabilityKey {
  return CATALOG_BY_KEY.has(key as FeatureAvailabilityKey);
}

export function getFeatureAvailabilityAncestors(
  key: FeatureAvailabilityKey
): FeatureAvailabilityKey[] {
  const ancestors: FeatureAvailabilityKey[] = [];
  let current = CATALOG_BY_KEY.get(key)?.parent ?? null;
  while (current) {
    ancestors.push(current);
    current = CATALOG_BY_KEY.get(current)?.parent ?? null;
  }
  return ancestors;
}

export function getFeatureAvailabilityChildren(
  key: FeatureAvailabilityKey
): FeatureAvailabilityKey[] {
  return FEATURE_AVAILABILITY_CATALOG.filter((entry) => entry.parent === key).map(
    (entry) => entry.key
  );
}

export const FEATURE_AVAILABILITY_REASONS = [
  'maintenance',
  'provider_issue',
  'coming_soon',
  'under_review',
  'paused',
  'other',
] as const;

export type FeatureAvailabilityReason = (typeof FEATURE_AVAILABILITY_REASONS)[number];

export type FeatureAvailabilityReasonIcon =
  'Wrench' | 'CloudOff' | 'Sparkles' | 'Clock' | 'Pause' | 'Info';

export interface FeatureAvailabilityReasonCopy {
  label: string;
  defaultMessage: string | null;
  icon: FeatureAvailabilityReasonIcon;
  requiresProvider: boolean;
}

export const FEATURE_AVAILABILITY_REASON_COPY: Record<
  FeatureAvailabilityReason,
  FeatureAvailabilityReasonCopy
> = {
  maintenance: {
    label: 'Under maintenance',
    defaultMessage: "We're working on this right now. It'll be back soon.",
    icon: 'Wrench',
    requiresProvider: false,
  },
  provider_issue: {
    label: 'Service issue',
    defaultMessage: "{provider} is having problems. We'll turn this back on when it's fixed.",
    icon: 'CloudOff',
    requiresProvider: true,
  },
  coming_soon: {
    label: 'Coming soon',
    defaultMessage: "This isn't ready yet.",
    icon: 'Sparkles',
    requiresProvider: false,
  },
  under_review: {
    label: 'Waiting on approval',
    defaultMessage: "We're waiting on approval from {provider}.",
    icon: 'Clock',
    requiresProvider: true,
  },
  paused: {
    label: 'Paused',
    defaultMessage: "We've paused this for now.",
    icon: 'Pause',
    requiresProvider: false,
  },
  other: {
    label: 'Unavailable',
    defaultMessage: null,
    icon: 'Info',
    requiresProvider: false,
  },
};

export function isFeatureAvailabilityReason(value: string): value is FeatureAvailabilityReason {
  return (FEATURE_AVAILABILITY_REASONS as readonly string[]).includes(value);
}
