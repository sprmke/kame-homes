import { BenchmarkCard } from '@/features/dashboard/analytics/components/BenchmarkCard';
import { ChannelMixCard } from '@/features/dashboard/analytics/components/ChannelMixCard';
import { GuestAgeCard } from '@/features/dashboard/analytics/components/GuestAgeCard';
import { GuestOriginsCard } from '@/features/dashboard/analytics/components/GuestOriginsCard';
import { GuestPartySizeCard } from '@/features/dashboard/analytics/components/GuestPartySizeCard';
import { PublicPagePerformanceCard } from '@/features/dashboard/analytics/components/PublicPagePerformanceCard';
import type { AnalyticsBundle } from '@/features/dashboard/analytics/lib/types';

const SECTION_GAP = 'flex flex-col gap-2.5 sm:gap-3 lg:gap-4';

type Props = {
  bundle: AnalyticsBundle;
};

export function AnalyticsOverviewSection({ bundle }: Props) {
  const hasSources = bundle.distributions.channelMix.some((item) => item.count > 0);
  const hasTraffic = bundle.publicPage.pageViews > 0 || bundle.publicPage.uniqueVisitors > 0;

  return (
    <div className={SECTION_GAP}>
      <div className="grid gap-2.5 sm:gap-3 lg:grid-cols-3 lg:gap-4">
        <GuestAgeCard guestAge={bundle.distributions.guestAge} />
        <GuestPartySizeCard partySize={bundle.distributions.partySize} />
        <GuestOriginsCard guestOrigins={bundle.distributions.guestOrigins} />
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
