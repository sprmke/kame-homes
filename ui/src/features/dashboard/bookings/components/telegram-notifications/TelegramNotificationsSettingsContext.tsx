import { createContext, useContext, type ReactNode } from 'react';

type ContextValue = {
  settingsEditable: boolean;
};

const TelegramNotificationsSettingsContext = createContext<ContextValue>({
  settingsEditable: true,
});

export function TelegramNotificationsSettingsProvider({
  settingsEditable,
  children,
}: {
  settingsEditable: boolean;
  children: ReactNode;
}) {
  return (
    <TelegramNotificationsSettingsContext value={{ settingsEditable }}>
      {children}
    </TelegramNotificationsSettingsContext>
  );
}

export function useTelegramNotificationsSettingsEditable(): boolean {
  return useContext(TelegramNotificationsSettingsContext).settingsEditable;
}
