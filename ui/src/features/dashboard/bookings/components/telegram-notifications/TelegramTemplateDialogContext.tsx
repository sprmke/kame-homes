import * as React from 'react';

type TelegramTemplateDialogContextValue = {
  openPlaceholders: () => void;
  disabled?: boolean;
  insertTokenRef: React.MutableRefObject<((token: string) => void) | null>;
};

const TelegramTemplateDialogContext =
  React.createContext<TelegramTemplateDialogContextValue | null>(null);

export function TelegramTemplateDialogProvider({
  value,
  children,
}: {
  value: TelegramTemplateDialogContextValue;
  children: React.ReactNode;
}) {
  return (
    <TelegramTemplateDialogContext.Provider value={value}>
      {children}
    </TelegramTemplateDialogContext.Provider>
  );
}

export function useTelegramTemplateDialogActions() {
  return React.useContext(TelegramTemplateDialogContext);
}
