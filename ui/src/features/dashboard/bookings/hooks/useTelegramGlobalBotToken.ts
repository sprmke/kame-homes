import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  fetchTelegramSettings,
  patchTelegramSettings,
  postTelegramSettingsAction,
} from '@/features/dashboard/bookings/lib/telegramSettingsClient';
import { assetScopeKey, useAdminAssetScope } from '@/features/dashboard/org/lib/adminAssetScope';

export type TelegramGlobalBotDto = {
  tokenConfigured: boolean;
  botToken: string | null;
  secretsEncryptionConfigured: boolean;
};

const GLOBAL_SETTINGS_PATH = '/telegram-global-settings';

export const TELEGRAM_GLOBAL_BOT_QUERY_KEY = ['telegram-global-bot'] as const;

export function useTelegramGlobalBotToken() {
  const scope = useAdminAssetScope();
  const scopeKey = assetScopeKey(scope);

  return useQuery({
    queryKey: [...TELEGRAM_GLOBAL_BOT_QUERY_KEY, scopeKey],
    queryFn: () =>
      fetchTelegramSettings<TelegramGlobalBotDto>(
        GLOBAL_SETTINGS_PATH,
        scope,
        'Failed to load shared bot token'
      ),
    enabled: Boolean(scope.propertyId || scope.parkingId),
  });
}

export function useUpdateTelegramGlobalBotToken() {
  const scope = useAdminAssetScope();
  const scopeKey = assetScopeKey(scope);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (telegramGlobalBotToken: string | null) => {
      const { data } = await patchTelegramSettings<TelegramGlobalBotDto>(
        GLOBAL_SETTINGS_PATH,
        scope,
        { telegramGlobalBotToken },
        'Could not save shared bot token'
      );
      return data;
    },
    onSuccess: (data) => {
      qc.setQueryData([...TELEGRAM_GLOBAL_BOT_QUERY_KEY, scopeKey], data);
    },
  });
}

type VerifyGlobalBotResponse = {
  verify?: {
    getMe?: { ok?: boolean; username?: string; error?: string };
  };
};

export function useVerifyTelegramGlobalBotToken() {
  const scope = useAdminAssetScope();

  return useMutation({
    mutationFn: (botToken: string) =>
      postTelegramSettingsAction<VerifyGlobalBotResponse>(
        GLOBAL_SETTINGS_PATH,
        scope,
        {
          action: 'verify_global_telegram_bot',
          botToken,
        },
        'Could not verify bot token'
      ),
  });
}
