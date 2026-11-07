import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  fetchTelegramSettings,
  patchTelegramSettings,
} from '@/features/dashboard/bookings/lib/telegramSettingsClient';
import { assetScopeKey, useAdminAssetScope } from '@/features/dashboard/org/lib/adminAssetScope';

const DELIVERY_PATH = '/telegram-delivery-settings';

export type TelegramDeliveryControl = { enabled: boolean };

export function telegramDeliveryControlKey(scopeKey: string) {
  return ['telegram-delivery-control', scopeKey] as const;
}

/** Master switch. Missing row on the server reads as enabled. */
export function useTelegramDeliveryControl() {
  const scope = useAdminAssetScope();
  const scopeKey = assetScopeKey(scope);

  return useQuery({
    queryKey: telegramDeliveryControlKey(scopeKey),
    queryFn: () =>
      fetchTelegramSettings<TelegramDeliveryControl>(
        DELIVERY_PATH,
        scope,
        'Failed to load Telegram delivery state'
      ),
  });
}

export function useUpdateTelegramDeliveryControl() {
  const qc = useQueryClient();
  const scope = useAdminAssetScope();
  const scopeKey = assetScopeKey(scope);

  return useMutation({
    mutationFn: (enabled: boolean) =>
      patchTelegramSettings<TelegramDeliveryControl>(
        DELIVERY_PATH,
        scope,
        { enabled },
        'Failed to update Telegram delivery'
      ),
    onSuccess: (result) => {
      qc.setQueryData(telegramDeliveryControlKey(scopeKey), result.data);
      /* The history header shows the same state. */
      void qc.invalidateQueries({ queryKey: ['telegram-history', scopeKey] });
    },
  });
}
