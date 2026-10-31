import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { PropertyTelegramCredentialsStatus } from '@/features/dashboard/bookings/hooks/useAppSettings';
import {
  fetchTelegramSettings,
  patchTelegramSettings,
  postTelegramSettingsAction,
} from '@/features/dashboard/bookings/lib/telegramSettingsClient';
import { assetScopeKey, useAdminAssetScope } from '@/features/dashboard/org/lib/adminAssetScope';

export type TelegramChatSettingsDto = {
  enabled: boolean;
  notifyOnNewMessage: boolean;
  newMessageTemplate: string;
  placeholdersReference: string[];
  credentials?: PropertyTelegramCredentialsStatus;
};

type TelegramChatSettingsPatch = Partial<
  Pick<TelegramChatSettingsDto, 'enabled' | 'notifyOnNewMessage' | 'newMessageTemplate'>
> & {
  botToken?: string | null;
  chatId?: string | null;
};

const CHAT_SETTINGS_PATH = '/telegram-chat-settings';

export function useTelegramChatSettings() {
  const scope = useAdminAssetScope();
  const scopeKey = assetScopeKey(scope);
  return useQuery({
    queryKey: ['telegram-chat-settings', scopeKey],
    queryFn: () =>
      fetchTelegramSettings<TelegramChatSettingsDto>(
        CHAT_SETTINGS_PATH,
        scope,
        'Failed to load chat Telegram settings'
      ),
  });
}

export function useUpdateTelegramChatSettings() {
  const qc = useQueryClient();
  const scope = useAdminAssetScope();
  const scopeKey = assetScopeKey(scope);
  return useMutation({
    mutationFn: (patch: TelegramChatSettingsPatch) =>
      patchTelegramSettings<TelegramChatSettingsDto>(
        CHAT_SETTINGS_PATH,
        scope,
        patch,
        'Failed to save chat Telegram settings'
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['telegram-chat-settings', scopeKey] });
    },
  });
}

type TelegramChatTestAction =
  'verify_chat_telegram_env' | 'send_draft_preview' | 'render_draft_preview';

export function useTelegramChatTestSend() {
  const scope = useAdminAssetScope();
  return useMutation({
    mutationFn: (input: {
      action: TelegramChatTestAction;
      text?: string;
      botToken?: string;
      chatId?: string;
    }) =>
      postTelegramSettingsAction<Record<string, unknown>>(
        CHAT_SETTINGS_PATH,
        scope,
        input,
        'Test send failed'
      ),
  });
}
