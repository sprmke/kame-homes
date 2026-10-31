import {
  STATUS_TONE_STYLES,
  type StatusToneStyle,
} from '@/features/dashboard/bookings/components/StatusBadge';
import type { StatusTone } from '@/features/dashboard/bookings/lib/bookingStatus';

import { cn } from '@/lib/utils';

type Props = {
  label: string;
  title?: string;
  tone?: StatusTone;
  labelClassName?: string;
};

export function CalendarDatePill({ label, title, tone = 'neutral', labelClassName }: Props) {
  const style: StatusToneStyle = STATUS_TONE_STYLES[tone];
  return (
    <div
      className={cn(
        'flex min-w-0 items-center gap-1 truncate rounded-md border px-1.5 py-0.5',
        'text-[10px] font-semibold leading-tight',
        style.badge
      )}
      title={title ?? label}
    >
      <span
        aria-hidden
        className={cn(
          'size-1.5 shrink-0 rounded-full',
          style.dot,
          style.pulse && 'motion-safe:animate-pulse'
        )}
      />
      <span className={cn('truncate', labelClassName)}>{label}</span>
    </div>
  );
}
