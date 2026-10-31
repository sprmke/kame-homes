import { planDiscountLabel, type PlanPrice } from '@/features/dashboard/plans/lib/planPresentation';

import { cn } from '@/lib/utils';

type PlanPriceLineProps = {
  price: PlanPrice;
  /** `card` = tier card headline; `compact` = matrix header / summary. */
  variant?: 'card' | 'compact';
  className?: string;
};

const COMPACT_COMPARE_ROW_MIN_H = 'min-h-[1.125rem]';

function PlanDiscountPill({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={cn(
        'bg-primary/10 text-primary shrink-0 whitespace-nowrap rounded-full px-1.5 font-semibold tabular-nums leading-4',
        className
      )}
    >
      {label}
    </span>
  );
}

/** Keeps ₱0/month aligned with discounted tiers in the plan rail and compare matrix. */
export function PlanPriceLine({ price, variant = 'card', className }: PlanPriceLineProps) {
  const discountPercent = price.discountPercent ?? 0;
  const discountLabel =
    price.compareAtAmount && discountPercent > 0 ? planDiscountLabel(discountPercent) : null;
  const hasCompareRow = Boolean(price.compareAtAmount && discountLabel);

  if (variant === 'compact') {
    return (
      <div className={cn('flex w-full flex-col items-center gap-1', className)}>
        {hasCompareRow ? (
          <div
            className={cn(
              'flex max-w-full flex-nowrap items-center justify-center gap-1',
              COMPACT_COMPARE_ROW_MIN_H
            )}
          >
            <span className="text-muted-foreground shrink-0 text-[11px] font-medium tabular-nums line-through">
              {price.compareAtAmount}
            </span>
            <PlanDiscountPill label={discountLabel!} className="text-[10px]" />
          </div>
        ) : (
          <div className={COMPACT_COMPARE_ROW_MIN_H} aria-hidden />
        )}

        <p className="flex flex-nowrap items-baseline justify-center gap-0.5 sm:gap-1">
          <span className="text-foreground text-xs font-semibold tabular-nums tracking-tight sm:text-sm">
            {price.amount}
          </span>
          {price.suffix ? (
            <span className="text-muted-foreground text-[10px] font-medium sm:text-xs">
              {price.suffix}
            </span>
          ) : null}
        </p>
      </div>
    );
  }

  const amountClass = 'text-xl font-bold tracking-tight sm:text-2xl';

  return (
    <div className={cn('space-y-0.5', className)}>
      {hasCompareRow ? (
        <div className="flex min-h-[22px] flex-nowrap items-baseline gap-x-2 gap-y-0">
          <span className="text-muted-foreground shrink-0 text-sm font-medium tabular-nums line-through">
            {price.compareAtAmount}
          </span>
          <PlanDiscountPill label={discountLabel!} className="text-xs" />
        </div>
      ) : (
        <div className="min-h-[22px]" aria-hidden />
      )}

      <p className="flex min-h-8 flex-nowrap items-baseline gap-1.5">
        <span className={cn('text-foreground tabular-nums', amountClass)}>{price.amount}</span>
        {price.suffix ? (
          <span className="text-muted-foreground text-sm font-medium">{price.suffix}</span>
        ) : null}
      </p>
    </div>
  );
}
