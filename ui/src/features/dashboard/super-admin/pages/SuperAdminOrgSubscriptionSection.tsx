import { useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  SuperAdminSettingsCard,
  SuperAdminSettingsRow,
} from '@/features/dashboard/super-admin/components/shared/SuperAdminSettingsCard';
import { useSuperAdminOrgContext } from '@/features/dashboard/super-admin/components/super-admin-orgs/superAdminOrgContext';
import {
  useAssignOrgPlan,
  usePricingPlans,
} from '@/features/dashboard/super-admin/hooks/usePricingPlans';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function SuperAdminOrgSubscriptionSection() {
  const { org } = useSuperAdminOrgContext();
  const qc = useQueryClient();
  const { rows: plans } = usePricingPlans();
  const assignPlan = useAssignOrgPlan();
  const [planId, setPlanId] = useState('');

  const activePlans = plans.filter((plan) => plan.isActive);

  const handleAssign = async () => {
    if (!planId) return;
    try {
      await assignPlan.mutateAsync({
        organizationId: org.id,
        planId,
        note: 'Super-admin assign from org hub',
      });
      toast.success('Plan assigned');
      setPlanId('');
      await qc.invalidateQueries({ queryKey: ['super-admin', 'org-detail', org.slug] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Assign failed');
    }
  };

  return (
    <SuperAdminSettingsCard
      title="Subscription"
      description="Assign or override this organization's plan. Covers every property the org owns. Billing history and cron runs stay on the platform Subscriptions page."
    >
      <SuperAdminSettingsRow label="Current plan">
        <span className="text-sm font-medium">
          {org.plan?.name ?? 'None'}
          {org.plan ? (
            <span className="text-muted-foreground ml-1 font-normal capitalize">
              · {org.plan.status}
            </span>
          ) : null}
        </span>
      </SuperAdminSettingsRow>

      <SuperAdminSettingsRow label="MRR">
        <span className="text-sm tabular-nums">
          ₱{(org.plan?.mrrPhp ?? 0).toLocaleString('en-PH')}
        </span>
      </SuperAdminSettingsRow>

      <SuperAdminSettingsRow
        stacked
        label="Assign a different plan"
        description="Takes effect immediately for all of the org's properties."
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select value={planId} onValueChange={setPlanId}>
            <SelectTrigger className="h-10 sm:w-64" aria-label="Plan">
              <SelectValue placeholder="Choose a plan" />
            </SelectTrigger>
            <SelectContent>
              {activePlans.map((plan) => (
                <SelectItem key={plan.id} value={plan.id}>
                  {plan.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            className="min-h-[44px]"
            disabled={!planId || assignPlan.isPending}
            onClick={() => void handleAssign()}
          >
            {assignPlan.isPending ? 'Assigning…' : 'Assign plan'}
          </Button>
        </div>
      </SuperAdminSettingsRow>
    </SuperAdminSettingsCard>
  );
}
