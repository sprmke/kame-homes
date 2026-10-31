import { Bot } from 'lucide-react';

import type { AdminSectionNavItem } from '@/features/dashboard/bookings/components/AdminSectionNavLayout';

/**
 * Shared bot token card, first in the Telegram view's section nav. The card
 * itself owns `id="section-global-bot"` (`TelegramGlobalBotTokenCard`), so the
 * id here must match or scroll-spy skips it.
 */
export const TELEGRAM_BOT_SECTION: AdminSectionNavItem = {
  id: 'global-bot',
  label: 'Shared bot token',
  icon: Bot,
};
