import { daysLeftInReviewWindow } from '@/features/reviews/lib/reviewWindow';

import { cn } from '@/lib/utils';

export interface ReviewWindowBadgeProps {
  closesAt: string | null | undefined;
  className?: string;
}

/** Compact "N days left" / "Closed" chip for review windows. */
export function ReviewWindowBadge({ closesAt, className }: ReviewWindowBadgeProps) {
  const daysLeft = daysLeftInReviewWindow(closesAt);
  if (daysLeft == null) return null;

  const closed = daysLeft <= 0;
  const label = closed ? 'Closed' : daysLeft === 1 ? '1 day left' : `${daysLeft} days left`;

  return (
    <span
      className={cn(
        'inline-flex min-h-[28px] items-center rounded-full px-2.5 text-xs font-medium',
        closed
          ? 'bg-muted text-muted-foreground'
          : 'bg-amber-50 text-amber-950 dark:bg-amber-500/15 dark:text-amber-100',
        className
      )}
    >
      {label}
    </span>
  );
}
