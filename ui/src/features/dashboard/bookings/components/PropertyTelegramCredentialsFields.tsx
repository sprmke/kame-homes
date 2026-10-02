import * as React from 'react';

import { toast } from 'sonner';

import { TelegramChatIdField } from '@/features/dashboard/bookings/components/telegram-notifications/TelegramChatIdField';
import {
  telegramBotTokenPlaceholder,
  telegramChatIdPlaceholder,
} from '@/features/dashboard/bookings/components/telegram-notifications/telegramCredentials';
import { useTelegramNotificationsGlobalBot } from '@/features/dashboard/bookings/components/telegram-notifications/TelegramNotificationsGlobalBotContext';
import { TelegramSecretInput } from '@/features/dashboard/bookings/components/telegram-notifications/TelegramSecretInput';
import type { PropertyTelegramCredentialsStatus } from '@/features/dashboard/bookings/hooks/useAppSettings';
import { useVerifyTelegramGlobalBotToken } from '@/features/dashboard/bookings/hooks/useTelegramGlobalBotToken';
import {
  telegramBotDisplayLabel,
  type TelegramConnectionLabels,
} from '@/features/dashboard/bookings/lib/telegramConnectionLabels';

import { friendlyToastError } from '@/lib/feedback/toastMessages';
import { cn } from '@/lib/utils';

export type { PropertyTelegramCredentialsStatus };

function resolveBotMaskedLabel(
  botToken: string,
  connectionLabels: TelegramConnectionLabels | undefined,
  globalBot: { token: string; label: string },
  validatedBotLabel?: string
): string | undefined {
  if (connectionLabels?.botLabel) return connectionLabels.botLabel;
  if (validatedBotLabel) return validatedBotLabel;
  const trimmed = botToken.trim();
  if (trimmed && trimmed === globalBot.token.trim() && globalBot.label) {
    return globalBot.label;
  }
  return undefined;
}

interface PropertyTelegramCredentialsFieldsProps {
  botToken: string;
  chatId: string;
  status?: PropertyTelegramCredentialsStatus;
  connectionLabels?: TelegramConnectionLabels;
  chatLabelLoading?: boolean;
  disabled?: boolean;
  onBotTokenChange: (value: string) => void;
  onChatIdChange: (value: string) => void;
  onBotTokenValidated?: () => void;
  idPrefix?: string;
  connectAction?: React.ReactNode;
  /** Inline scan + group picker while setup is incomplete. */
  allowChatScan?: boolean;
  className?: string;
}

export function PropertyTelegramCredentialsFields({
  botToken,
  chatId,
  status,
  connectionLabels,
  chatLabelLoading = false,
  disabled,
  onBotTokenChange,
  onChatIdChange,
  onBotTokenValidated,
  idPrefix = 'telegram',
  connectAction,
  allowChatScan = true,
  className,
}: PropertyTelegramCredentialsFieldsProps) {
  const globalBot = useTelegramNotificationsGlobalBot();
  const verifyBot = useVerifyTelegramGlobalBotToken();
  const [committedBotToken, setCommittedBotToken] = React.useState('');
  const [validatedBotLabel, setValidatedBotLabel] = React.useState<string | undefined>();

  const credentialsSyncKey = [
    status?.tokenConfigured,
    status?.botToken,
    status?.chatId,
    globalBot.token,
  ].join('|');

  React.useEffect(() => {
    setCommittedBotToken(botToken.trim());
    setValidatedBotLabel(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when server credentials reload
  }, [credentialsSyncKey]);

  const botTokenId = `${idPrefix}-bot-token`;
  const chatIdId = `${idPrefix}-chat-id`;

  const trimmedBotToken = botToken.trim();
  const botTokenDirty = trimmedBotToken !== committedBotToken.trim();
  const usesGlobalToken = trimmedBotToken.length > 0 && trimmedBotToken === globalBot.token.trim();

  const botMaskedLabel = botTokenDirty
    ? undefined
    : resolveBotMaskedLabel(botToken, connectionLabels, globalBot, validatedBotLabel);

  const botLabelLoading = Boolean(
    !botTokenDirty &&
    trimmedBotToken &&
    !botMaskedLabel &&
    usesGlobalToken &&
    globalBot.labelResolving
  );

  const onBotTokenSave = () => {
    if (!trimmedBotToken || verifyBot.isPending || disabled) return;

    verifyBot.mutate(trimmedBotToken, {
      onSuccess: (result) => {
        const getMe = result.verify?.getMe;
        if (!getMe?.ok) {
          toast.error(
            friendlyToastError(
              getMe?.error,
              'Invalid bot token. Please double-check your token and try again.'
            )
          );
          return;
        }

        const label = telegramBotDisplayLabel(getMe.username);
        setCommittedBotToken(trimmedBotToken);
        setValidatedBotLabel(label);
        if (chatId.trim()) onChatIdChange('');
        onBotTokenValidated?.();
      },
      onError: (e) => {
        toast.error(friendlyToastError(e, 'Could not verify bot token'));
      },
    });
  };

  const handleBotTokenChange = (value: string) => {
    const willBeDirty = value.trim() !== committedBotToken.trim();
    onBotTokenChange(value);
    if (
      willBeDirty &&
      (chatId.trim() || connectionLabels?.chatLabel || connectionLabels?.botLabel)
    ) {
      onChatIdChange('');
      onBotTokenValidated?.();
    }
  };

  const chatMaskedLabel = botTokenDirty ? undefined : connectionLabels?.chatLabel;
  const chatFieldLabelLoading = Boolean(
    !botTokenDirty && chatId.trim() && !chatMaskedLabel && chatLabelLoading
  );

  return (
    <div className={cn('@container space-y-3', className)}>
      <div className="@lg:grid-cols-2 @lg:items-end @2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] grid grid-cols-1 gap-3">
        <TelegramSecretInput
          id={botTokenId}
          label="Bot token"
          value={botToken}
          disabled={disabled || verifyBot.isPending}
          helpTab="bot-token"
          defaultVisible
          maskedLabel={botMaskedLabel}
          labelLoading={botLabelLoading}
          dirty={botTokenDirty}
          commitPending={verifyBot.isPending}
          onCommit={onBotTokenSave}
          placeholder={telegramBotTokenPlaceholder(Boolean(status?.tokenConfigured))}
          onChange={handleBotTokenChange}
        />

        <TelegramChatIdField
          id={chatIdId}
          botToken={botToken}
          chatId={chatId}
          disabled={disabled || botTokenDirty}
          allowScan={allowChatScan}
          maskedLabel={chatMaskedLabel}
          labelLoading={chatFieldLabelLoading}
          placeholder={telegramChatIdPlaceholder(Boolean(status?.chatIdConfigured))}
          onChange={onChatIdChange}
        />

        {connectAction ? (
          <div className="@lg:col-span-2 @lg:justify-self-end @2xl:col-span-1 min-w-0">
            {connectAction}
          </div>
        ) : null}
      </div>
    </div>
  );
}
