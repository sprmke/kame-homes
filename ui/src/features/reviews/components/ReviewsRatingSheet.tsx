import { RatingStars } from '@/features/reviews/components/RatingStars';
import {
  formatReviewAverage,
  type PropertyReviewSummary,
} from '@/features/reviews/lib/propertyReviewsApi';
import {
  GUEST_REVIEW_CATEGORY_IDS,
  GUEST_REVIEW_CATEGORY_LABELS,
} from '@/features/reviews/lib/reviewCatalog';

import { AdminDialogShell } from '@/components/AdminDialogShell';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const STAR_ROWS = [5, 4, 3, 2, 1] as const;

function Meter({ ratio, className }: { ratio: number; className?: string }) {
  const pct = Math.max(0, Math.min(1, ratio)) * 100;
  return (
    <span className={cn('bg-muted block h-1.5 overflow-hidden rounded-full', className)}>
      <span
        className="bg-primary block h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none"
        style={{ width: `${pct}%` }}
      />
    </span>
  );
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: PropertyReviewSummary | undefined;
};

/**
 * Star distribution and the six guest category averages. Opened from the
 * Average rating KPI card so the list page keeps the standard
 * cards → toolbar → table order.
 */
export function ReviewsRatingSheet({ open, onOpenChange, summary }: Props) {
  const max = Math.max(1, ...STAR_ROWS.map((star) => summary?.distribution?.[`${star}`] ?? 0));
  const rated = GUEST_REVIEW_CATEGORY_IDS.filter((id) => summary?.categoryAvgs?.[id] != null);

  return (
    <AdminDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Rating breakdown"
      footer={
        <Button
          type="button"
          variant="outline"
          className="min-h-[44px]"
          onClick={() => onOpenChange(false)}
        >
          Close
        </Button>
      }
    >
      <div className="space-y-5">
        <div className="flex items-center gap-4">
          <p className="text-foreground text-[28px] font-bold tabular-nums leading-none tracking-tight">
            {formatReviewAverage(summary?.avgOverall)}
          </p>
          <div className="min-w-0">
            <RatingStars value={summary?.avgOverall ?? 0} />
            <p className="text-caption mt-1">{summary?.count ?? 0} published</p>
          </div>
        </div>

        <ul className="space-y-1.5">
          {STAR_ROWS.map((star) => {
            const value = summary?.distribution?.[`${star}`] ?? 0;
            return (
              <li key={star} className="flex items-center gap-2.5">
                <span className="text-muted-foreground w-2 text-xs font-medium tabular-nums">
                  {star}
                </span>
                <Meter ratio={value / max} className="min-w-0 flex-1" />
                <span className="text-muted-foreground w-7 text-right text-xs tabular-nums">
                  {value}
                </span>
              </li>
            );
          })}
        </ul>

        {rated.length > 0 ? (
          <div className="border-border/60 border-t pt-4">
            <p className="text-muted-foreground mb-2.5 text-xs font-semibold">Categories</p>
            <ul className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
              {rated.map((id) => {
                const value = Number(summary?.categoryAvgs[id]);
                return (
                  <li key={id} className="flex items-center gap-3">
                    <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs sm:text-[13px]">
                      {GUEST_REVIEW_CATEGORY_LABELS[id]}
                    </span>
                    <Meter ratio={value / 5} className="hidden h-1 w-12 shrink-0 sm:block" />
                    <span className="text-foreground w-6 text-right text-xs font-semibold tabular-nums">
                      {formatReviewAverage(value)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </AdminDialogShell>
  );
}
