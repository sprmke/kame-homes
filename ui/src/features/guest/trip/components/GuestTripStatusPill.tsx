import type { GuestTripTone } from '@/features/guest/trip/lib/guestTripPhase';

import { cn } from '@/lib/utils';

/**
 * Color lives in the dot only: hosts pick their own brand color, and light brands (mint,
 * yellow) fail contrast as text. The label always uses the foreground token.
 */
const DOT_CLASS: Record<GuestTripTone, string> = {
  neutral: 'bg-foreground/50',
  info: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  muted: 'bg-muted-foreground/60',
};

export function GuestTripStatusPill({
  label,
  tone,
  className,
}: {
  label: string;
  tone: GuestTripTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'bg-background/80 text-foreground ring-border inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold leading-none ring-1',
        className
      )}
    >
      <span className={cn('size-1.5 rounded-full', DOT_CLASS[tone])} aria-hidden />
      {label}
    </span>
  );
}
