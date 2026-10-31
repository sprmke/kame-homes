import { useMutation } from '@tanstack/react-query';

import { postTelegramSettingsAction } from '@/features/dashboard/bookings/lib/telegramSettingsClient';
import { useAdminAssetScope } from '@/features/dashboard/org/lib/adminAssetScope';

export type TelegramDiscoveredChat = {
  chatId: string;
  title: string;
  type: string;
  username?: string;
  lastUpdateId: number;
};

export type DiscoverTelegramChatsResponse = {
  verify?: {
    getMe?: { ok?: boolean; username?: string; error?: string };
    chats?: TelegramDiscoveredChat[];
    hint?: string;
    error?: string;
  };
};

const GLOBAL_SETTINGS_PATH = '/telegram-global-settings';

export function useDiscoverTelegramChats() {
  const scope = useAdminAssetScope();

  return useMutation({
    mutationFn: async (botToken: string) => {
      const result = await postTelegramSettingsAction<DiscoverTelegramChatsResponse>(
        GLOBAL_SETTINGS_PATH,
        scope,
        {
          action: 'discover_telegram_chats',
          botToken,
        },
        'Could not scan for chats'
      );
      return result.verify ?? {};
    },
  });
}
