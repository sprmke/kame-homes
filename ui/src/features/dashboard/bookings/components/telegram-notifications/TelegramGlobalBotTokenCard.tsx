import * as React from 'react';

import { Activity, Bot, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

import { telegramBotTokenPlaceholder } from '@/features/dashboard/bookings/components/telegram-notifications/telegramCredentials';
import { TelegramSecretInput } from '@/features/dashboard/bookings/components/telegram-notifications/TelegramSecretInput';
import { useFirstConnectedTelegramModuleToken } from '@/features/dashboard/bookings/hooks/useFirstConnectedTelegramModuleToken';
import { useTelegramBotDisplayLabel } from '@/features/dashboard/bookings/hooks/useTelegramBotDisplayLabel';
import {
  useTelegramGlobalBotToken,
  useUpdateTelegramGlobalBotToken,
  useVerifyTelegramGlobalBotToken,
} from '@/features/dashboard/bookings/hooks/useTelegramGlobalBotToken';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { friendlyToastError } from '@/lib/feedback/toastMessages';

export function TelegramGlobalBotTokenCard() {
  const { data, isLoading } = useTelegramGlobalBotToken();
  const save = useUpdateTelegramGlobalBotToken();
  const verify = useVerifyTelegramGlobalBotToken();
  const [botToken, setBotToken] = React.useState('');
  const connectedModule = useFirstConnectedTelegramModuleToken();

  const serverToken = data?.botToken ?? '';
  const { label, isResolving } = useTelegramBotDisplayLabel(botToken);

  React.useEffect(() => {
    setBotToken(serverToken);
  }, [serverToken]);

  const busy = isLoading || save.isPending || verify.isPending;
  const trimmed = botToken.trim();
  const dirty = trimmed !== serverToken.trim();
  const saved = Boolean(data?.tokenConfigured) && !dirty && Boolean(trimmed);
  const showModuleSuggestion =
    !isLoading && !busy && !trimmed && !dirty && Boolean(connectedModule);

  const onSaveAndTest = () => {
    if (!trimmed) {
      toast.error('Enter a bot token first');
      return;
    }

    verify.mutate(trimmed, {
      onSuccess: (result) => {
        const ok = Boolean(result.verify?.getMe?.ok);
        if (!ok) {
          toast.error(
            friendlyToastError(
              result.verify?.getMe?.error,
              'Invalid bot token. Please double-check your token and try again.'
            )
          );
          return;
        }

        save.mutate(trimmed, {
          onSuccess: () => {
            const username = result.verify?.getMe?.username;
            toast.success(username ? `Saved (@${username})` : 'Shared bot token saved');
          },
          onError: (e) => toast.error(friendlyToastError(e, 'Could not save shared bot token')),
        });
      },
      onError: (e) => {
        toast.error(friendlyToastError(e, 'Could not verify bot token'));
      },
    });
  };

  const actionLabel = verify.isPending ? 'Testing…' : save.isPending ? 'Saving…' : 'Save and test';

  return (
    <Card id="section-global-bot" className="scroll-mt-2">
      <CardHeader className="space-y-0">
        <CardTitle className="flex items-center gap-2">
          <Bot className="size-4 shrink-0" aria-hidden />
          Shared bot token
        </CardTitle>
        <CardDescription className="pt-1">
          One token for all modules by default. You can still configure a different bot & chat ID
          per module if needed.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-10 w-full max-w-xl" aria-label="Loading shared bot token" />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <TelegramSecretInput
              id="global-bot-token"
              label="Bot token"
              value={botToken}
              disabled={busy}
              helpTab="bot-token"
              defaultVisible
              maskedLabel={label}
              labelLoading={isResolving}
              placeholder={telegramBotTokenPlaceholder(Boolean(data?.tokenConfigured))}
              onChange={setBotToken}
            />

            {saved ? (
              <span className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-emerald-600 md:justify-self-end">
                <CheckCircle2 className="size-4 shrink-0" aria-hidden />
                Saved
              </span>
            ) : (
              <Button
                type="button"
                disabled={busy || !trimmed}
                className="min-h-[44px] w-full gap-2 md:w-auto md:min-w-[7.5rem] md:justify-self-end"
                onClick={onSaveAndTest}
              >
                {busy ? <Activity className="size-4 shrink-0 animate-pulse" aria-hidden /> : null}
                {actionLabel}
              </Button>
            )}

            {showModuleSuggestion && connectedModule ? (
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground -mt-1 w-fit py-2 text-left text-sm underline underline-offset-4 md:col-span-2"
                onClick={() => setBotToken(connectedModule.token)}
              >
                Use the token from {connectedModule.moduleLabel} notifications
              </button>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
