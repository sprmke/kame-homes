import { Pencil } from 'lucide-react';

import { formatPricingPlanHostPrice } from '@/features/dashboard/super-admin/lib/pricingPlanDisplay';
import type { PricingPlan } from '@/features/dashboard/super-admin/types/pricingPlan';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const CARD_CLASS =
  'border-border/50 bg-card relative flex flex-col gap-3 rounded-xl border p-4 shadow-card sm:p-5';

type Props = {
  plan: PricingPlan;
  onEdit: (plan: PricingPlan) => void;
};

export function SuperAdminPricingPlanCard({ plan, onEdit }: Props) {
  const priceLabel = formatPricingPlanHostPrice(plan);

  return (
    <article className={CARD_CLASS}>
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-foreground truncate text-sm font-semibold sm:text-base">
              {plan.name}
            </h3>
            <p className="text-muted-foreground truncate text-xs">{plan.code}</p>
          </div>
          <div className="flex flex-wrap gap-1">
            {plan.isDefault ? <Badge variant="secondary">Default</Badge> : null}
            {!plan.isActive ? <Badge variant="outline">Inactive</Badge> : null}
          </div>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="text-muted-foreground text-xs">Host price</dt>
          <dd className="tabular-nums">{priceLabel}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">AI credits/month</dt>
          <dd className="tabular-nums">
            {plan.features.aiMonthlyCreditAllowance.toLocaleString()}
          </dd>
        </div>
      </dl>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-[44px] w-full gap-1.5"
        onClick={() => onEdit(plan)}
      >
        <Pencil className="size-4" aria-hidden />
        Edit
      </Button>
    </article>
  );
}

export function SuperAdminPricingPlansEmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div
      className={cn(
        'surface-card flex flex-col items-center justify-center gap-3 px-4 py-8 sm:py-12 text-center'
      )}
    >
      <p className="text-foreground text-sm font-medium">
        {filtered ? 'No plans match your filters' : 'No pricing plans yet'}
      </p>
    </div>
  );
}
