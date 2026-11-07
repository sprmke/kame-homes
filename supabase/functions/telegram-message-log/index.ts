/**
 * telegram-message-log — read-only copy of what each Telegram group received.
 *
 * Keyset pagination (newest first) inside a fixed 15-day window, scoped to the
 * property or parking that owns the chat. Nothing here calls Telegram, so
 * browsing the history costs one indexed query per page and no API quota.
 */

import { jsonError, jsonSuccess } from '../_shared/httpResponse.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { resolveTelegramAssetAccess } from '../_shared/telegramAssetScope.ts';
import { isTelegramDeliveryEnabled } from '../_shared/telegramDeliveryControl.ts';
import { TELEGRAM_HISTORY_RETENTION_DAYS } from '../_shared/telegramMessageLog.ts';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

const LOG_COLUMNS = 'id, module, message_text, status, error_message, created_at';

type LogRow = {
  id: string;
  module: string;
  message_text: string;
  status: string;
  error_message: string | null;
  created_at: string;
};

serveAuthenticated('telegram-message-log', async (req) => {
  if (req.method !== 'GET') return jsonError(req, 'Method not allowed', 405);

  const asset = await resolveTelegramAssetAccess(req);
  const url = new URL(req.url);
  const cursor = url.searchParams.get('cursor');
  const limit = Math.min(
    Math.max(Number(url.searchParams.get('limit')) || DEFAULT_LIMIT, 1),
    MAX_LIMIT
  );
  const since = new Date(
    Date.now() - TELEGRAM_HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const sb = createServiceClient();
  let query = sb
    .from('telegram_message_log')
    .select(LOG_COLUMNS)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(limit + 1);

  query =
    asset.kind === 'property'
      ? query.eq('property_id', asset.id)
      : query.eq('parking_id', asset.id);

  if (cursor) query = query.lt('created_at', cursor);

  const { data, error } = await query;
  if (error) return jsonError(req, error.message, 500);

  const rows = (data ?? []) as LogRow[];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  const deliveryEnabled = await isTelegramDeliveryEnabled(
    asset.kind === 'property' ? { propertyId: asset.id } : { parkingId: asset.id }
  );

  return jsonSuccess(req, {
    messages: page.map((row) => ({
      id: row.id,
      module: row.module,
      text: row.message_text,
      status: row.status,
      error: row.error_message,
      createdAt: row.created_at,
    })),
    nextCursor: hasMore ? (page[page.length - 1]?.created_at ?? null) : null,
    deliveryEnabled,
    retentionDays: TELEGRAM_HISTORY_RETENTION_DAYS,
  });
});
