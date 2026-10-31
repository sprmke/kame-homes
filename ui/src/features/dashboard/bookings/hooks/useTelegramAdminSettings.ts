import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { PropertyTelegramCredentialsStatus } from '@/features/dashboard/bookings/hooks/useAppSettings';
import {
  fetchTelegramSettings,
  patchTelegramSettings,
  postTelegramSettingsAction,
} from '@/features/dashboard/bookings/lib/telegramSettingsClient';
import { assetScopeKey, useAdminAssetScope } from '@/features/dashboard/org/lib/adminAssetScope';

export type AdminScenarioMeta = {
  id: string;
  label: string;
  trigger: string;
  type: 'event' | 'hourly';
};

export type TelegramAdminSettingsDto = {
  enabled: boolean;
  notifyOnNewBooking: boolean;
  notifyOnSdFormSubmitted: boolean;
  notifyOnBalanceReceiptUploaded: boolean;
  notifyPendingDocsHourly: boolean;
  notifyBalanceReceiptHourly: boolean;
  notifySdRefundPendingHourly: boolean;
  newBookingTemplate: string;
  pendingDocsTemplate: string;
  balanceReceiptTemplate: string;
  balanceReceiptUploadedTemplate: string;
  sdFormSubmittedTemplate: string;
  sdRefundPendingTemplate: string;
  hourlyUtcCronPreview: string;
  placeholdersReference: string[];
  scenarios: AdminScenarioMeta[];
  credentials?: PropertyTelegramCredentialsStatus;
};

type TelegramAdminSettingsPatch = Partial<
  Pick<
    TelegramAdminSettingsDto,
    | 'enabled'
    | 'notifyOnNewBooking'
    | 'notifyOnSdFormSubmitted'
    | 'notifyOnBalanceReceiptUploaded'
    | 'notifyPendingDocsHourly'
    | 'notifyBalanceReceiptHourly'
    | 'notifySdRefundPendingHourly'
    | 'newBookingTemplate'
    | 'pendingDocsTemplate'
    | 'balanceReceiptTemplate'
    | 'balanceReceiptUploadedTemplate'
    | 'sdFormSubmittedTemplate'
    | 'sdRefundPendingTemplate'
  >
> & {
  resyncHourlyCron?: boolean;
  botToken?: string | null;
  chatId?: string | null;
};

export type AdminDraftScenario =
  | 'new_booking'
  | 'pending_docs'
  | 'balance_receipt'
  | 'balance_receipt_uploaded'
  | 'sd_form_submitted'
  | 'sd_refund_pending';

const ADMIN_SETTINGS_PATH = '/telegram-admin-settings';

export function useTelegramAdminSettings() {
  const scope = useAdminAssetScope();
  const scopeKey = assetScopeKey(scope);
  return useQuery({
    queryKey: ['telegram-admin-settings', scopeKey],
    queryFn: () =>
      fetchTelegramSettings<TelegramAdminSettingsDto>(
        ADMIN_SETTINGS_PATH,
        scope,
        'Failed to load operations settings'
      ),
  });
}

type TelegramAdminTestAction = 'verify_admin_telegram_env' | 'send_draft_preview';

type TelegramAdminTestPayload = {
  action: TelegramAdminTestAction;
  text?: string;
  scenario?: AdminDraftScenario;
  botToken?: string;
  chatId?: string;
};

export function useTelegramAdminTestSend() {
  const scope = useAdminAssetScope();
  return useMutation({
    mutationFn: (payload: TelegramAdminTestPayload) =>
      postTelegramSettingsAction<Record<string, unknown>>(
        ADMIN_SETTINGS_PATH,
        scope,
        payload,
        'Request failed'
      ),
  });
}

export function useUpdateTelegramAdminSettings() {
  const qc = useQueryClient();
  const scope = useAdminAssetScope();
  const scopeKey = assetScopeKey(scope);
  return useMutation({
    mutationFn: (patch: TelegramAdminSettingsPatch) =>
      patchTelegramSettings<TelegramAdminSettingsDto>(
        ADMIN_SETTINGS_PATH,
        scope,
        patch,
        'Failed to save'
      ),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['telegram-admin-settings', scopeKey] });
    },
  });
}
