import { useEffect, useState } from 'react';

import type {
  OrgSubscriptionSummary,
  PricingPlan,
} from '@/features/dashboard/super-admin/types/pricingPlan';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const CARD_CLASS =
  'border-border/50 bg-card flex flex-col gap-3 rounded-xl border p-4 shadow-card sm:p-5';

type Props = {
  row: OrgSubscriptionSummary;
  plans: PricingPlan[];
  onAssign: (organizationId: string, planId: string) => Promise<void>;
  isAssigning: boolean;
};

export function SuperAdminOrgSubscriptionCard({ row, plans, onAssign, isAssigning }: Props) {
  const defaultPlanId = row.subscription?.planId ?? plans.find((plan) => plan.isDefault)?.id ?? '';
  const [selectedPlanId, setSelectedPlanId] = useState(defaultPlanId);

  useEffect(() => {
    setSelectedPlanId(defaultPlanId);
  }, [defaultPlanId]);

  return (
    <article className={CARD_CLASS}>
      <div className="min-w-0 space-y-1">
        <h3 className="text-foreground truncate text-sm font-semibold sm:text-base">
          {row.organizationName}
        </h3>
        <p className="text-muted-foreground truncate text-xs">{row.organizationSlug}</p>
      </div>

      <p className="text-muted-foreground text-sm">
        {row.propertyCount} {row.propertyCount === 1 ? 'property' : 'properties'}
      </p>

      <div className="flex flex-wrap items-center gap-1">
        {row.subscription ? (
          <>
            <span className="text-sm">
              {row.subscription.planName ?? row.subscription.planCode}
            </span>
            <Badge variant="outline">{row.subscription.status}</Badge>
          </>
        ) : (
          <Badge variant="secondary">Unassigned</Badge>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Select value={selectedPlanId} onValueChange={setSelectedPlanId} disabled={isAssigning}>
          <SelectTrigger
            className="min-h-[44px] flex-1"
            aria-label={`Assign plan for ${row.organizationName}`}
          >
            <SelectValue placeholder="Plan" />
          </SelectTrigger>
          <SelectContent>
            {plans.map((plan) => (
              <SelectItem key={plan.id} value={plan.id}>
                {plan.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          className="min-h-[44px] shrink-0"
          disabled={isAssigning || !selectedPlanId || selectedPlanId === defaultPlanId}
          onClick={() => void onAssign(row.organizationId, selectedPlanId)}
        >
          Apply
        </Button>
      </div>
    </article>
  );
}

export function SuperAdminOrgSubscriptionsEmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div
      className={cn(
        'surface-card flex flex-col items-center justify-center gap-3 px-4 py-8 sm:py-12 text-center'
      )}
    >
      <p className="text-foreground text-sm font-medium">
        {filtered ? 'No organizations match your filters' : 'No organizations yet'}
      </p>
    </div>
  );
}
