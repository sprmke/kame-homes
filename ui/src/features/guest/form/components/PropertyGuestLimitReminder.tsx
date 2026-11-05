import { Info } from 'lucide-react';

import {
  buildGuestLimitMessage,
  type PropertyGuestCapacity,
} from '@/features/guest/form/lib/guestCounts';

import { cn } from '@/lib/utils';

type PropertyGuestLimitReminderProps = {
  capacity: PropertyGuestCapacity;
  partySize?: number;
  className?: string;
};

export function PropertyGuestLimitReminder({
  capacity,
  partySize = 0,
  className,
}: PropertyGuestLimitReminderProps) {
  const message = buildGuestLimitMessage(capacity, partySize);

  return (
    <div
      role="status"
      className={cn(
        'flex gap-3 rounded-xl border border-amber-500/35 bg-amber-500/[0.07] p-4 sm:gap-4',
        'dark:border-amber-500/25 dark:bg-amber-500/10',
        className
      )}
    >
      <div
        className="public-icon-well bg-amber-500/15 text-amber-700 dark:text-amber-400"
        aria-hidden
      >
        <Info className="size-4" />
      </div>
      <div className="min-w-0 space-y-2">
        <p className="text-foreground text-sm font-semibold leading-snug">
          Maximum Guests Reminder
        </p>
        <p className="text-muted-foreground text-sm leading-relaxed">{message}</p>
      </div>
    </div>
  );
}
