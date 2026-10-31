import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { PropertyTelegramCredentialsStatus } from '@/features/dashboard/bookings/hooks/useAppSettings';
import {
  fetchTelegramSettings,
  patchTelegramSettings,
  postTelegramSettingsAction,
} from '@/features/dashboard/bookings/lib/telegramSettingsClient';
import { assetScopeKey, useAdminAssetScope } from '@/features/dashboard/org/lib/adminAssetScope';

export type MaintenanceTimeSlot = { hour: number; minute: number };

export type TelegramMaintenanceSettingsDto = {
  enabled: boolean;
  defaultReminderTemplate: string;
  dailyCheckTimeManila: MaintenanceTimeSlot;
  dailyCheckUtcCronPreview: string;
  placeholdersReference: string[];
  credentials?: PropertyTelegramCredentialsStatus;
};

type TelegramMaintenanceSettingsPatch = Partial<
  Pick<
    TelegramMaintenanceSettingsDto,
    'enabled' | 'defaultReminderTemplate' | 'dailyCheckTimeManila'
  >
> & {
  botToken?: string | null;
  chatId?: string | null;
};

const MAINTENANCE_SETTINGS_PATH = '/telegram-maintenance-settings';

export function useTelegramMaintenanceSettings() {
  const scope = useAdminAssetScope();
  const scopeKey = assetScopeKey(scope);
  return useQuery({
    queryKey: ['telegram-maintenance-settings', scopeKey],
    queryFn: () =>
      fetchTelegramSettings<TelegramMaintenanceSettingsDto>(
        MAINTENANCE_SETTINGS_PATH,
        scope,
        'Failed to load maintenance Telegram settings'
      ),
  });
}

export function useUpdateTelegramMaintenanceSettings() {
  const qc = useQueryClient();
  const scope = useAdminAssetScope();
  const scopeKey = assetScopeKey(scope);
  return useMutation({
    mutationFn: (patch: TelegramMaintenanceSettingsPatch) =>
      patchTelegramSettings<TelegramMaintenanceSettingsDto>(
        MAINTENANCE_SETTINGS_PATH,
        scope,
        patch,
        'Failed to save maintenance Telegram settings'
      ),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ['telegram-maintenance-settings', scopeKey],
      });
    },
  });
}

type TelegramMaintenanceTestAction =
  'verify_maintenance_telegram_env' | 'send_test_due_reminders' | 'send_draft_preview';

export function useTelegramMaintenanceTestSend() {
  const scope = useAdminAssetScope();
  return useMutation({
    mutationFn: (input: {
      action: TelegramMaintenanceTestAction;
      text?: string;
      botToken?: string;
      chatId?: string;
    }) =>
      postTelegramSettingsAction<Record<string, unknown>>(
        MAINTENANCE_SETTINGS_PATH,
        scope,
        input,
        'Test send failed'
      ),
  });
}
