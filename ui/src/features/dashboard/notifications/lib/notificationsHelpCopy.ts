import type { HelpCopyModule } from '@/lib/help/types';

/** Notifications hub summary cards. */
export const NOTIFICATIONS_HELP_COPY = {
  telegramOn: {
    hint: 'How many notification modules have Telegram turned on.',
  },
  connected: {
    hint: 'How many modules have a Telegram chat connected. Setup is needed when this is lower than Telegram on.',
  },
} satisfies HelpCopyModule;
