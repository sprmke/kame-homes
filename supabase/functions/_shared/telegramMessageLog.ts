/**
 * Read-only archive of Telegram sends.
 *
 * One row per send attempt. The writer never throws and never blocks the send it
 * describes: a logging failure must not turn a delivered alert into a 500.
 */

import { createServiceClient } from './orgAuth.ts';
import { normalizeTelegramScope, type TelegramScopeRef } from './telegramScope.ts';

/** Read window for the history endpoint; older rows are pruned. */
export const TELEGRAM_HISTORY_RETENTION_DAYS = 15;

/** Telegram's own limit for `sendMessage`. Store exactly what was sent. */
export const TELEGRAM_MESSAGE_MAX_CHARS = 4096;

export type TelegramLogModule =
  | 'chat'
  | 'marketing'
  | 'staff'
  | 'operations'
  | 'finance'
  | 'maintenance'
  | 'parking'
  | 'broadcast';

export type TelegramMessageLogEntry = {
  scope?: TelegramScopeRef | string | null;
  module: TelegramLogModule;
  text: string;
  ok: boolean;
  error?: string | null;
};

export function buildTelegramLogRow(entry: TelegramMessageLogEntry): {
  property_id: string | null;
  parking_id: string | null;
  module: TelegramLogModule;
  message_text: string;
  status: 'sent' | 'failed';
  error_message: string | null;
} | null {
  const { propertyId, parkingId } = normalizeTelegramScope(entry.scope);
  if (!propertyId && !parkingId) return null;
  if (!entry.text.trim()) return null;

  return {
    property_id: propertyId,
    parking_id: parkingId,
    module: entry.module,
    message_text: entry.text.slice(0, TELEGRAM_MESSAGE_MAX_CHARS),
    status: entry.ok ? 'sent' : 'failed',
    error_message: entry.ok ? null : (entry.error?.slice(0, 500) ?? 'send failed'),
  };
}

export async function logTelegramMessage(entry: TelegramMessageLogEntry): Promise<void> {
  try {
    const row = buildTelegramLogRow(entry);
    if (!row) return;
    const { error } = await createServiceClient().from('telegram_message_log').insert(row);
    if (error) console.warn('[telegram-log] insert failed:', error.message);
  } catch (error) {
    console.warn(
      '[telegram-log] insert threw:',
      error instanceof Error ? error.message : error
    );
  }
}
