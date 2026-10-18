import { MARKETING_STUDIO_TAB_LABELS } from '@/features/dashboard/marketing/lib/theme/marketingStudioNav';
import { TierBadge } from '@/features/dashboard/plans/components/TierBadge';

import { SlidingTabsList, SlidingTabsTrigger } from '@/components/ui/sliding-tabs';

export function MarketingStudioModeTabs() {
  return (
    <SlidingTabsList size="primary">
      <SlidingTabsTrigger value="calendar">{MARKETING_STUDIO_TAB_LABELS.calendar}</SlidingTabsTrigger>
      <SlidingTabsTrigger value="design">{MARKETING_STUDIO_TAB_LABELS.design}</SlidingTabsTrigger>
      <SlidingTabsTrigger value="video">{MARKETING_STUDIO_TAB_LABELS.video}</SlidingTabsTrigger>
      <SlidingTabsTrigger value="generate">
        {MARKETING_STUDIO_TAB_LABELS.generate}
        <TierBadge feature="aiMarketingImageGeneration" className="ml-1.5" />
      </SlidingTabsTrigger>
    </SlidingTabsList>
  );
}

export { SlidingTabs } from '@/components/ui/sliding-tabs';
