import * as React from 'react';

import {
  TelegramHelpDialog,
  type TelegramHelpTab,
} from '@/features/dashboard/bookings/components/telegram-notifications/TelegramHelpDialog';
import { SETTINGS_FIELD_LABEL_COMPACT } from '@/features/dashboard/org/lib/settingsFieldLabel';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type TelegramSecretInputProps = {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  disabled?: boolean;
  helpTab?: TelegramHelpTab;
  /** Friendly label when hidden (e.g. group title). Ignored when defaultVisible (password hide). */
  maskedLabel?: string;
  /** Show skeleton while resolving maskedLabel. */
  labelLoading?: boolean;
  /** Optional action shown beside Reveal/Hide (e.g. Rescan). */
  secondaryAction?: {
    label: string;
    ariaLabel?: string;
    onClick: () => void;
  };
  /** Unsaved edits — show raw value and a Save action instead of Reveal/Hide. */
  dirty?: boolean;
  /**
   * Bot tokens: start visible; Hide/Show is a password-style view toggle (field stays editable).
   * Chat IDs: omit — Hide uses friendly label + Reveal for the raw id.
   */
  defaultVisible?: boolean;
  /** Async commit in progress (Save / validate). */
  commitPending?: boolean;
  onCommit?: () => void;
  onChange: (value: string) => void;
  className?: string;
};

export function TelegramSecretInput({
  id,
  label,
  value,
  placeholder,
  disabled,
  helpTab,
  maskedLabel,
  labelLoading = false,
  secondaryAction,
  dirty = false,
  defaultVisible = false,
  commitPending = false,
  onCommit,
  onChange,
  className,
}: TelegramSecretInputProps) {
  const [visible, setVisible] = React.useState(defaultVisible);

  React.useEffect(() => {
    if (!dirty) setVisible(defaultVisible);
  }, [dirty, defaultVisible]);

  const hasValue = value.trim().length > 0;
  const editing = dirty;
  const obscure = hasValue && !visible && !editing;
  /** Password-style hide (bot tokens) — keep editing the real value. */
  const passwordMode = obscure && defaultVisible;
  /** Friendly label (chat IDs) — read-only until Reveal. */
  const showFriendlyLabel = obscure && !defaultVisible && Boolean(maskedLabel);
  const showSkeleton =
    commitPending || (obscure && !defaultVisible && !maskedLabel && labelLoading);
  const displayValue = showFriendlyLabel ? maskedLabel! : value;
  const toggleLabel = visible ? 'Hide' : showFriendlyLabel || maskedLabel ? 'Reveal' : 'Show';
  const showActions = hasValue && !showSkeleton;
  const showSave = editing && Boolean(onCommit);
  const showSecondary = Boolean(secondaryAction && !showSave && visible);
  const inputPadding =
    showActions && showSecondary ? 'pr-[8.75rem]' : showActions ? 'pr-[3.5rem]' : undefined;

  return (
    <div className={cn('min-w-0 space-y-1.5', className)}>
      <div className="flex items-center gap-0.5">
        <Label htmlFor={id} className={SETTINGS_FIELD_LABEL_COMPACT}>
          {label}
        </Label>
        {helpTab ? <TelegramHelpDialog defaultTab={helpTab} variant="icon" /> : null}
      </div>
      <div className="relative">
        {showSkeleton ? (
          <div
            className={cn(
              'border-input bg-background flex h-9 w-full items-center rounded-lg border px-3 sm:h-10',
              disabled && 'cursor-not-allowed opacity-50'
            )}
            aria-hidden
          >
            <Skeleton className="h-4 w-[min(100%,11rem)]" />
          </div>
        ) : (
          <Input
            id={id}
            type={passwordMode ? 'password' : 'text'}
            autoComplete="off"
            value={displayValue}
            readOnly={showFriendlyLabel}
            disabled={disabled}
            placeholder={placeholder}
            onChange={(e) => {
              if (showFriendlyLabel) return;
              onChange(e.target.value);
            }}
            className={cn(
              'h-9 text-sm sm:h-10',
              inputPadding,
              showFriendlyLabel && 'text-foreground cursor-default'
            )}
          />
        )}
        {showActions ? (
          <div className="absolute right-0 top-0 flex h-9 items-center sm:h-10">
            {showSecondary ? (
              <button
                type="button"
                disabled={disabled}
                aria-label={secondaryAction!.ariaLabel ?? secondaryAction!.label}
                onClick={secondaryAction!.onClick}
                className="text-muted-foreground hover:text-foreground flex h-9 min-w-[40px] items-center justify-center px-2 text-[11px] font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 sm:h-10 sm:min-w-[44px] sm:text-xs"
              >
                {secondaryAction!.label}
              </button>
            ) : null}
            {showSave ? (
              <button
                type="button"
                disabled={disabled || commitPending}
                aria-label={`Save ${label}`}
                onClick={onCommit}
                className="text-muted-foreground hover:text-foreground flex h-9 min-w-[40px] items-center justify-center rounded-r-lg px-2 text-[11px] font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 sm:h-10 sm:min-w-[44px] sm:px-2.5 sm:text-xs"
              >
                Save
              </button>
            ) : (
              <button
                type="button"
                disabled={disabled}
                aria-label={visible ? `Hide ${label}` : `Show ${label}`}
                onClick={() => setVisible((v) => !v)}
                className="text-muted-foreground hover:text-foreground flex h-9 min-w-[40px] items-center justify-center rounded-r-lg px-2 text-[11px] font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 sm:h-10 sm:min-w-[44px] sm:px-2.5 sm:text-xs"
              >
                {toggleLabel}
              </button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
