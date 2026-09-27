import { BenchmarkCard } from '@/features/dashboard/analytics/components/BenchmarkCard';
import { ChannelMixCard } from '@/features/dashboard/analytics/components/ChannelMixCard';
import { GuestAgeCard } from '@/features/dashboard/analytics/components/GuestAgeCard';
import { GuestOriginsCard } from '@/features/dashboard/analytics/components/GuestOriginsCard';
import { GuestPartySizeCard } from '@/features/dashboard/analytics/components/GuestPartySizeCard';
import { PublicPagePerformanceCard } from '@/features/dashboard/analytics/components/PublicPagePerformanceCard';
import type { AnalyticsBundle } from '@/features/dashboard/analytics/lib/types';

const SECTION_GAP = 'flex flex-col gap-2.5 sm:gap-3 lg:gap-4';
const CARD_GRID = 'grid gap-2.5 sm:gap-3 lg:grid-cols-3 lg:gap-4';

type Props = {
  bundle: AnalyticsBundle;
};

export function AnalyticsOverviewSection({ bundle }: Props) {
  return (
    <div className={SECTION_GAP}>
      <div className={CARD_GRID}>
        <GuestAgeCard guestAge={bundle.distributions.guestAge} />
        <GuestPartySizeCard partySize={bundle.distributions.partySize} />
        <GuestOriginsCard guestOrigins={bundle.distributions.guestOrigins} />
      </div>

      <div className={CARD_GRID}>
        <ChannelMixCard channelMix={bundle.distributions.channelMix} compact />
        <PublicPagePerformanceCard publicPage={bundle.publicPage} />
        <BenchmarkCard
          benchmark={bundle.benchmark}
          ownOccupancyRatePct={bundle.kpis.occupancyRate.value}
        />
      </div>
    </div>
  );
}
