import * as React from 'react';

import { useTelegramBotDisplayLabel } from '@/features/dashboard/bookings/hooks/useTelegramBotDisplayLabel';
import { useTelegramGlobalBotToken } from '@/features/dashboard/bookings/hooks/useTelegramGlobalBotToken';

export type TelegramGlobalBotContextValue = {
  token: string;
  label: string;
  labelResolving: boolean;
};

const TelegramNotificationsGlobalBotContext = React.createContext<TelegramGlobalBotContextValue>({
  token: '',
  label: '',
  labelResolving: false,
});

export function TelegramNotificationsGlobalBotProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data } = useTelegramGlobalBotToken();
  const token = data?.botToken?.trim() ?? '';
  const { label, isResolving } = useTelegramBotDisplayLabel(token);

  const value = React.useMemo(
    () => ({
      token,
      label: label ?? '',
      labelResolving: isResolving,
    }),
    [token, label, isResolving]
  );

  return (
    <TelegramNotificationsGlobalBotContext.Provider value={value}>
      {children}
    </TelegramNotificationsGlobalBotContext.Provider>
  );
}

export function useTelegramNotificationsGlobalBot(): TelegramGlobalBotContextValue {
  return React.useContext(TelegramNotificationsGlobalBotContext);
}
