import * as React from 'react';

import { Loader2, ScanSearch } from 'lucide-react';
import { toast } from 'sonner';

import { TelegramHelpDialog } from '@/features/dashboard/bookings/components/telegram-notifications/TelegramHelpDialog';
import { TelegramSecretInput } from '@/features/dashboard/bookings/components/telegram-notifications/TelegramSecretInput';
import { useDiscoverTelegramChats } from '@/features/dashboard/bookings/hooks/useDiscoverTelegramChats';
import { formatTelegramChatTypeLabel } from '@/features/dashboard/bookings/lib/telegramDiscoverChats';
import { SETTINGS_FIELD_LABEL_COMPACT } from '@/features/dashboard/org/lib/settingsFieldLabel';

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { friendlyToastError } from '@/lib/feedback/toastMessages';
import { cn } from '@/lib/utils';

type Props = {
  id: string;
  botToken: string;
  chatId: string;
  placeholder: string;
  disabled?: boolean;
  allowScan?: boolean;
  maskedLabel?: string;
  labelLoading?: boolean;
  onChange: (chatId: string) => void;
  className?: string;
};

export function TelegramChatIdField({
  id,
  botToken,
  chatId,
  placeholder,
  disabled,
  allowScan = true,
  maskedLabel,
  labelLoading = false,
  onChange,
  className,
}: Props) {
  const discover = useDiscoverTelegramChats();
  const rescanPendingRef = React.useRef(false);
  const [pickedLabel, setPickedLabel] = React.useState<string | undefined>();
  const trimmedToken = botToken.trim();
  const hasValue = chatId.trim().length > 0;
  const canScan = allowScan && !hasValue && Boolean(trimmedToken) && !disabled;

  const chats = discover.data?.chats ?? [];
  const hasScanned = discover.isSuccess || discover.isError;
  const showPicker = canScan && hasScanned && chats.length > 0 && !discover.isPending;

  const runScan = React.useCallback(
    (token: string) => {
      discover.mutate(token, {
        onSuccess: (data) => {
          const message = data?.error ?? data?.getMe?.error;
          if (message) {
            toast.error(friendlyToastError(message, 'Could not scan for Telegram groups'));
            return;
          }

          const results = data?.chats ?? [];
          if (results.length === 0) {
            toast.error(
              data?.hint ??
                'No group chats found. Make sure the bot is added to your group, send a test message, then scan again.'
            );
          }
        },
        onError: (e) => {
          toast.error(friendlyToastError(e, 'Could not scan for Telegram groups'));
        },
      });
    },
    [discover]
  );

  React.useEffect(() => {
    if (!chatId.trim()) setPickedLabel(undefined);
  }, [chatId]);

  React.useEffect(() => {
    discover.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset scan results when bot token changes
  }, [trimmedToken]);

  React.useEffect(() => {
    if (chatId.trim()) return;

    if (rescanPendingRef.current && trimmedToken && allowScan && !disabled) {
      rescanPendingRef.current = false;
      runScan(trimmedToken);
      return;
    }

    discover.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rescan vs reset when chat id cleared
  }, [chatId, trimmedToken, allowScan, disabled]);

  const onScan = () => {
    if (!trimmedToken || discover.isPending || disabled) return;
    if (!allowScan) return;
    runScan(trimmedToken);
  };

  const onRescan = () => {
    if (disabled || !allowScan || !trimmedToken) return;
    rescanPendingRef.current = true;
    onChange('');
  };

  const onPickChat = (value: string) => {
    const chat = chats.find((entry) => entry.chatId === value);
    setPickedLabel(chat?.title);
    onChange(value);
  };

  const resolvedMaskedLabel = maskedLabel ?? pickedLabel;

  if (hasValue || !allowScan) {
    return (
      <TelegramSecretInput
        id={id}
        label="Chat ID"
        value={chatId}
        disabled={disabled}
        helpTab="chat-id"
        maskedLabel={resolvedMaskedLabel}
        labelLoading={labelLoading && !resolvedMaskedLabel}
        placeholder={placeholder}
        onChange={onChange}
        secondaryAction={
          allowScan && !disabled
            ? { label: 'Rescan', ariaLabel: 'Rescan for Telegram groups', onClick: onRescan }
            : undefined
        }
        className={className}
      />
    );
  }

  return (
    <div className={cn('min-w-0 space-y-1.5', className)}>
      <div className="flex items-center gap-0.5">
        <Label htmlFor={id} className={SETTINGS_FIELD_LABEL_COMPACT}>
          Chat ID
        </Label>
        <TelegramHelpDialog defaultTab="chat-id" variant="icon" />
      </div>

      {showPicker ? (
        <Select disabled={disabled} onValueChange={onPickChat}>
          <SelectTrigger id={id} className="h-10 px-3 text-sm font-normal">
            <SelectValue placeholder="Select a group" />
          </SelectTrigger>
          <SelectContent className="max-w-[min(calc(100vw-24px),24rem)]">
            {chats.map((chat) => (
              <SelectItem key={chat.chatId} value={chat.chatId}>
                {chat.title} · {formatTelegramChatTypeLabel(chat.type)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <div className="relative">
          <div
            className={cn(
              'border-input bg-background text-muted-foreground flex h-10 w-full min-w-0 items-center rounded-lg border px-3 text-sm',
              canScan && 'pr-[5rem]',
              disabled && 'cursor-not-allowed opacity-50'
            )}
          >
            {discover.isPending ? (
              <span className="inline-flex min-w-0 items-center gap-2">
                <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                <span className="truncate">Scanning…</span>
              </span>
            ) : (
              <span className="truncate">
                {!trimmedToken ? 'Add bot token first' : 'Scan to find chats'}
              </span>
            )}
          </div>
          {canScan && !discover.isPending ? (
            <button
              type="button"
              disabled={disabled}
              aria-label="Scan for Telegram groups"
              onClick={onScan}
              className="text-muted-foreground hover:text-foreground absolute right-0 top-0 inline-flex h-10 min-w-[44px] items-center justify-center gap-1.5 rounded-r-lg px-2.5 text-xs font-medium transition-colors disabled:pointer-events-none disabled:opacity-50"
            >
              <ScanSearch className="size-3.5 shrink-0" aria-hidden />
              Scan
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
