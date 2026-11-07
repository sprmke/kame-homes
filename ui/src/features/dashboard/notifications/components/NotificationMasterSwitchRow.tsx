import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

import type { LucideIcon } from 'lucide-react';

type Props = {
  icon: LucideIcon;
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Surface overrides, e.g. `bg-card` when the row sits on a page card. */
  className?: string;
  /** Description tone, e.g. `text-destructive` for "this browser can't do it". */
  descriptionClassName?: string;
};

/**
 * One bordered master control for a delivery channel (this device, Telegram).
 * Activity and Telegram use the same row so the two tabs read as one page.
 */
export function NotificationMasterSwitchRow({
  icon: Icon,
  title,
  description,
  checked,
  disabled,
  onCheckedChange,
  className,
  descriptionClassName,
}: Props) {
  return (
    <div
      className={cn(
        /* Always a card surface: on/off is carried by the switch, not a tint. */
        'border-border bg-card flex items-center justify-between gap-3 rounded-xl border px-3 py-3 sm:px-4',
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-lg">
          <Icon className="size-3.5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-foreground text-[13px] font-semibold leading-tight sm:text-sm">
            {title}
          </p>
          <p className={cn('text-card-description mt-0.5', descriptionClassName)}>{description}</p>
        </div>
      </div>
      <Switch
        aria-label={title}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}
