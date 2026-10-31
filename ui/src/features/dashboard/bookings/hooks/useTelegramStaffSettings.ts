import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { PropertyTelegramCredentialsStatus } from '@/features/dashboard/bookings/hooks/useAppSettings';
import {
  fetchTelegramSettings,
  patchTelegramSettings,
  postTelegramSettingsAction,
} from '@/features/dashboard/bookings/lib/telegramSettingsClient';
import { assetScopeKey, useAdminAssetScope } from '@/features/dashboard/org/lib/adminAssetScope';

export type StaffTimeSlot = { hour: number; minute: number };

export type StaffScenarioMeta = {
  id: string;
  label: string;
  trigger: string;
  type: 'scheduled' | 'event';
};

export type TelegramStaffSettingsDto = {
  enabled: boolean;
  notifyOnSameDayCheckin: boolean;
  notifyOnDailySummary: boolean;
  notifyOnDailySummaryNoBookings: boolean;
  dailySummaryTemplate: string;
  dailySummaryNoBookingsTemplate: string;
  sameDayCheckinTemplate: string;
  dailySummaryTimeManila: StaffTimeSlot;
  dailySummaryUtcCronPreview: string;
  placeholdersReference: string[];
  scenarios: StaffScenarioMeta[];
  credentials?: PropertyTelegramCredentialsStatus;
};

type TelegramStaffSettingsPatch = Partial<
  Pick<
    TelegramStaffSettingsDto,
    | 'enabled'
    | 'notifyOnSameDayCheckin'
    | 'notifyOnDailySummary'
    | 'notifyOnDailySummaryNoBookings'
    | 'dailySummaryTemplate'
    | 'dailySummaryNoBookingsTemplate'
    | 'sameDayCheckinTemplate'
    | 'dailySummaryTimeManila'
  >
> & {
  botToken?: string | null;
  chatId?: string | null;
};

export type StaffDraftScenario = 'daily_summary' | 'daily_summary_no_bookings' | 'same_day_checkin';

const STAFF_SETTINGS_PATH = '/telegram-staff-settings';

export function useTelegramStaffSettings() {
  const scope = useAdminAssetScope();
  const scopeKey = assetScopeKey(scope);
  return useQuery({
    queryKey: ['telegram-staff-settings', scopeKey],
    queryFn: () =>
      fetchTelegramSettings<TelegramStaffSettingsDto>(
        STAFF_SETTINGS_PATH,
        scope,
        'Failed to load staff settings'
      ),
  });
}

type TelegramStaffTestAction = 'verify_staff_telegram_env' | 'send_draft_preview';

type TelegramStaffTestPayload = {
  action: TelegramStaffTestAction;
  text?: string;
  scenario?: StaffDraftScenario;
  botToken?: string;
  chatId?: string;
};

export function useTelegramStaffTestSend() {
  const scope = useAdminAssetScope();
  return useMutation({
    mutationFn: (payload: TelegramStaffTestPayload) =>
      postTelegramSettingsAction<Record<string, unknown>>(
        STAFF_SETTINGS_PATH,
        scope,
        payload,
        'Request failed'
      ),
  });
}

export function useUpdateTelegramStaffSettings() {
  const qc = useQueryClient();
  const scope = useAdminAssetScope();
  const scopeKey = assetScopeKey(scope);
  return useMutation({
    mutationFn: (patch: TelegramStaffSettingsPatch) =>
      patchTelegramSettings<TelegramStaffSettingsDto>(
        STAFF_SETTINGS_PATH,
        scope,
        patch,
        'Failed to save'
      ),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['telegram-staff-settings', scopeKey] });
    },
  });
}
