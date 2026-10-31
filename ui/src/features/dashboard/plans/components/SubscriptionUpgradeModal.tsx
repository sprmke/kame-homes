import { useMemo, useEffect } from 'react';

import { toast } from 'sonner';

import { usePropertyIdParam, useResolvedOrgId } from '@/features/dashboard/org/lib/adminApiScope';
import { PlanReviewDialog } from '@/features/dashboard/plans/components/PlanReviewDialog';
import { useCreateOrgPlanCheckout, useOrgPlan } from '@/features/dashboard/plans/hooks/useOrgPlan';
import { usePropertyEntitlements } from '@/features/dashboard/plans/hooks/usePropertyEntitlements';
import { openOrgPlanCheckout } from '@/features/dashboard/plans/lib/openOrgPlanCheckout';
import { isFeatureEnabled, type PlanFeatureKey } from '@/features/dashboard/plans/lib/planFeatures';
import {
  resolveEffectiveCurrentPlan,
  resolveEffectiveCurrentPlanId,
  resolveUpgradePlanForFeature,
} from '@/features/dashboard/plans/lib/planPresentation';

import { captureAppEvent } from '@/lib/posthog/capture';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature: PlanFeatureKey | null;
};

/**
 * Feature-gate entry — resolves the minimum plan for `feature`, shows PlanReviewDialog in place,
 * then starts checkout; PayMongo returns to org Billing on success.
 */
export function SubscriptionUpgradeModal({ open, onOpenChange, feature }: Props) {
  const orgId = useResolvedOrgId();
  const propertyId = usePropertyIdParam();
  const { data } = useOrgPlan(orgId, { pollWhileCheckoutPending: true });
  const createCheckout = useCreateOrgPlanCheckout(orgId);
  const { data: propertyEntitlements } = usePropertyEntitlements();

  const plans = useMemo(() => data?.plans ?? [], [data?.plans]);
  const subscription = data?.subscription ?? null;
  const propertyCount = data?.properties?.length ?? 0;

  const currentPlanId = useMemo(
    () => resolveEffectiveCurrentPlanId(plans, subscription?.planId),
    [plans, subscription?.planId]
  );

  const currentPlan = useMemo(
    () => resolveEffectiveCurrentPlan(plans, subscription?.planId),
    [plans, subscription?.planId]
  );

  /** When the property lacks a feature the org plan already includes, re-offer current (enroll). */
  const propertyHasFeature = useMemo(() => {
    if (!propertyId || !feature || !propertyEntitlements) return null;
    return isFeatureEnabled(propertyEntitlements, feature);
  }, [propertyId, feature, propertyEntitlements]);

  const targetPlan = useMemo(
    () =>
      feature
        ? resolveUpgradePlanForFeature(plans, feature, currentPlanId, propertyHasFeature)
        : null,
    [plans, feature, currentPlanId, propertyHasFeature]
  );

  useEffect(() => {
    if (!open || !feature || targetPlan) return;
    toast.message('You are on the highest plan. Free a seat or contact support for more members.');
    onOpenChange(false);
  }, [open, feature, targetPlan, onOpenChange]);

  const handleContinueToPayment = async (planId: string) => {
    if (!orgId) return;
    if (feature) {
      captureAppEvent('upgrade_modal_cta_clicked', {
        feature_key: feature,
        target_plan_id: planId,
      });
    }
    const checkout = await createCheckout.mutateAsync({ planId });
    onOpenChange(false);
    openOrgPlanCheckout({
      orgId,
      transactionId: checkout.transactionId,
      checkoutUrl: checkout.checkoutUrl,
      previousPlanId: currentPlanId ?? null,
      targetPlanId: planId,
    });
  };

  return (
    <PlanReviewDialog
      open={open && Boolean(targetPlan)}
      plan={targetPlan}
      currentPlan={currentPlan}
      propertyCount={propertyCount}
      subscription={subscription}
      onOpenChange={onOpenChange}
      onConfirmDowngrade={async () => {
        onOpenChange(false);
      }}
      onCheckoutPaid={handleContinueToPayment}
      isSubmitting={createCheckout.isPending}
    />
  );
}
