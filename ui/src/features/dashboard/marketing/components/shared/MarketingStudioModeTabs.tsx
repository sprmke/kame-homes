import {
  MARKETING_STUDIO_TAB_LABELS,
  MARKETING_STUDIO_TABS,
} from '@/features/dashboard/marketing/lib/theme/marketingStudioNav';
import { TierBadge } from '@/features/dashboard/plans/components/TierBadge';

import { SlidingTabsList, SlidingTabsTrigger } from '@/components/ui/sliding-tabs';

export function MarketingStudioModeTabs() {
  return (
    <SlidingTabsList size="primary">
      {MARKETING_STUDIO_TABS.map((tab) => (
        <SlidingTabsTrigger key={tab} value={tab}>
          {MARKETING_STUDIO_TAB_LABELS[tab]}
          {tab === 'generate' ? (
            <TierBadge feature="aiMarketingImageGeneration" className="ml-1.5" />
          ) : null}
        </SlidingTabsTrigger>
      ))}
    </SlidingTabsList>
  );
}

export { SlidingTabs } from '@/components/ui/sliding-tabs';
