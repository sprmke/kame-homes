import * as React from 'react';

import { useVerifyTelegramGlobalBotToken } from '@/features/dashboard/bookings/hooks/useTelegramGlobalBotToken';
import { telegramBotDisplayLabel } from '@/features/dashboard/bookings/lib/telegramConnectionLabels';

/** Resolve @username for a bot token via Telegram getMe (once per distinct token). */
export function useTelegramBotDisplayLabel(botToken: string): {
  label?: string;
  isResolving: boolean;
} {
  const verify = useVerifyTelegramGlobalBotToken();
  const [label, setLabel] = React.useState<string | undefined>();
  const [isResolving, setIsResolving] = React.useState(false);
  const resolvedRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    const trimmed = botToken.trim();
    if (!trimmed) {
      setLabel(undefined);
      setIsResolving(false);
      resolvedRef.current = null;
      return;
    }
    if (resolvedRef.current === trimmed) return;
    resolvedRef.current = trimmed;
    setIsResolving(true);

    verify.mutate(trimmed, {
      onSuccess: (result) => {
        const username = result.verify?.getMe?.username;
        if (result.verify?.getMe?.ok && username) {
          setLabel(telegramBotDisplayLabel(username));
        } else {
          setLabel(undefined);
        }
      },
      onError: () => setLabel(undefined),
      onSettled: () => setIsResolving(false),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resolve once per distinct token
  }, [botToken]);

  return { label, isResolving };
}
