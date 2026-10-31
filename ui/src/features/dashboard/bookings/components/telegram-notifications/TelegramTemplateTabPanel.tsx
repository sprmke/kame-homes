import { TelegramToggleRow } from '@/features/dashboard/bookings/components/telegram-notifications/TelegramToggleRow';

import { cn } from '@/lib/utils';

export type TelegramTemplateAlertControl = {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
};

type Props = {
  alert?: TelegramTemplateAlertControl;
  /** Read-only trigger line when there is no per-event toggle. */
  hint?: string;
  children: React.ReactNode;
  className?: string;
};

export function TelegramTemplateTabPanel({ alert, hint, children, className }: Props) {
  const showBar = alert || hint;

  return (
    <div className={cn('space-y-3', className)}>
      {showBar ? (
        <div className="border-border/50 bg-muted/15 rounded-lg border px-3 py-2">
          {alert ? (
            <TelegramToggleRow
              id={alert.id}
              label={alert.label}
              hint={alert.hint}
              checked={alert.checked}
              disabled={alert.disabled}
              compact
              onChange={alert.onChange}
            />
          ) : hint ? (
            <p className="text-muted-foreground text-xs leading-snug">{hint}</p>
          ) : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}
