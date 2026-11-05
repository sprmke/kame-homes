import { daysLeftInReviewWindow } from '@/features/reviews/lib/reviewWindow';

import { cn } from '@/lib/utils';

/** Inside this many days the chip turns amber so the queue reads by urgency. */
const URGENT_DAYS = 3;

export interface ReviewWindowBadgeProps {
  closesAt: string | null | undefined;
  className?: string;
}

/** Compact "N days left" / "Closed" chip for review windows. */
export function ReviewWindowBadge({ closesAt, className }: ReviewWindowBadgeProps) {
  const daysLeft = daysLeftInReviewWindow(closesAt);
  if (daysLeft == null) return null;

  const closed = daysLeft <= 0;
  const urgent = !closed && daysLeft <= URGENT_DAYS;
  const label = closed ? 'Closed' : daysLeft === 1 ? '1 day left' : `${daysLeft} days left`;

  return (
    <span
      className={cn(
        'inline-flex min-h-[24px] items-center rounded-full px-2.5 text-xs font-medium',
        urgent
          ? 'bg-amber-50 text-amber-950 dark:bg-amber-500/15 dark:text-amber-100'
          : 'bg-muted text-muted-foreground',
        className
      )}
    >
      {label}
    </span>
  );
}
