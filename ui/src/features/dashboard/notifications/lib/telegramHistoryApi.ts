import { getAdminJwt } from '@/features/dashboard/bookings/lib/telegramSettingsClient';
import {
  scopedAssetFunctionsUrl,
  type AdminAssetScope,
} from '@/features/dashboard/org/lib/adminAssetScope';

export type TelegramHistoryMessage = {
  id: string;
  module: string;
  text: string;
  status: 'sent' | 'failed';
  error: string | null;
  createdAt: string;
};

export type TelegramHistoryPage = {
  messages: TelegramHistoryMessage[];
  nextCursor: string | null;
  deliveryEnabled: boolean;
  retentionDays: number;
};

type EdgeEnvelope = {
  success?: boolean;
  error?: string;
  data?: TelegramHistoryPage;
};

export const TELEGRAM_HISTORY_PAGE_SIZE = 20;

/** Read-only history page. One indexed query per page, no Telegram API calls. */
export async function fetchTelegramHistory(
  scope: AdminAssetScope,
  cursor: string | null,
  limit = TELEGRAM_HISTORY_PAGE_SIZE
): Promise<TelegramHistoryPage> {
  const url = new URL(scopedAssetFunctionsUrl('/telegram-message-log', scope));
  if (cursor) url.searchParams.set('cursor', cursor);
  url.searchParams.set('limit', String(limit));

  const jwt = await getAdminJwt();
  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${jwt}` } });
  const json = (await res.json().catch(() => ({}))) as EdgeEnvelope;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.error ?? 'Could not load Telegram messages');
  }
  return json.data;
}
