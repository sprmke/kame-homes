import * as React from 'react';

import type { PropertyTelegramCredentialsStatus } from '@/features/dashboard/bookings/hooks/useAppSettings';

/** Local bot token / chat id fields synced from server when saved credentials change. */
export function useTelegramCredentialFields(
  credentials: PropertyTelegramCredentialsStatus | undefined,
  globalBotToken?: string | null
) {
  const [botToken, setBotToken] = React.useState('');
  const [chatId, setChatId] = React.useState('');

  const serverToken = credentials?.botToken ?? '';
  const serverChat = credentials?.chatId ?? '';
  const fallbackToken = globalBotToken?.trim() ?? '';

  React.useEffect(() => {
    setBotToken(serverToken || fallbackToken);
    setChatId(serverChat);
  }, [serverToken, serverChat, fallbackToken]);

  return { botToken, setBotToken, chatId, setChatId };
}
