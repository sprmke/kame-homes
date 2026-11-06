import { Bell, BellRing, Send, SlidersHorizontal } from 'lucide-react';

import type { HelpCopyModule, HowItWorksCopy } from '@/lib/help/types';

/** "How notifications work" — the three delivery channels plus the rule that ties them together. */
export const NOTIFICATIONS_HOW_IT_WORKS: HowItWorksCopy = {
  title: 'How notifications work',
  steps: [
    {
      icon: Bell,
      title: 'In-app',
      body: 'Every event lands in Activity and in the bell. Nothing to set up.',
    },
    {
      icon: BellRing,
      title: 'Phone push',
      body: 'Turn it on for this device, then choose which groups can buzz you.',
    },
    {
      icon: Send,
      title: 'Telegram',
      body: 'Add a bot token and chat ID per module. Set up a Telegram group first.',
    },
    {
      icon: SlidersHorizontal,
      title: 'Pick per channel',
      body: 'Mute a group for phone push only. Activity keeps every event.',
    },
  ],
  tip: 'Quiet hours use Philippine time. Calendar sync failures still come through.',
};

/** Notifications hub summary cards. */
export const NOTIFICATIONS_HELP_COPY = {
  telegramOn: {
    hint: 'How many notification modules have Telegram turned on.',
  },
  connected: {
    hint: 'How many modules have a Telegram chat connected. Setup is needed when this is lower than Telegram on.',
  },
} satisfies HelpCopyModule;
