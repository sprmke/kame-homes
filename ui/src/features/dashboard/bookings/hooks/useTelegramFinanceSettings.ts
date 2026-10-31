import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { PropertyTelegramCredentialsStatus } from '@/features/dashboard/bookings/hooks/useAppSettings';
import {
  fetchTelegramSettings,
  patchTelegramSettings,
  postTelegramSettingsAction,
} from '@/features/dashboard/bookings/lib/telegramSettingsClient';
import { assetScopeKey, useAdminAssetScope } from '@/features/dashboard/org/lib/adminAssetScope';

export type FinanceTimeSlot = { hour: number; minute: number };

export type TelegramFinanceSettingsDto = {
  enabled: boolean;
  defaultReminderTemplate: string;
  dailyCheckTimeManila: FinanceTimeSlot;
  dailyCheckUtcCronPreview: string;
  placeholdersReference: string[];
  credentials?: PropertyTelegramCredentialsStatus;
};

type TelegramFinanceSettingsPatch = Partial<
  Pick<TelegramFinanceSettingsDto, 'enabled' | 'defaultReminderTemplate' | 'dailyCheckTimeManila'>
> & {
  botToken?: string | null;
  chatId?: string | null;
};

const FINANCE_SETTINGS_PATH = '/telegram-finance-settings';

export function useTelegramFinanceSettings() {
  const scope = useAdminAssetScope();
  const scopeKey = assetScopeKey(scope);
  return useQuery({
    queryKey: ['telegram-finance-settings', scopeKey],
    queryFn: () =>
      fetchTelegramSettings<TelegramFinanceSettingsDto>(
        FINANCE_SETTINGS_PATH,
        scope,
        'Failed to load finance Telegram settings'
      ),
  });
}

export function useUpdateTelegramFinanceSettings() {
  const qc = useQueryClient();
  const scope = useAdminAssetScope();
  const scopeKey = assetScopeKey(scope);
  return useMutation({
    mutationFn: (patch: TelegramFinanceSettingsPatch) =>
      patchTelegramSettings<TelegramFinanceSettingsDto>(
        FINANCE_SETTINGS_PATH,
        scope,
        patch,
        'Failed to save finance Telegram settings'
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['telegram-finance-settings', scopeKey] });
    },
  });
}

type TelegramFinanceTestAction =
  'verify_finance_telegram_env' | 'send_test_due_reminders' | 'send_draft_preview';

export function useTelegramFinanceTestSend() {
  const scope = useAdminAssetScope();
  return useMutation({
    mutationFn: (input: {
      action: TelegramFinanceTestAction;
      text?: string;
      botToken?: string;
      chatId?: string;
    }) =>
      postTelegramSettingsAction<Record<string, unknown>>(
        FINANCE_SETTINGS_PATH,
        scope,
        input,
        'Test send failed'
      ),
  });
}
