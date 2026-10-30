import { Gauge, Sparkles, TrendingUp, Users } from 'lucide-react';

import { FeatureStatusDot } from '@/components/feature-availability/FeatureStatusDot';
import { useFeatureAvailability } from '@/lib/featureAvailability/useFeatureAvailability';

import { SlidingTabs, SlidingTabsList, SlidingTabsTrigger } from '@/components/ui/sliding-tabs';

export type AnalyticsSection = 'overview' | 'trends' | 'guests' | 'ai-review';

const ANALYTICS_SECTIONS: Array<{
  value: AnalyticsSection;
  label: string;
  icon: typeof TrendingUp;
}> = [
  { value: 'overview', label: 'Overview', icon: Gauge },
  { value: 'trends', label: 'Trends', icon: TrendingUp },
  { value: 'guests', label: 'Guests', icon: Users },
  { value: 'ai-review', label: 'AI review', icon: Sparkles },
];

type Props = {
  section: AnalyticsSection;
  onSectionChange: (section: AnalyticsSection) => void;
};

/** Section switcher for the Analytics dashboard. Period and actions live in the page header. */
export function AnalyticsSectionTabs({ section, onSectionChange }: Props) {
  const aiReviewAvailability = useFeatureAvailability('analytics.ai_review');

  return (
    <SlidingTabs
      value={section}
      onValueChange={(value) => onSectionChange(value as AnalyticsSection)}
    >
      <SlidingTabsList size="primary" className="max-w-full">
        {ANALYTICS_SECTIONS.map(({ value, label, icon: Icon }) => (
          <SlidingTabsTrigger key={value} value={value}>
            <Icon className="size-4 shrink-0" aria-hidden />
            {label}
            {value === 'ai-review' &&
            !aiReviewAvailability.available &&
            !aiReviewAvailability.isLoading ? (
              <FeatureStatusDot className="ml-1" label={aiReviewAvailability.label} />
            ) : null}
          </SlidingTabsTrigger>
        ))}
      </SlidingTabsList>
    </SlidingTabs>
  );
}
