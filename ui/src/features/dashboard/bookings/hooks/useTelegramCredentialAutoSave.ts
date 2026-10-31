import * as React from 'react';

import { toast } from 'sonner';

import { buildTelegramVerifyBody } from '@/features/dashboard/bookings/components/telegram-notifications/telegramCredentials';

import { friendlyToastError } from '@/lib/feedback/toastMessages';

type CredentialMutate = {
  mutate: (
    patch: { botToken?: string; chatId?: string },
    options?: {
      onError?: (error: unknown) => void;
    }
  ) => void;
};

/** PATCH draft bot token / chat id after a successful Connect verify. */
export function useTelegramCredentialAutoSave(
  botToken: string,
  chatId: string,
  update: CredentialMutate
) {
  return React.useCallback(() => {
    const patch = buildTelegramVerifyBody(botToken, chatId);
    if (!patch.botToken && !patch.chatId) return;

    update.mutate(patch, {
      onError: (e) => toast.error(friendlyToastError(e, 'Could not save Telegram credentials')),
    });
  }, [botToken, chatId, update]);
}
