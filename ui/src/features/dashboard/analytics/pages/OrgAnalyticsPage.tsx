import { useState } from 'react';

import { AnalyticsDateRangeControl } from '@/features/dashboard/analytics/components/AnalyticsDateRangeControl';
import { OrgAnalyticsKpiCards } from '@/features/dashboard/analytics/components/OrgAnalyticsKpiCards';
import { OrgPropertyComparisonTable } from '@/features/dashboard/analytics/components/OrgPropertyComparisonTable';
import { useOrgAnalyticsSummary } from '@/features/dashboard/analytics/hooks/useOrgAnalyticsSummary';
import {
  rangeForPreset,
  type AnalyticsRangePreset,
} from '@/features/dashboard/analytics/lib/analyticsDateRange';

import { AdminMobilePage } from '@/components/mobile/MobileBrandHero';
import { DashboardSkeleton } from '@/components/skeletons/AdminSkeletons';

export function OrgAnalyticsPage() {
  const [preset, setPreset] = useState<AnalyticsRangePreset>('last-30d');
  const range = rangeForPreset(preset);
  const { data, isLoading, isError } = useOrgAnalyticsSummary(range);

  return (
    <AdminMobilePage
      title="Portfolio Analytics"
      subtitle="Compare performance across every property in this organization"
      desktopActions={<AnalyticsDateRangeControl preset={preset} onChange={setPreset} />}
    >
      <div className="flex flex-col gap-2.5 sm:gap-3 lg:gap-4">
        <div className="lg:hidden">
          <AnalyticsDateRangeControl preset={preset} onChange={setPreset} />
        </div>

        {isLoading ? (
          <DashboardSkeleton />
        ) : isError || !data ? (
          <div className="surface-card p-6 text-center">
            <p className="text-muted-foreground text-sm">
              Couldn't load portfolio analytics. Try again shortly.
            </p>
          </div>
        ) : (
          <>
            <OrgAnalyticsKpiCards portfolio={data.portfolio} />
            <OrgPropertyComparisonTable rows={data.rows} />
          </>
        )}
      </div>
    </AdminMobilePage>
  );
}
