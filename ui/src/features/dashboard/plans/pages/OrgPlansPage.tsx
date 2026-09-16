import { useEffect, useMemo, useState } from 'react';

import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { FileText, LayoutGrid, Receipt } from 'lucide-react';

import {
  helpSupportNewTicketPath,
  useHelpSupportBasePath,
} from '@/features/dashboard/help-support/lib/helpSupportPaths';
import { useOrganizations } from '@/features/dashboard/org/hooks/useOrganizations';
import { canManageOrgBilling } from '@/features/dashboard/org/lib/orgAccessKind';
import { PlanBillingPanel } from '@/features/dashboard/plans/components/PlanBillingPanel';
import { PlanCheckoutConfirmationBanner } from '@/features/dashboard/plans/components/PlanCheckoutConfirmationBanner';
import { PlanFaqSection } from '@/features/dashboard/plans/components/PlanFaqSection';
import { PlanFeatureMatrix } from '@/features/dashboard/plans/components/PlanFeatureMatrix';
import { PlanReviewDialog } from '@/features/dashboard/plans/components/PlanReviewDialog';
import { PlanTierRail } from '@/features/dashboard/plans/components/PlanTierRail';
import { PlanUpgradeSuccessModal } from '@/features/dashboard/plans/components/PlanUpgradeSuccessModal';
import {
  useCreateOrgPlanCheckout,
  useApplyOrgPlanDowngrade,
  useOrgPlan,
} from '@/features/dashboard/plans/hooks/useOrgPlan';
import { useOrgPlanCheckoutConfirmation } from '@/features/dashboard/plans/hooks/useOrgPlanCheckoutConfirmation';
import { openOrgPlanCheckout } from '@/features/dashboard/plans/lib/openOrgPlanCheckout';
import type { OrgBundlePlanDto } from '@/features/dashboard/plans/lib/orgPlanApi';
import { parseOrgPlanCheckoutReturn } from '@/features/dashboard/plans/lib/orgPlanCheckoutParams';
import { consumeOrgPlanUpgradeCelebration } from '@/features/dashboard/plans/lib/orgPlanCheckoutSession';
import type { PlanFeatureKey } from '@/features/dashboard/plans/lib/planFeatures';
import {
  buildPlanTiers,
  isManagedSalesPlan,
  MANAGED_PLAN_INQUIRY_SUBJECT,
  nextUpgradePlan,
  PLANS_PAGE_SUBTITLE,
  planTabSectionTitleClass,
  resolveEffectiveCurrentPlan,
  resolveEffectiveCurrentPlanId,
  resolveDowngradeBlockedReason,
  resolveMinimumPlanForFeature,
  isPlanDowngrade,
} from '@/features/dashboard/plans/lib/planPresentation';

import { FloatingPanel } from '@/components/mobile/FloatingPanel';
import { AdminMobilePage } from '@/components/mobile/MobileBrandHero';
import { PlansPageSkeleton } from '@/components/skeletons/AdminSkeletons';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { orgPageTitle, usePageTitle } from '@/lib/pageTitle';
import { cn } from '@/lib/utils';

type PlansTab = 'plans' | 'billing' | 'compare';

/**
 * Org subscription hub — one plan covers every property in the org, priced per property with
 * volume discounts. Tier changes open PlanReviewDialog for a final review (with proration when
 * it's a genuine mid-cycle change) before charging anything.
 */
export function OrgPlansPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const { data: orgsData, isLoading: orgsLoading } = useOrganizations();
  const org = orgsData?.organizations.find((entry) => entry.slug === orgSlug);
  const helpSupportBase = useHelpSupportBasePath();
  usePageTitle(org?.name ? orgPageTitle(org.name, 'Plans & Billing') : undefined);

  const checkoutReturn = parseOrgPlanCheckoutReturn(searchParams.get('checkout'));

  const clearCheckoutReturnParam = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('checkout');
    setSearchParams(next, { replace: true });
  };

  const { data, isLoading, error, refetch } = useOrgPlan(org?.id ?? null, {
    pollWhileCheckoutPending: true,
  });
  const createCheckout = useCreateOrgPlanCheckout(org?.id ?? null);
  const applyDowngrade = useApplyOrgPlanDowngrade(org?.id ?? null);
  const checkoutConfirmation = useOrgPlanCheckoutConfirmation({
    orgId: org?.id ?? null,
    data,
    pollWhileConfirming: true,
    checkoutReturn,
    onCheckoutReturnHandled: clearCheckoutReturnParam,
  });

  const [activeTab, setActiveTab] = useState<PlansTab>('billing');
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [upgradeCelebrationOpen, setUpgradeCelebrationOpen] = useState(false);
  const [celebrationPreviousPlanId, setCelebrationPreviousPlanId] = useState<string | null>(null);
  const [celebrationTargetPlanId, setCelebrationTargetPlanId] = useState<string | null>(null);

  const plans = data?.plans ?? [];
  const properties = data?.properties ?? [];
  const assignedPropertyIds = data?.assignedPropertyIds ?? [];
  const propertyCount = properties.length;
  const uncoveredPropertyCount = Math.max(0, propertyCount - assignedPropertyIds.length);
  const subscription = data?.subscription ?? null;

  const effectiveCurrentPlanId = useMemo(
    () => resolveEffectiveCurrentPlanId(plans, subscription?.planId),
    [plans, subscription?.planId]
  );

  const currentPlan = useMemo(
    () => resolveEffectiveCurrentPlan(plans, subscription?.planId),
    [plans, subscription?.planId]
  );

  const upgradeTarget = useMemo(
    () => nextUpgradePlan(plans, effectiveCurrentPlanId),
    [plans, effectiveCurrentPlanId]
  );

  const canManageBilling = canManageOrgBilling(org?.accessKind);

  const resumePendingCheckout = async () => {
    const pendingTxn = data?.transactions.find(
      (txn) => txn.status === 'pending' && txn.checkoutUrl
    );
    const planId = data?.pendingCheckoutPlanId ?? pendingTxn?.planId;
    if (!planId || !org?.id) return;

    const checkout = await createCheckout.mutateAsync({ planId });
    openOrgPlanCheckout({
      orgId: org.id,
      transactionId: checkout.transactionId,
      checkoutUrl: checkout.checkoutUrl,
      previousPlanId: effectiveCurrentPlanId ?? null,
      targetPlanId: planId,
    });
  };

  const celebrationPreviousPlan = useMemo(
    () => plans.find((plan) => plan.id === celebrationPreviousPlanId) ?? null,
    [plans, celebrationPreviousPlanId]
  );
  const celebrationTargetPlan = useMemo(
    () => plans.find((plan) => plan.id === celebrationTargetPlanId) ?? currentPlan,
    [plans, celebrationTargetPlanId, currentPlan]
  );

  useEffect(() => {
    if (checkoutConfirmation !== 'success' || !org?.id) return;
    const payload = consumeOrgPlanUpgradeCelebration(org.id);
    if (!payload) return;
    setCelebrationPreviousPlanId(payload.previousPlanId);
    setCelebrationTargetPlanId(payload.targetPlanId);
    setUpgradeCelebrationOpen(true);
  }, [checkoutConfirmation, org?.id]);

  useEffect(() => {
    setPendingPlanId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscription?.id, subscription?.planId, propertyCount]);

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === pendingPlanId) ?? currentPlan,
    [plans, pendingPlanId, currentPlan]
  );

  const downgradeBlockedReason = useMemo(() => {
    if (!selectedPlan || !isPlanDowngrade(currentPlan, selectedPlan)) return null;
    return resolveDowngradeBlockedReason({
      subscriptionStatus: subscription?.status,
      currentPlanCode: currentPlan?.code,
      targetPlan: selectedPlan,
    });
  }, [selectedPlan, currentPlan, subscription?.status]);

  const tiers = useMemo(
    () => buildPlanTiers(plans, effectiveCurrentPlanId),
    [plans, effectiveCurrentPlanId]
  );
  const hasPlans = plans.length > 0;

  const handleSelectPlan = (plan: OrgBundlePlanDto) => {
    if (!canManageBilling) return;
    if (isManagedSalesPlan(plan.code) && helpSupportBase) {
      navigate(
        helpSupportNewTicketPath(helpSupportBase, { subject: MANAGED_PLAN_INQUIRY_SUBJECT })
      );
      return;
    }
    setPendingPlanId(plan.id);
    setReviewOpen(true);
  };

  useEffect(() => {
    if (!plans.length) return;

    const tab = searchParams.get('tab');
    if (tab === 'billing') {
      setActiveTab('billing');
    } else if (tab === 'plans' || tab === 'compare') {
      setActiveTab(tab);
    }

    if (checkoutReturn === 'success') {
      setActiveTab('billing');
      void refetch();
    }

    const reviewPlanId = searchParams.get('reviewPlan');
    const featureParam = searchParams.get('feature');
    let targetPlanId: string | null = reviewPlanId;

    if (!targetPlanId && featureParam) {
      const minimumPlan = resolveMinimumPlanForFeature(plans, featureParam as PlanFeatureKey);
      targetPlanId = minimumPlan?.id ?? null;
    }

    if (canManageBilling && targetPlanId && plans.some((plan) => plan.id === targetPlanId)) {
      setActiveTab('plans');
      setPendingPlanId(targetPlanId);
      setReviewOpen(true);
    }

    if ((tab || reviewPlanId || featureParam) && !checkoutReturn) {
      setSearchParams({}, { replace: true });
    }
  }, [plans, searchParams, setSearchParams, canManageBilling, checkoutReturn, refetch]);

  const isBootstrapping = orgsLoading || (Boolean(org?.id) && isLoading && !data);

  if (isBootstrapping) {
    return (
      <AdminMobilePage title="Plans & Billing" subtitle={PLANS_PAGE_SUBTITLE}>
        <PlansPageSkeleton />
      </AdminMobilePage>
    );
  }

  if (!org || error) {
    return (
      <AdminMobilePage title="Plans & Billing" subtitle={PLANS_PAGE_SUBTITLE}>
        <FloatingPanel padding="lg" className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-foreground text-sm font-semibold">Could not load plans</p>
          <p className="text-caption max-w-sm">
            {error instanceof Error ? error.message : 'Please try again.'}
          </p>
          <Button type="button" variant="outline" onClick={() => refetch()}>
            Retry
          </Button>
        </FloatingPanel>
      </AdminMobilePage>
    );
  }

  return (
    <AdminMobilePage
      title="Plans & Billing"
      subtitle={PLANS_PAGE_SUBTITLE}
      titleId="org-plans-heading"
      dense
      className="min-w-0 max-w-full"
    >
      {!hasPlans ? (
        <FloatingPanel padding="lg" className="py-16 text-center">
          <p className="text-foreground text-sm font-semibold">No plans available</p>
          <p className="text-caption mx-auto mt-1 max-w-sm">
            Pricing tiers have not been published yet.
          </p>
        </FloatingPanel>
      ) : (
        <div className="native-stagger flex min-w-0 flex-col gap-5 sm:gap-6 lg:gap-8">
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as PlansTab)}
            className="min-w-0"
          >
            <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto p-1 max-lg:h-9 sm:w-auto">
              <TabsTrigger
                value="billing"
                className="gap-2 px-3 py-2 max-lg:gap-1.5 max-lg:px-2.5 max-lg:py-0 max-lg:text-[13px]"
              >
                <Receipt className="size-4 shrink-0" aria-hidden />
                <span>Billing</span>
              </TabsTrigger>
              <TabsTrigger
                value="plans"
                className="gap-2 px-3 py-2 max-lg:gap-1.5 max-lg:px-2.5 max-lg:py-0 max-lg:text-[13px]"
              >
                <LayoutGrid className="size-4 shrink-0" aria-hidden />
                <span>Plans</span>
              </TabsTrigger>
              <TabsTrigger
                value="compare"
                className="gap-2 px-3 py-2 max-lg:gap-1.5 max-lg:px-2.5 max-lg:py-0 max-lg:text-[13px]"
              >
                <FileText className="size-4 shrink-0" aria-hidden />
                <span>Compare</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="billing" className="mt-5 sm:mt-6">
              <section aria-labelledby="billing-tab-heading" className="min-w-0">
                <h2 id="billing-tab-heading" className={cn(planTabSectionTitleClass, 'mb-4')}>
                  Billing
                </h2>

                <PlanCheckoutConfirmationBanner
                  state={checkoutConfirmation}
                  pendingCheckoutUrl={data?.pendingCheckoutUrl}
                  onResumePayment={canManageBilling ? resumePendingCheckout : undefined}
                  className="mb-4"
                />

                <PlanBillingPanel
                  plan={currentPlan}
                  subscription={subscription}
                  transactions={data?.transactions ?? []}
                  canManage={canManageBilling}
                  pendingCheckoutUrl={data?.pendingCheckoutUrl}
                  onResumePayment={canManageBilling ? resumePendingCheckout : undefined}
                  isPaying={createCheckout.isPending}
                  upgradePlan={upgradeTarget}
                  onUpgrade={handleSelectPlan}
                  onManagePlans={() => setActiveTab('plans')}
                  uncoveredPropertyCount={uncoveredPropertyCount}
                  onCoverUncoveredProperties={
                    subscription && currentPlan && uncoveredPropertyCount > 0
                      ? () => handleSelectPlan(currentPlan)
                      : undefined
                  }
                />
              </section>
            </TabsContent>

            <TabsContent value="plans" className="mt-5 space-y-6 sm:mt-6">
              <section aria-labelledby="choose-plan-heading" className="min-w-0">
                <PlanTierRail
                  tiers={tiers}
                  hasCurrentPlan={Boolean(effectiveCurrentPlanId)}
                  canSelect={canManageBilling}
                  onSelectPlan={handleSelectPlan}
                />
              </section>
            </TabsContent>

            <TabsContent value="compare" className="mt-5 sm:mt-6">
              <section aria-labelledby="compare-features-heading" className="min-w-0">
                <h2 id="compare-features-heading" className={cn(planTabSectionTitleClass, 'mb-4')}>
                  Compare features
                </h2>

                <PlanFeatureMatrix
                  tiers={tiers}
                  hasCurrentPlan={Boolean(effectiveCurrentPlanId)}
                  canSelect={canManageBilling}
                  onSelectPlan={handleSelectPlan}
                  className="border-border/80 shadow-sm"
                />
              </section>
            </TabsContent>
          </Tabs>

          <PlanFaqSection />
        </div>
      )}

      <PlanReviewDialog
        open={reviewOpen && Boolean(selectedPlan)}
        plan={selectedPlan}
        currentPlan={currentPlan}
        propertyCount={propertyCount}
        subscription={subscription}
        downgradeBlockedReason={downgradeBlockedReason}
        onOpenChange={setReviewOpen}
        onConfirmDowngrade={async (planId) => {
          if (!org?.id) return;
          await applyDowngrade.mutateAsync({ planId });
        }}
        onCheckoutPaid={async (planId) => {
          if (!org?.id) return;
          const checkout = await createCheckout.mutateAsync({ planId });
          openOrgPlanCheckout({
            orgId: org.id,
            transactionId: checkout.transactionId,
            checkoutUrl: checkout.checkoutUrl,
            previousPlanId: effectiveCurrentPlanId ?? null,
            targetPlanId: planId,
          });
          setReviewOpen(false);
          setActiveTab('billing');
        }}
        isSubmitting={createCheckout.isPending || applyDowngrade.isPending}
      />

      <PlanUpgradeSuccessModal
        open={upgradeCelebrationOpen}
        onOpenChange={setUpgradeCelebrationOpen}
        previousPlan={celebrationPreviousPlan}
        targetPlan={celebrationTargetPlan}
        onViewCompare={() => setActiveTab('compare')}
      />
    </AdminMobilePage>
  );
}
