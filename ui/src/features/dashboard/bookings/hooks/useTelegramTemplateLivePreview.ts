import { useQuery } from '@tanstack/react-query';

import {
  fetchTelegramDraftPreview,
  type TelegramPreviewContext,
} from '@/features/dashboard/bookings/lib/telegramDraftPreviewApi';
import { assetScopeKey, useAdminAssetScope } from '@/features/dashboard/org/lib/adminAssetScope';

export function useTelegramTemplateLivePreview(
  text: string,
  previewContext: TelegramPreviewContext | undefined,
  enabled: boolean
) {
  const scope = useAdminAssetScope();
  const scopeKey = assetScopeKey(scope);

  return useQuery({
    queryKey: [
      'telegram-draft-preview',
      scopeKey,
      previewContext?.bot,
      previewContext?.scenario,
      previewContext?.checkInYmd,
      previewContext?.checkOutYmd,
      text,
    ],
    queryFn: () => fetchTelegramDraftPreview(text, previewContext!, scope),
    enabled: enabled && !!previewContext && !!text.trim(),
    retry: false,
    staleTime: 30_000,
  });
}
