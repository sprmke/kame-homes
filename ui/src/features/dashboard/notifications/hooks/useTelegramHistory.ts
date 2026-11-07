import { useQuery } from '@tanstack/react-query';

import {
  fetchTelegramHistory,
  type TelegramHistoryPage,
} from '@/features/dashboard/notifications/lib/telegramHistoryApi';
import { assetScopeKey, useAdminAssetScope } from '@/features/dashboard/org/lib/adminAssetScope';

export function telegramHistoryKey(scopeKey: string, cursor: string | null) {
  return ['telegram-history', scopeKey, cursor] as const;
}

/** One history page. Callers walk a cursor stack (see notificationPager). */
export function useTelegramHistoryPage(cursor: string | null) {
  const scope = useAdminAssetScope();
  const scopeKey = assetScopeKey(scope);

  return useQuery<TelegramHistoryPage>({
    queryKey: telegramHistoryKey(scopeKey, cursor),
    queryFn: () => fetchTelegramHistory(scope, cursor),
    staleTime: 60_000,
  });
}
