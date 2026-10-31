import { useEffect, type ReactNode } from 'react';

import { Link } from 'react-router-dom';

import { useOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { orgPlansPath } from '@/features/dashboard/org/lib/tenantPaths';
import { PlanGatedText } from '@/features/dashboard/plans/components/PlanUpgradeLink';
import { useUpgradeModal } from '@/features/dashboard/plans/components/UpgradeModalProvider';
import { useFeatureGate } from '@/features/dashboard/plans/hooks/useFeatureGate';
import { featureGateCopy } from '@/features/dashboard/plans/lib/featureGateCopy';
import type { PlanFeatureKey } from '@/features/dashboard/plans/lib/planFeatures';

import { FloatingPanel } from '@/components/mobile/FloatingPanel';
import { RouteGuardLoading } from '@/components/skeletons/RouteGuardLoading';
import { Button } from '@/components/ui/button';

type Props = {
  feature: PlanFeatureKey;
  children: ReactNode;
};

/** Route-level plan gate — blocked hosts see an upgrade prompt, not the gated surface. */
export function RequirePropertyFeature({ feature, children }: Props) {
  const { allowed, isLoading } = useFeatureGate(feature);
  const { open } = useUpgradeModal();
  const { orgSlug } = useOrgContext();
  const copy = featureGateCopy(feature);
  const plansPath = orgPlansPath(orgSlug);

  useEffect(() => {
    if (!isLoading && !allowed) {
      open(feature);
    }
  }, [allowed, feature, isLoading, open]);

  if (isLoading) {
    return <RouteGuardLoading />;
  }

  if (!allowed) {
    return (
      <FloatingPanel padding="lg" className="py-16 text-center">
        <p className="text-foreground text-sm font-semibold">{copy.title}</p>
        <p className="text-caption mx-auto mt-1 max-w-sm">
          <PlanGatedText text={copy.description} feature={feature} />
        </p>
        <Button asChild className="mt-4 min-h-[44px]">
          <Link to={plansPath}>{copy.ctaLabel}</Link>
        </Button>
      </FloatingPanel>
    );
  }

  return <>{children}</>;
}
