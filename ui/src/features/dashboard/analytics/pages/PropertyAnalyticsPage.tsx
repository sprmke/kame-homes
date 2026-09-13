import { useCallback, useEffect, useMemo, useState } from 'react';

import { useSearchParams } from 'react-router-dom';

import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { AiPerformanceReviewCard } from '@/features/dashboard/analytics/components/AiPerformanceReviewCard';
import { AnalyticsEmptyState } from '@/features/dashboard/analytics/components/AnalyticsEmptyState';
import { AnalyticsKpiStrip } from '@/features/dashboard/analytics/components/AnalyticsKpiStrip';
import { AnalyticsOverviewSection } from '@/features/dashboard/analytics/components/AnalyticsOverviewSection';
import {
  AnalyticsSectionTabs,
  type AnalyticsSection,
} from '@/features/dashboard/analytics/components/AnalyticsSectionTabs';
import { AnalyticsStateStrip } from '@/features/dashboard/analytics/components/AnalyticsStateStrip';
import { AnalyticsTeaserKpiStrip } from '@/features/dashboard/analytics/components/AnalyticsTeaserKpiStrip';
import { BookingPaceCard } from '@/features/dashboard/analytics/components/BookingPaceCard';
import { ChannelMixCard } from '@/features/dashboard/analytics/components/ChannelMixCard';
import { GuestInsightsCard } from '@/features/dashboard/analytics/components/GuestInsightsCard';
import { LeadTimeLosCard } from '@/features/dashboard/analytics/components/LeadTimeLosCard';
import { PlaybookList } from '@/features/dashboard/analytics/components/PlaybookList';
import { useAnalyticsAiReview } from '@/features/dashboard/analytics/hooks/useAnalyticsAiReview';
import { usePropertyAnalyticsSummary } from '@/features/dashboard/analytics/hooks/usePropertyAnalyticsSummary';
import {
  defaultAnalyticsPeriod,
  resolveAnalyticsPeriod,
  writeAnalyticsPeriodParams,
} from '@/features/dashboard/analytics/lib/analyticsPeriod';
import { downloadAnalyticsReportPdf } from '@/features/dashboard/analytics/lib/exportPdf';
import { isFullAnalyticsBundle } from '@/features/dashboard/analytics/lib/types';
import { BookingDateRangeFilter } from '@/features/dashboard/bookings/components/BookingDateRangeFilter';
import {
  useDateNavigation,
  useSyncDateRangeWithQuery,
} from '@/features/dashboard/bookings/hooks/useDateNavigation';
import { useOptionalOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { TierBadge } from '@/features/dashboard/plans/components/TierBadge';
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
  const { canUse } = useFeatureGate('analyticsInsights');
  const { open: openUpgradeModal } = useUpgradeModal();
  const { data: aiReview, isLoading: isAiReviewLoading } = useAnalyticsAiReview();
  const orgContext = useOptionalOrgContext();
  const brandColor = usePdfBrandColor();
  const { data: propertyAccess } = usePropertyPermissions();
  const canExportPdf = hasPropertyPermission(propertyAccess?.permissions, 'analytics:export');
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const handleExportPdf = useCallback(async () => {
    if (!data || !isFullAnalyticsBundle(data)) return;
    setIsExportingPdf(true);
    try {
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
  }, [data, aiReview, dateNav.dateRange, dateNav.datePreset, orgContext, brandColor]);

  const isFullDashboard = canUse && data != null && isFullAnalyticsBundle(data);

  const desktopActions = (
    <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-2">
      <BookingDateRangeFilter
        {...dateNav}
        isActive
        onClear={handleClearDate}
        fullWidth={isBelowMd}
      />
      {isFullDashboard && canExportPdf ? (
        <Button
          variant="outline"
          onClick={() => void handleExportPdf()}
          disabled={isExportingPdf}
          className="w-full gap-1.5 sm:w-auto"
        >
          {isExportingPdf ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Download className="size-4" aria-hidden />
          )}
          Export PDF
        </Button>
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
      badge={<TierBadge feature="analyticsInsights" />}
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
          <>
            <AnalyticsTeaserKpiStrip kpis={data.kpis} />
            <div className="surface-card flex flex-col items-center gap-3 p-8 text-center">
              <p className="text-foreground text-sm font-semibold">
                Unlock the full Analytics dashboard
              </p>
              <p className="text-muted-foreground max-w-md text-sm">
                Trends, guest insights, forward-looking occupancy, and the AI performance review are
                available on Pro and above.
              </p>
              <Button onClick={() => openUpgradeModal('analyticsInsights')}>View plans</Button>
            </div>
          </>
        ) : (
          <>
            <AnalyticsStateStrip state={data.stateAssessment} />
            <AnalyticsKpiStrip kpis={data.kpis} period={data.period} />
            <AnalyticsSectionTabs section={section} onSectionChange={setSection} />

            {section === 'overview' ? (
              <AnalyticsOverviewSection
                bundle={data}
                orgSlug={orgContext?.orgSlug ?? ''}
                propertySlug={orgContext?.propertySlug ?? ''}
                onOpenReview={() => setSection('ai-review')}
              />
            ) : null}

            {section === 'trends' ? (
              <div className={SECTION_GAP}>
                <BookingPaceCard pace={data.bookingPace} />
                <LeadTimeLosCard
                  lengthOfStay={data.distributions.lengthOfStay}
                  leadTime={data.distributions.leadTime}
                />
              </div>
            ) : null}

            {section === 'guests' ? (
              <div className="grid gap-2.5 sm:gap-3 lg:grid-cols-2 lg:gap-4">
                <ChannelMixCard channelMix={data.distributions.channelMix} />
                <GuestInsightsCard
                  guestAge={data.distributions.guestAge}
                  guestOrigins={data.distributions.guestOrigins}
                />
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
