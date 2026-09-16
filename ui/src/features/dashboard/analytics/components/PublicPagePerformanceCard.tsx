import { useMemo } from 'react';

import { Eye } from 'lucide-react';

import {
  AnalyticsDonutChart,
  analyticsDonutColor,
} from '@/features/dashboard/analytics/components/AnalyticsDonutChart';
import type { AnalyticsPublicPage } from '@/features/dashboard/analytics/lib/types';

import { AdminSurfaceCardHeader } from '@/components/shared/AdminSurfaceCardHeader';
import { cn } from '@/lib/utils';

type Props = {
  publicPage: AnalyticsPublicPage;
  compact?: boolean;
  className?: string;
};

export function PublicPagePerformanceCard({ publicPage, compact = true, className }: Props) {
  const slices = useMemo(() => {
    const referrers = [...publicPage.topReferrers]
      .filter((entry) => entry.count > 0)
      .sort((a, b) => b.count - a.count);

    if (referrers.length > 0) {
      return referrers.map((entry, index) => ({
        key: entry.referrer,
        label: entry.referrer,
        count: entry.count,
        color: analyticsDonutColor(index),
      }));
    }

    if (publicPage.pageViews > 0) {
      return [
        {
          key: 'views',
          label: 'Page views',
          count: publicPage.pageViews,
          color: analyticsDonutColor(0),
        },
      ];
    }

    return [];
  }, [publicPage.topReferrers, publicPage.pageViews]);

  const pageViews = publicPage.pageViews;

  return (
    <section
      className={cn(
        'surface-card flex h-full min-h-0 min-w-0 flex-col overflow-visible p-3 sm:p-4',
        className
      )}
      aria-label="Listing visits"
    >
      <AdminSurfaceCardHeader icon={Eye} title="Listing visits" iconClassName="bg-muted/80" />

      <AnalyticsDonutChart
        slices={slices}
        centerValue={pageViews}
        centerLabel={pageViews === 1 ? 'page view' : 'page views'}
        emptyMessage="No page views in this period"
        compact={compact}
      />
    </section>
  );
}
