import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { PropertyTelegramCredentialsStatus } from '@/features/dashboard/bookings/hooks/useAppSettings';
import {
  fetchTelegramSettings,
  patchTelegramSettings,
  postTelegramSettingsAction,
} from '@/features/dashboard/bookings/lib/telegramSettingsClient';
import { assetScopeKey, useAdminAssetScope } from '@/features/dashboard/org/lib/adminAssetScope';

export type TelegramParkingSettingsDto = {
  enabled: boolean;
  reservationRequestTemplate: string;
  checkInReminderTemplate: string;
  paymentReceivedTemplate: string;
  notifyOnReservationRequest: boolean;
  notifyOnCheckInReminder: boolean;
  notifyOnPaymentReceived: boolean;
  placeholdersReference: string[];
  credentials?: PropertyTelegramCredentialsStatus;
  updatedAt: string | null;
};

type TelegramParkingSettingsPatch = Partial<
  Pick<
    TelegramParkingSettingsDto,
    | 'enabled'
    | 'reservationRequestTemplate'
    | 'checkInReminderTemplate'
    | 'paymentReceivedTemplate'
    | 'notifyOnReservationRequest'
    | 'notifyOnCheckInReminder'
    | 'notifyOnPaymentReceived'
  >
> & {
  botToken?: string | null;
  chatId?: string | null;
};

const PARKING_SETTINGS_PATH = '/telegram-parking-settings';

export function useTelegramParkingSettings() {
  const scope = useAdminAssetScope();
  const scopeKey = assetScopeKey(scope);
  return useQuery({
    queryKey: ['telegram-parking-settings', scopeKey],
    queryFn: () =>
      fetchTelegramSettings<TelegramParkingSettingsDto>(
        PARKING_SETTINGS_PATH,
        scope,
        'Failed to load parking Telegram settings'
      ),
    enabled: Boolean(scope.parkingId),
  });
}

export function useUpdateTelegramParkingSettings() {
  const qc = useQueryClient();
  const scope = useAdminAssetScope();
  const scopeKey = assetScopeKey(scope);
  return useMutation({
    mutationFn: (patch: TelegramParkingSettingsPatch) =>
      patchTelegramSettings<TelegramParkingSettingsDto>(
        PARKING_SETTINGS_PATH,
        scope,
        patch,
        'Failed to save parking Telegram settings'
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['telegram-parking-settings', scopeKey] });
      void qc.invalidateQueries({ queryKey: ['parking-settings'] });
    },
  });
}

type TelegramParkingTestAction = 'verify_parking_telegram_env' | 'send_draft_preview';

export function useTelegramParkingTestSend() {
  const scope = useAdminAssetScope();
  return useMutation({
    mutationFn: (input: {
      action: TelegramParkingTestAction;
      text?: string;
      botToken?: string;
      chatId?: string;
    }) =>
      postTelegramSettingsAction<Record<string, unknown>>(
        PARKING_SETTINGS_PATH,
        scope,
        input,
        'Test send failed'
      ),
  });
}
