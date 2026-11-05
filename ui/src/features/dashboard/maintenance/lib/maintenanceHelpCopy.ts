import type { HelpCopyModule } from '@/lib/help/types';

/** Maintenance summary cards. `telegramEnabled` items will send a reminder. */
export const MAINTENANCE_HELP_COPY = {
  telegramEnabled: {
    hint: 'Items that will send a reminder to your Telegram chat.',
  },
  pending: {
    hint: 'Items not marked complete yet.',
  },
} satisfies HelpCopyModule;
