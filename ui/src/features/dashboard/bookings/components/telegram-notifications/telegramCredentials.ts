import type { PropertyTelegramCredentialsStatus } from '@/features/dashboard/bookings/hooks/useAppSettings';

/** Telegram bot token format: `{numeric_bot_id}:{secret}`. */
export const TELEGRAM_BOT_TOKEN_EMPTY_PLACEHOLDER = '7123456789:AAH…';

/** Typical supergroup / channel chat id (negative numeric). */
export const TELEGRAM_CHAT_ID_EMPTY_PLACEHOLDER = '-1002345678901';

const TELEGRAM_BOT_TOKEN_SAVED_PLACEHOLDER = '7123456789:AAH…';
const TELEGRAM_CHAT_ID_SAVED_PLACEHOLDER = '-100234…8901';

export function telegramBotTokenPlaceholder(configured: boolean): string {
  return configured ? TELEGRAM_BOT_TOKEN_SAVED_PLACEHOLDER : TELEGRAM_BOT_TOKEN_EMPTY_PLACEHOLDER;
}

export function telegramChatIdPlaceholder(configured: boolean): string {
  return configured ? TELEGRAM_CHAT_ID_SAVED_PLACEHOLDER : TELEGRAM_CHAT_ID_EMPTY_PLACEHOLDER;
}

export function telegramCredentialsReady(
  status: PropertyTelegramCredentialsStatus | undefined,
  botToken: string,
  chatId: string
): boolean {
  const hasToken = Boolean(status?.tokenConfigured) || botToken.trim().length > 0;
  const hasChat = Boolean(status?.chatIdConfigured) || chatId.trim().length > 0;
  return hasToken && hasChat;
}

export function telegramVerifySucceeded(
  verify:
    | {
        credentials?: { normalizeError?: string };
        getMe?: { ok?: boolean };
        getChat?: { ok?: boolean };
      }
    | undefined
): boolean {
  if (!verify) return false;
  if (verify.credentials?.normalizeError) return false;
  return Boolean(verify.getMe?.ok && verify.getChat?.ok);
}

export function telegramCredentialsSummary(
  status: PropertyTelegramCredentialsStatus | undefined,
  botToken: string,
  chatId: string
): string {
  if (!telegramCredentialsReady(status, botToken, chatId)) {
    return 'Bot token and chat ID required';
  }
  if (status?.tokenConfigured && status?.chatIdConfigured && !botToken && !chatId) {
    return 'Saved on server';
  }
  return 'Ready to save';
}

/** Draft credentials to include on verify POST (falls back to saved DB values). */
export function buildTelegramVerifyBody(
  botToken: string,
  chatId: string
): { botToken?: string; chatId?: string } {
  const token = botToken.trim();
  const chat = chatId.trim();
  return {
    ...(token ? { botToken: token } : {}),
    ...(chat ? { chatId: chat } : {}),
  };
}
