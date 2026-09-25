import { useCallback, useEffect, useMemo, useState } from 'react';

import { useSearchParams } from 'react-router-dom';

import { CalendarRange, Download, Loader2, Moon } from 'lucide-react';
import { toast } from 'sonner';

import { AiPerformanceReviewCard } from '@/features/dashboard/analytics/components/AiPerformanceReviewCard';
import { AnalyticsDistributionCard } from '@/features/dashboard/analytics/components/AnalyticsDistributionCard';
import { AnalyticsEmptyState } from '@/features/dashboard/analytics/components/AnalyticsEmptyState';
import { AnalyticsGuestSignalsCard } from '@/features/dashboard/analytics/components/AnalyticsGuestSignalsCard';
import { AnalyticsKpiStrip } from '@/features/dashboard/analytics/components/AnalyticsKpiStrip';
import { AnalyticsOverviewSection } from '@/features/dashboard/analytics/components/AnalyticsOverviewSection';
import {
  AnalyticsSectionTabs,
  type AnalyticsSection,
} from '@/features/dashboard/analytics/components/AnalyticsSectionTabs';
import { BookingPaceCard } from '@/features/dashboard/analytics/components/BookingPaceCard';
import { ChannelMixCard } from '@/features/dashboard/analytics/components/ChannelMixCard';
import { GuestAgeCard } from '@/features/dashboard/analytics/components/GuestAgeCard';
import { GuestOriginsCard } from '@/features/dashboard/analytics/components/GuestOriginsCard';
import { GuestPartySizeCard } from '@/features/dashboard/analytics/components/GuestPartySizeCard';
import { PlaybookList } from '@/features/dashboard/analytics/components/PlaybookList';
import { useAnalyticsAiReview } from '@/features/dashboard/analytics/hooks/useAnalyticsAiReview';
import { usePropertyAnalyticsSummary } from '@/features/dashboard/analytics/hooks/usePropertyAnalyticsSummary';
import {
  LEAD_TIME_BUCKET_ORDER,
  LENGTH_OF_STAY_BUCKET_ORDER,
} from '@/features/dashboard/analytics/lib/analyticsDistributionRange';
import {
  defaultAnalyticsPeriod,
  resolveAnalyticsPeriod,
  writeAnalyticsPeriodParams,
} from '@/features/dashboard/analytics/lib/analyticsPeriod';
import { isFullAnalyticsBundle } from '@/features/dashboard/analytics/lib/types';
import { BookingDateRangeFilter } from '@/features/dashboard/bookings/components/BookingDateRangeFilter';
import {
  useDateNavigation,
  useSyncDateRangeWithQuery,
} from '@/features/dashboard/bookings/hooks/useDateNavigation';
import { useOptionalOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { TierBadgeAnchor } from '@/features/dashboard/plans/components/TierBadge';
import { useUpgradeModal } from '@/features/dashboard/plans/components/UpgradeModalProvider';
import { useFeatureGate } from '@/features/dashboard/plans/hooks/useFeatureGate';
import { usePropertyPermissions } from '@/features/dashboard/team/hooks/usePropertyPermissions';
import { hasPropertyPermission } from '@/features/dashboard/team/lib/propertyPermissions';

import { FloatingToolbar } from '@/components/mobile/FloatingPanel';
import { AdminMobilePage } from '@/components/mobile/MobileBrandHero';
import { MobileHeroActionMenu } from '@/components/mobile/MobileHeroActionButton';
import { DashboardSkeleton } from '@/components/skeletons/AdminSkeletons';
import { Button } from '@/components/ui/button';
import { useIsBelowMd } from '@/hooks/useMediaQuery';
import { CHART_INCOME_COLOR, CHART_INFO_COLOR } from '@/lib/charts/chartStyles';
import { detectPresetFromRange, fromIsoDate, formatDateRangeDisplay } from '@/lib/date/navigation';
import { friendlyToastError } from '@/lib/feedback/toastMessages';
import { pdfPropertyScope } from '@/lib/pdf/pdfScopeLabel';
import { usePdfBrandColor } from '@/lib/pdf/usePdfBrandColor';

const SECTION_GAP = 'flex flex-col gap-2.5 sm:gap-3 lg:gap-4';

export function PropertyAnalyticsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const isBelowMd = useIsBelowMd();
  const [section, setSection] = useState<AnalyticsSection>('overview');

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

  const { data, isLoading, isError } = usePropertyAnalyticsSummary(period);
  const { canUse: canExportByPlan, isLoading: exportPlanLoading } =
    useFeatureGate('analyticsInsights');
  const { open: openUpgradeModal } = useUpgradeModal();
  const { data: aiReview, isLoading: isAiReviewLoading } = useAnalyticsAiReview();
  const orgContext = useOptionalOrgContext();
  const brandColor = usePdfBrandColor();
  const { data: propertyAccess } = usePropertyPermissions();
  const canExportPdf = hasPropertyPermission(propertyAccess?.permissions, 'analytics:export');
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const handleExportPdf = useCallback(async () => {
    if (!canExportByPlan) {
      if (!exportPlanLoading) openUpgradeModal('analyticsInsights');
      return;
    }
    if (!data || !isFullAnalyticsBundle(data)) return;
    setIsExportingPdf(true);
    try {
      const { downloadAnalyticsReportPdf } =
        await import('@/features/dashboard/analytics/lib/exportPdf');
      await downloadAnalyticsReportPdf({
        bundle: data,
        aiReview: aiReview ?? null,
        periodLabel: formatDateRangeDisplay(
          dateNav.dateRange.from,
          dateNav.dateRange.to,
          dateNav.datePreset
        ),
        scopeLabel: orgContext?.property ? pdfPropertyScope(orgContext.property).label : null,
        brandColor,
      });
      toast.success('PDF downloaded');
    } catch (error) {
      toast.error(friendlyToastError(error, 'PDF export failed'));
    } finally {
      setIsExportingPdf(false);
    }
  }, [
    canExportByPlan,
    exportPlanLoading,
    openUpgradeModal,
    data,
    aiReview,
    dateNav.dateRange,
    dateNav.datePreset,
    orgContext,
    brandColor,
  ]);

  const isFullDashboard = data != null && isFullAnalyticsBundle(data);

  const desktopActions = (
    <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-2">
      <BookingDateRangeFilter
        {...dateNav}
        isActive
        onClear={handleClearDate}
        fullWidth={isBelowMd}
      />
      {isFullDashboard && canExportPdf ? (
        <TierBadgeAnchor feature="analyticsInsights">
          <Button
            variant="outline"
            onClick={() => void handleExportPdf()}
            disabled={isExportingPdf}
            className="min-h-[44px] w-full gap-1.5 sm:w-auto"
          >
            {isExportingPdf ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Download className="size-4" aria-hidden />
            )}
            Export PDF
          </Button>
        </TierBadgeAnchor>
      ) : null}
    </div>
  );

  const overlapControls = (
    <FloatingToolbar>
      <BookingDateRangeFilter {...dateNav} isActive onClear={handleClearDate} fullWidth />
    </FloatingToolbar>
  );

  const heroActions =
    isFullDashboard && canExportPdf ? (
      <MobileHeroActionMenu
        label="Analytics actions"
        items={[
          {
            key: 'export-pdf',
            label: 'Export PDF',
            Icon: Download,
            onSelect: () => void handleExportPdf(),
            disabled: isExportingPdf,
          },
        ]}
      />
    ) : undefined;

  return (
    <AdminMobilePage
      title="Analytics"
      heroTrailing={heroActions}
      overlap={overlapControls}
      desktopActions={desktopActions}
      desktopActionsClassName="w-full sm:w-auto"
    >
      <div className={SECTION_GAP}>
        {isLoading ? (
          <DashboardSkeleton />
        ) : isError || !data ? (
          <div className="surface-card p-6 text-center">
            <p className="text-muted-foreground text-sm">
              Couldn't load analytics. Try again shortly.
            </p>
          </div>
        ) : data.sufficiency.sampleSize < 10 ? (
          <AnalyticsEmptyState sampleSize={data.sufficiency.sampleSize} />
        ) : !isFullDashboard ? (
          <div className="surface-card p-6 text-center">
            <p className="text-muted-foreground text-sm">
              Couldn't load analytics. Try again shortly.
            </p>
          </div>
        ) : (
          <>
            <AnalyticsKpiStrip kpis={data.kpis} />
            <AnalyticsSectionTabs section={section} onSectionChange={setSection} />

            {section === 'overview' ? <AnalyticsOverviewSection bundle={data} /> : null}

            {section === 'trends' ? (
              <div className={SECTION_GAP}>
                <BookingPaceCard pace={data.bookingPace} />
                <div className="grid gap-2.5 sm:gap-3 lg:grid-cols-3 lg:gap-4">
                  <AnalyticsDistributionCard
                    icon={CalendarRange}
                    title="Lead time"
                    sectionLabel="Booked this far ahead"
                    data={data.distributions.leadTime}
                    bucketOrder={LEAD_TIME_BUCKET_ORDER}
                    dataKeyLabel="bookings"
                    color={CHART_INFO_COLOR}
                  />
                  <AnalyticsDistributionCard
                    icon={Moon}
                    title="Length of stay"
                    sectionLabel="Nights per stay"
                    data={data.distributions.lengthOfStay}
                    bucketOrder={LENGTH_OF_STAY_BUCKET_ORDER}
                    dataKeyLabel="bookings"
                    color={CHART_INCOME_COLOR}
                  />
                  <AnalyticsGuestSignalsCard kpis={data.kpis} />
                </div>
              </div>
            ) : null}

            {section === 'guests' ? (
              <div className="grid gap-2.5 sm:gap-3 lg:grid-cols-2 lg:gap-4">
                <ChannelMixCard channelMix={data.distributions.channelMix} />
                <GuestAgeCard guestAge={data.distributions.guestAge} />
                <GuestPartySizeCard partySize={data.distributions.partySize} />
                <GuestOriginsCard guestOrigins={data.distributions.guestOrigins} />
              </div>
            ) : null}

            {section === 'ai-review' ? (
              <div className={SECTION_GAP}>
                <AiPerformanceReviewCard
                  review={aiReview ?? null}
                  isLoading={isAiReviewLoading}
                  playbookArticles={data.playbook}
                />
                <PlaybookList articles={data.playbook} />
              </div>
            ) : null}
          </>
        )}
      </div>
    </AdminMobilePage>
  );
}
