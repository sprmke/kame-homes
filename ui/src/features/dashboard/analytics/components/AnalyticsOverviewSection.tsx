import { AnalyticsNextActionsCard } from '@/features/dashboard/analytics/components/AnalyticsNextActionsCard';
import { BenchmarkCard } from '@/features/dashboard/analytics/components/BenchmarkCard';
import { ChannelMixCard } from '@/features/dashboard/analytics/components/ChannelMixCard';
import { NextNinetyDaysCard } from '@/features/dashboard/analytics/components/NextNinetyDaysCard';
import { OccupancyRateTrendCard } from '@/features/dashboard/analytics/components/OccupancyRateTrendCard';
import { PublicPagePerformanceCard } from '@/features/dashboard/analytics/components/PublicPagePerformanceCard';
import { buildAnalyticsNextActions } from '@/features/dashboard/analytics/lib/analyticsNextActions';
import type { AnalyticsBundle } from '@/features/dashboard/analytics/lib/types';

const SECTION_GAP = 'flex flex-col gap-2.5 sm:gap-3 lg:gap-4';

type Props = {
  bundle: AnalyticsBundle;
  orgSlug: string;
  propertySlug: string;
  onOpenReview: () => void;
};

export function AnalyticsOverviewSection({ bundle, orgSlug, propertySlug, onOpenReview }: Props) {
  const actions = buildAnalyticsNextActions({
    orgSlug,
    propertySlug,
    state: bundle.stateAssessment,
    forward: bundle.forward,
    publicPage: bundle.publicPage,
    playbook: bundle.playbook,
  });
  const hasSources = bundle.distributions.channelMix.some((item) => item.count > 0);
  const hasTraffic = bundle.publicPage.pageViews > 0 || bundle.publicPage.uniqueVisitors > 0;

  return (
    <div className={SECTION_GAP}>
      <OccupancyRateTrendCard trend={bundle.trend} title="This period" />

      <div className="grid gap-2.5 sm:gap-3 lg:grid-cols-2 lg:gap-4">
        <NextNinetyDaysCard forward={bundle.forward} pickup={bundle.pickup} />
        <AnalyticsNextActionsCard actions={actions} onOpenReview={onOpenReview} />
      </div>

      {hasSources || hasTraffic || bundle.benchmark.available ? (
        <div className="grid gap-2.5 sm:gap-3 lg:grid-cols-2 lg:gap-4">
          {hasSources ? (
            <ChannelMixCard channelMix={bundle.distributions.channelMix} compact />
          ) : null}
          {hasTraffic ? <PublicPagePerformanceCard publicPage={bundle.publicPage} /> : null}
          {bundle.benchmark.available ? (
            <BenchmarkCard
              benchmark={bundle.benchmark}
              ownOccupancyRatePct={bundle.kpis.occupancyRate.value}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
