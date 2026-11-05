import {
  MARKETING_STUDIO_TAB_LABELS,
  MARKETING_STUDIO_TABS,
} from '@/features/dashboard/marketing/lib/theme/marketingStudioNav';
import { FeatureStatusDot } from '@/components/feature-availability/FeatureStatusDot';
import { TierBadge } from '@/features/dashboard/plans/components/TierBadge';
import { useFeatureAvailability } from '@/lib/featureAvailability/useFeatureAvailability';

import { SlidingTabsList, SlidingTabsTrigger } from '@/components/ui/sliding-tabs';

export function MarketingStudioModeTabs() {
  const aiStudioAvailability = useFeatureAvailability('marketing.ai_studio');
  const showAiStudioTierBadge = aiStudioAvailability.available && !aiStudioAvailability.isLoading;

  return (
    <SlidingTabsList size="primary">
      {MARKETING_STUDIO_TABS.map((tab) => (
        <SlidingTabsTrigger key={tab} value={tab}>
          {MARKETING_STUDIO_TAB_LABELS[tab]}
          {tab === 'generate' ? (
            <>
              {!aiStudioAvailability.available && !aiStudioAvailability.isLoading ? (
                <FeatureStatusDot className="ml-1.5" label={aiStudioAvailability.label} />
              ) : null}
              {showAiStudioTierBadge ? (
                <TierBadge feature="aiMarketingImageGeneration" className="ml-1.5" />
              ) : null}
            </>
          ) : null}
        </SlidingTabsTrigger>
      ))}
    </SlidingTabsList>
  );
}

export { SlidingTabs } from '@/components/ui/sliding-tabs';
