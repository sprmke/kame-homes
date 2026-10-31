import type { TelegramEnvVerifyDto } from '@/features/dashboard/bookings/lib/telegramEnvVerify';

export type TelegramConnectionLabels = {
  botLabel?: string;
  chatLabel?: string;
};

export function telegramBotDisplayLabel(username?: string): string | undefined {
  const u = username?.trim();
  return u ? `@${u}` : undefined;
}

export function telegramChatDisplayLabel(title?: string, username?: string): string | undefined {
  const t = title?.trim();
  if (t) return t;
  return telegramBotDisplayLabel(username);
}

export function telegramConnectionLabelsFromVerify(
  verify?: TelegramEnvVerifyDto | null
): TelegramConnectionLabels {
  if (!verify) return {};
  return {
    botLabel: verify.getMe?.ok ? telegramBotDisplayLabel(verify.getMe.username) : undefined,
    chatLabel: verify.getChat?.ok
      ? telegramChatDisplayLabel(verify.getChat.title, verify.getChat.username)
      : undefined,
  };
}
