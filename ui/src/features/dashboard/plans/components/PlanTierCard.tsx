import { ArrowDown, ArrowRight, Check } from 'lucide-react';

import { PlanPriceLine } from '@/features/dashboard/plans/components/PlanPriceLine';
import { PlanTierIconWell } from '@/features/dashboard/plans/components/PlanTierIconWell';
import {
  planActionLabel,
  planDisplayName,
  planPrice,
  planPromoBadge,
  planSelectButtonVariant,
  planTierPitch,
  type PlanTier,
} from '@/features/dashboard/plans/lib/planPresentation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type PlanTierCardProps = {
  tier: PlanTier;
  hasCurrentPlan: boolean;
  canSelect: boolean;
  onSelect: () => void;
  featureAreaMinHeight: number;
};

export function PlanTierCard({
  tier,
  hasCurrentPlan,
  canSelect,
  onSelect,
  featureAreaMinHeight,
}: PlanTierCardProps) {
  const { plan, isCurrent, direction, gains, inheritsFrom } = tier;
  const price = planPrice(plan);
  const title = planDisplayName(plan);
  const headingId = `plan-tier-${plan.code}`;
  const pitch = planTierPitch(plan);
  const promoBadge = planPromoBadge(plan.code);

  return (
    <article
      aria-labelledby={headingId}
      aria-current={isCurrent ? 'true' : undefined}
      className={cn(
        'bg-card text-card-foreground relative flex min-h-0 w-full flex-1 flex-col rounded-2xl border p-4 sm:p-5',
        'transition-[border-color,box-shadow,background-color] duration-200',
        isCurrent
          ? 'border-primary bg-card ring-primary/15 shadow-md ring-1'
          : 'border-border/70 hover:border-border shadow-sm hover:shadow-md'
      )}
    >
      <div className="shrink-0">
        <div
          className={cn(
            'flex flex-col gap-2',
            'min-[1800px]:flex-row min-[1800px]:flex-nowrap min-[1800px]:items-center min-[1800px]:gap-x-2'
          )}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <PlanTierIconWell planCode={plan.code} size="sm" />
            <h3
              id={headingId}
              className="text-foreground min-w-0 text-base font-semibold tracking-tight sm:text-lg"
            >
              {title}
            </h3>
          </div>

          <div
            className={cn(
              'flex min-h-6 flex-nowrap items-center gap-1.5',
              'overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
              'min-[1800px]:min-h-0 min-[1800px]:overflow-visible'
            )}
          >
            {isCurrent ? (
              <Badge variant="success" className="shrink-0 whitespace-nowrap text-[11px]">
                Current
              </Badge>
            ) : null}

            {promoBadge ? (
              <Badge variant="default" className="shrink-0 whitespace-nowrap text-[11px]">
                {promoBadge}
              </Badge>
            ) : null}
          </div>
        </div>

        <p
          className={cn(
            'text-muted-foreground mt-3 min-h-[4.5rem] text-sm leading-relaxed',
            pitch ? 'line-clamp-3' : 'select-none text-transparent'
          )}
        >
          {pitch ?? ' '}
        </p>

        <PlanPriceLine price={price} variant="card" className="mt-4" />
      </div>

      <div
        className={cn(
          'mt-5 flex min-h-0 flex-1 flex-col border-t pt-4',
          isCurrent ? 'border-primary/20' : 'border-border/60'
        )}
        style={{ minHeight: featureAreaMinHeight }}
      >
        {inheritsFrom ? (
          <p className="text-foreground mb-3 text-sm font-medium leading-snug">
            Everything in {inheritsFrom}, plus
          </p>
        ) : null}

        {gains.length > 0 ? (
          <ul className="space-y-2">
            {gains.map((gain) => (
              <li key={gain.key} className="flex min-h-7 items-start gap-2.5 text-sm leading-snug">
                <Check
                  className="text-primary mt-0.5 size-3.5 shrink-0"
                  strokeWidth={2.5}
                  aria-hidden
                />
                <span>{gain.label}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground min-h-7 text-left text-sm leading-snug">
            Same features as {title}.
          </p>
        )}
      </div>

      {canSelect ? (
        <div className="shrink-0 pt-8">
          <Button
            type="button"
            variant={isCurrent ? 'soft' : planSelectButtonVariant(isCurrent, direction, plan.code)}
            aria-disabled={isCurrent || undefined}
            tabIndex={isCurrent ? -1 : 0}
            onClick={isCurrent ? undefined : onSelect}
            aria-label={
              isCurrent
                ? `${title} is your current plan`
                : `${planActionLabel(direction, hasCurrentPlan, plan.code)} to ${title}`
            }
            className={cn('group h-11 w-full text-sm', isCurrent && 'pointer-events-none')}
          >
            {planActionLabel(direction, hasCurrentPlan, plan.code)}
            {!isCurrent ? (
              direction === 'downgrade' ? (
                <ArrowDown
                  className="size-4 transition-transform duration-200 group-hover:translate-y-0.5"
                  aria-hidden
                />
              ) : (
                <ArrowRight
                  className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
                  aria-hidden
                />
              )
            ) : null}
          </Button>
        </div>
      ) : null}
    </article>
  );
}
