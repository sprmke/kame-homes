import { statusLabel, statusTone } from '@/features/dashboard/bookings/lib/bookingStatus';

import { STATUS_TONE_STYLES, type StatusToneStyle } from '@/lib/statusToneColors';
import { cn } from '@/lib/utils';

export { STATUS_TONE_STYLES, type StatusToneStyle };

export function statusToneStyle(status: string): StatusToneStyle {
  return STATUS_TONE_STYLES[statusTone(status)];
}

type Props = {
  status: string;
  className?: string;
};

export function StatusBadge({ status, className }: Props) {
  const label = statusLabel(status);
  const style = statusToneStyle(status);

  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-0.5',
        'whitespace-nowrap text-xs font-medium leading-tight',
        style.badge,
        className
      )}
    >
      <span
        aria-hidden
        className={cn(
          'size-1.5 shrink-0 rounded-full',
          style.dot,
          style.pulse && 'motion-safe:animate-pulse'
        )}
      />
      <span className="truncate">{label}</span>
    </span>
  );
}
