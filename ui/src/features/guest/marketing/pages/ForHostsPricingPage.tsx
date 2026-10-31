import { useMemo } from 'react';

import { useNavigate } from 'react-router-dom';

import { publicContactPath } from '@/features/guest/marketing/contact/lib/publicContactParams';
import { usePublicPricingPlans } from '@/features/guest/marketing/for-hosts/hooks/usePublicPricingPlans';
import { MarketingPublicPageContent } from '@/features/guest/marketing/shared/components/MarketingPublicPageContent';
import { MarketingPublicPageHero } from '@/features/guest/marketing/shared/components/MarketingPublicPageHero';

import { PlanFeatureMatrix } from '@/features/dashboard/plans/components/PlanFeatureMatrix';
import { PlanTierRail } from '@/features/dashboard/plans/components/PlanTierRail';
import type { OrgBundlePlanDto } from '@/features/dashboard/plans/lib/orgPlanApi';
import {
  buildPlanTiers,
  isManagedSalesPlan,
  MANAGED_PLAN_INQUIRY_SUBJECT,
  planTabSectionTitleClass,
} from '@/features/dashboard/plans/lib/planPresentation';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { publicPageTitle, usePageTitle } from '@/lib/pageTitle';
import { cn } from '@/lib/utils';

function PublicPricingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-[28rem] w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

export function ForHostsPricingPage() {
  usePageTitle(publicPageTitle('Pricing'));
  const navigate = useNavigate();
  const { data: plans = [], isLoading, isError, refetch } = usePublicPricingPlans();

  const tiers = useMemo(() => buildPlanTiers(plans, undefined), [plans]);

  const handleSelectPlan = (plan: OrgBundlePlanDto) => {
    if (isManagedSalesPlan(plan.code)) {
      navigate(
        publicContactPath({
          category: 'business_inquiry',
          subject: MANAGED_PLAN_INQUIRY_SUBJECT,
        })
      );
      return;
    }
    navigate('/for-hosts/login');
  };

  return (
    <div className="bg-background min-h-screen w-full max-w-[100vw] overflow-x-hidden">
      <MarketingPublicPageHero
        eyebrow="For Hosts"
        title="Plans that grow with you"
        description="Start free on one listing. Upgrade when you need automation, marketing, AI, or hands-off hosting."
        blobPosition="right"
      />

      <MarketingPublicPageContent className="min-w-0 overflow-x-hidden">
        {isLoading ? <PublicPricingSkeleton /> : null}

        {isError ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="text-muted-foreground text-sm">Could not load plans.</p>
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px]"
              onClick={() => refetch()}
            >
              Retry
            </Button>
          </div>
        ) : null}

        {!isLoading && !isError && tiers.length > 0 ? (
          <div className="min-w-0 space-y-12">
            <PlanTierRail
              tiers={tiers}
              hasCurrentPlan={false}
              canSelect
              onSelectPlan={handleSelectPlan}
            />

            <section className="min-w-0 space-y-4">
              <h2 className={cn(planTabSectionTitleClass)}>Compare features</h2>
              <PlanFeatureMatrix
                tiers={tiers}
                hasCurrentPlan={false}
                canSelect
                onSelectPlan={handleSelectPlan}
              />
            </section>
          </div>
        ) : null}
      </MarketingPublicPageContent>
    </div>
  );
}
