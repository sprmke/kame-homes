import type { CalendarOccupancySpanPosition } from '@/features/dashboard/bookings/components/calendar/calendarDateUtils';
import { GuestAvatar } from '@/features/dashboard/bookings/components/GuestAvatar';
import { statusLabel } from '@/features/dashboard/bookings/lib/bookingStatus';

import { cn } from '@/lib/utils';

type Props = {
  status: string;
  label: string;
  title?: string;
  spanPosition?: CalendarOccupancySpanPosition;
  showLabel?: boolean;
  guestName?: string;
  validIdUrl?: string | null;
};

export function PricingCalendarBookingPill({
  status,
  label,
  title,
  spanPosition = 'single',
  showLabel = true,
  guestName,
  validIdUrl,
}: Props) {
  const isCancelled = status === 'CANCELLED' || status === 'canceled';
  const roundedClass =
    spanPosition === 'start'
      ? 'rounded-l-full rounded-r-sm'
      : spanPosition === 'end'
        ? 'rounded-r-full rounded-l-sm'
        : spanPosition === 'middle'
          ? 'rounded-sm'
          : 'rounded-full';

  return (
    <div
      className={cn(
        /* Phone cells are short — keep pills in the ~20–22px band used by bookings calendar. */
        'flex h-5 w-full min-w-0 items-center shadow-sm sm:h-[22px]',
        'ring-1',
        isCancelled
          ? 'bg-muted text-muted-foreground ring-border'
          : 'bg-primary-strong text-primary-foreground ring-primary/25',
        roundedClass
      )}
      title={title ?? `${label} · ${statusLabel(status)}`}
    >
      {showLabel ? (
        <span className="flex min-w-0 items-center gap-1 py-0 pl-0.5 pr-1.5 sm:gap-1.5 sm:pr-2">
          <GuestAvatar
            name={guestName || label}
            validIdUrl={validIdUrl}
            size="xs"
            className={cn(
              '!size-3.5 !text-[8px] sm:!size-4 sm:!text-[9px]',
              isCancelled
                ? 'ring-border shadow-sm ring-1'
                : 'ring-primary-foreground/35 shadow-sm ring-1'
            )}
          />
          <span className="truncate text-[10px] font-semibold leading-none tracking-tight sm:text-[11px]">
            {label}
          </span>
        </span>
      ) : (
        <span aria-hidden className="block h-full w-full min-w-[0.5rem]" />
      )}
    </div>
  );
}
