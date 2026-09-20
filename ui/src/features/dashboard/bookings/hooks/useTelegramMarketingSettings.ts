import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  fetchTelegramSettings,
  patchTelegramSettings,
  postTelegramSettingsAction,
} from '@/features/dashboard/bookings/lib/telegramSettingsClient';
import { assetScopeKey, useAdminAssetScope } from '@/features/dashboard/org/lib/adminAssetScope';

export type ManilaReminderSlot = { hour: number; minute: number };

export type TelegramMarketingSettingsDto = {
  enabled: boolean;
  notifyOnNewBooking: boolean;
  notifyOnCancellation: boolean;
  notifyOnDailyDefault: boolean;
  notifyOnDailyUrgency: boolean;
  urgencyDaysThreshold: number;
  newBookingDatesLimit: number;
  dailyReminderTimesManila: ManilaReminderSlot[];
  /** pg_cron daily expressions derived server-side (`minute hour * * *`, UTC). */
  dailyReminderUtcCronPreview: string[];
  dailyDefaultTemplate: string;
  dailyUrgencyTemplate: string;
  newBookingTemplate: string;
  cancellationTemplate: string;
  placeholdersReference: string[];
  credentials?: {
    tokenConfigured: boolean;
    chatIdConfigured: boolean;
    tokenSource: 'db' | 'none';
    chatIdSource: 'db' | 'none';
    secretsEncryptionConfigured: boolean;
    botToken?: string | null;
    chatId?: string | null;
  };
};

type TelegramMarketingSettingsPatch = Partial<
  Pick<
    TelegramMarketingSettingsDto,
    | 'enabled'
    | 'notifyOnNewBooking'
    | 'notifyOnCancellation'
    | 'notifyOnDailyDefault'
    | 'notifyOnDailyUrgency'
    | 'urgencyDaysThreshold'
    | 'newBookingDatesLimit'
    | 'dailyReminderTimesManila'
    | 'dailyDefaultTemplate'
    | 'dailyUrgencyTemplate'
    | 'newBookingTemplate'
    | 'cancellationTemplate'
  >
> & {
  botToken?: string | null;
  chatId?: string | null;
};

const MARKETING_SETTINGS_PATH = '/telegram-marketing-settings';

export function useTelegramMarketingSettings() {
  const scope = useAdminAssetScope();
  const scopeKey = assetScopeKey(scope);
  return useQuery({
    queryKey: ['telegram-marketing-settings', scopeKey],
    queryFn: () =>
      fetchTelegramSettings<TelegramMarketingSettingsDto>(
        MARKETING_SETTINGS_PATH,
        scope,
        'Failed to load Telegram settings'
      ),
  });
}

type TelegramMarketingTestAction = 'verify_telegram_env' | 'send_draft_preview';

type TelegramMarketingTestPayload = {
  action: TelegramMarketingTestAction;
  text?: string;
  checkInYmd?: string;
  checkOutYmd?: string;
  botToken?: string;
  chatId?: string;
};

export function useTelegramMarketingTestSend() {
  const scope = useAdminAssetScope();
  return useMutation({
    mutationFn: (payload: TelegramMarketingTestPayload) =>
      postTelegramSettingsAction<Record<string, unknown>>(
        MARKETING_SETTINGS_PATH,
        scope,
        payload,
        'Request failed'
      ),
  });
}

export function useUpdateTelegramMarketingSettings() {
  const qc = useQueryClient();
  const scope = useAdminAssetScope();
  const scopeKey = assetScopeKey(scope);
  return useMutation({
    mutationFn: (patch: TelegramMarketingSettingsPatch) =>
      patchTelegramSettings<TelegramMarketingSettingsDto>(
        MARKETING_SETTINGS_PATH,
        scope,
        patch,
        'Failed to save'
      ),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['telegram-marketing-settings', scopeKey] });
    },
  });
}
