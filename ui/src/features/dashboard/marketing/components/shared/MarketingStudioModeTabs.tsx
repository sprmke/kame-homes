import { TierBadge } from '@/features/dashboard/plans/components/TierBadge';

import { SlidingTabsList, SlidingTabsTrigger } from '@/components/ui/sliding-tabs';

export function MarketingStudioModeTabs() {
  return (
    <SlidingTabsList size="primary">
      <SlidingTabsTrigger value="calendar">Calendar</SlidingTabsTrigger>
      <SlidingTabsTrigger value="design">Design</SlidingTabsTrigger>
      <SlidingTabsTrigger value="video">Video</SlidingTabsTrigger>
      <SlidingTabsTrigger value="generate">
        Generate
        <TierBadge feature="aiMarketingImageGeneration" className="ml-1.5" />
      </SlidingTabsTrigger>
    </SlidingTabsList>
  );
}

export { SlidingTabs } from '@/components/ui/sliding-tabs';
