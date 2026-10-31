/**
 * PATCH helpers for per-property Telegram bot token + chat id (encrypted at rest).
 */

import {
  encryptTelegramCredentialFields,
  getPropertyTelegramCredentialsAdminStatus,
  type TelegramAssetScopeRef,
  type TelegramChannel,
} from './propertyTelegramCredentials.ts';

export async function buildTelegramCredentialsPatch(
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const hasBot = body.botToken !== undefined;
  const hasChat = body.chatId !== undefined;
  if (!hasBot && !hasChat) return {};

  if (hasBot && body.botToken !== null && typeof body.botToken !== 'string') {
    throw new Error('botToken must be a string or null');
  }
  if (hasChat && body.chatId !== null && typeof body.chatId !== 'string') {
    throw new Error('chatId must be a string or null');
  }

  return encryptTelegramCredentialFields({
    botToken: hasBot ? (body.botToken as string | null) : undefined,
    chatId: hasChat ? (body.chatId as string | null) : undefined,
  });
}

export async function telegramCredentialsDto(
  channel: TelegramChannel,
  scope: TelegramAssetScopeRef | string
) {
  return getPropertyTelegramCredentialsAdminStatus(channel, scope);
}

export type TelegramVerifyOverrides = {
  botToken?: string;
  chatId?: string;
};

/** Optional draft credentials from the admin UI verify POST body. */
export function parseTelegramVerifyOverrides(
  body: Record<string, unknown>
): TelegramVerifyOverrides {
  const botToken = typeof body.botToken === 'string' ? body.botToken.trim() : undefined;
  const chatId = typeof body.chatId === 'string' ? body.chatId.trim() : undefined;
  return {
    ...(botToken ? { botToken } : {}),
    ...(chatId ? { chatId } : {}),
  };
}
