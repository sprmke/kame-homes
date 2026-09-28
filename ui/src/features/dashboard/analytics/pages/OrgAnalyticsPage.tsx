import { useCallback, useEffect, useMemo } from 'react';

import { useParams, useSearchParams } from 'react-router-dom';

import { Download } from 'lucide-react';

import { OrgAnalyticsKpiCards } from '@/features/dashboard/analytics/components/OrgAnalyticsKpiCards';
import { OrgAnalyticsListingsSection } from '@/features/dashboard/analytics/components/OrgAnalyticsListingsSection';
import { useOrgAnalyticsSummary } from '@/features/dashboard/analytics/hooks/useOrgAnalyticsSummary';
import { downloadCsv, orgPortfolioRowsToCsv } from '@/features/dashboard/analytics/lib/exportCsv';
import {
  defaultAnalyticsPeriod,
  resolveAnalyticsPeriod,
  writeAnalyticsPeriodParams,
} from '@/features/dashboard/analytics/lib/analyticsPeriod';
import { BookingDateRangeFilter } from '@/features/dashboard/bookings/components/BookingDateRangeFilter';
import {
  useDateNavigation,
  useSyncDateRangeWithQuery,
} from '@/features/dashboard/bookings/hooks/useDateNavigation';
import { useOrgListingSkeletonView } from '@/features/dashboard/org/hooks/useOrgListingSkeletonView';
import { TierBadgeAnchor } from '@/features/dashboard/plans/components/TierBadge';
import { useUpgradeModal } from '@/features/dashboard/plans/components/UpgradeModalProvider';
import { useFeatureGate } from '@/features/dashboard/plans/hooks/useFeatureGate';
import { useOrgPermissions } from '@/features/dashboard/team/hooks/useOrgPermissions';
import { hasOrgPermission } from '@/features/dashboard/team/lib/orgPermissions';

import { FloatingPanel, FloatingToolbar } from '@/components/mobile/FloatingPanel';
import { AdminMobilePage } from '@/components/mobile/MobileBrandHero';
import { MobileHeroActionMenu } from '@/components/mobile/MobileHeroActionButton';
import { OrgAnalyticsSkeleton } from '@/components/skeletons/AnalyticsSkeleton';
import { Button } from '@/components/ui/button';
import { useIsBelowMd } from '@/hooks/useMediaQuery';
import { detectPresetFromRange, fromIsoDate } from '@/lib/date/navigation';

export function OrgAnalyticsPage() {
  const { orgSlug = '' } = useParams<{ orgSlug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const isBelowMd = useIsBelowMd();

  const period = useMemo(() => resolveAnalyticsPeriod(searchParams), [searchParams]);
  const initialFrom = fromIsoDate(period.from);
  const initialTo = fromIsoDate(period.to);
  const dateNav = useDateNavigation({
    initialPreset:
      initialFrom && initialTo ? detectPresetFromRange(initialFrom, initialTo) : 'month',
    initialRange: initialFrom && initialTo ? { from: initialFrom, to: initialTo } : null,
  });

  useEffect(() => {
    if (searchParams.get('from') || searchParams.get('to')) return;
    setSearchParams(writeAnalyticsPeriodParams(defaultAnalyticsPeriod(), searchParams), {
      replace: true,
    });
  }, [searchParams, setSearchParams]);

  const patchPeriod = useCallback(
    (next: { from: string | null; to: string | null }) => {
      if (!next.from || !next.to) return;
      setSearchParams(writeAnalyticsPeriodParams({ from: next.from, to: next.to }, searchParams), {
        replace: true,
      });
    },
    [searchParams, setSearchParams]
  );

  useSyncDateRangeWithQuery(dateNav, period.from, period.to, patchPeriod);

  const handleClearDate = useCallback(() => {
    dateNav.setDatePreset('month');
  }, [dateNav]);

  const { data, isLoading, isError, refetch } = useOrgAnalyticsSummary(period);
  const skeletonView = useOrgListingSkeletonView('listings');
  const { data: access } = useOrgPermissions();
  const canExport = hasOrgPermission(access?.permissions, 'org.analytics:export');
  const { canUse: canExportByPlan, isLoading: exportPlanLoading } =
    useFeatureGate('analyticsInsights');
  const { open: openUpgradeModal } = useUpgradeModal();

  const handleExportCsv = useCallback(() => {
    if (!canExportByPlan) {
      if (!exportPlanLoading) openUpgradeModal('analyticsInsights');
      return;
    }
    if (!data?.rows) return;
    downloadCsv(orgPortfolioRowsToCsv(data.rows), `portfolio-analytics-${orgSlug}.csv`);
  }, [canExportByPlan, data?.rows, exportPlanLoading, openUpgradeModal, orgSlug]);

  const exportButton =
    canExport && data ? (
      <TierBadgeAnchor feature="analyticsInsights">
        <Button
          variant="outline"
          onClick={handleExportCsv}
          className="min-h-[44px] w-full gap-1.5 sm:w-auto"
        >
          <Download className="size-4" aria-hidden />
          Export CSV
        </Button>
      </TierBadgeAnchor>
    ) : null;

  const desktopActions = (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
      <BookingDateRangeFilter
        {...dateNav}
        isActive
        onClear={handleClearDate}
        fullWidth={isBelowMd}
      />
      {exportButton}
    </div>
  );

  const overlapControls = (
    <FloatingToolbar>
      <BookingDateRangeFilter {...dateNav} isActive onClear={handleClearDate} fullWidth />
    </FloatingToolbar>
  );

  const heroActions =
    canExport && data ? (
      <MobileHeroActionMenu
        label="Analytics actions"
        items={[
          {
            key: 'export-csv',
            label: 'Export CSV',
            Icon: Download,
            onSelect: handleExportCsv,
          },
        ]}
      />
    ) : undefined;

  return (
    <AdminMobilePage
      title="Analytics"
      titleId="org-analytics-heading"
      heroTrailing={heroActions}
      overlap={overlapControls}
      desktopActions={desktopActions}
      desktopActionsClassName="w-full sm:w-auto"
      dense
      className="min-w-0 max-w-full"
    >
      {isLoading && !data ? (
        <OrgAnalyticsSkeleton view={skeletonView} />
      ) : isError && !data ? (
        <FloatingPanel padding="lg" className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-foreground text-sm font-semibold">Could not load analytics</p>
          <p className="text-caption max-w-sm">Please try again.</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="native-cta max-w-xs sm:w-auto sm:px-4"
          >
            Retry
          </button>
        </FloatingPanel>
      ) : data ? (
        <div className="native-stagger flex min-w-0 flex-col gap-2.5 sm:gap-3 lg:gap-4">
          <OrgAnalyticsKpiCards portfolio={data.portfolio} />
          <OrgAnalyticsListingsSection rows={data.rows} />
        </div>
      ) : null}
    </AdminMobilePage>
  );
}
