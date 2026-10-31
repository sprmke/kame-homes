import { useCallback, useEffect, useMemo } from 'react';

import { useSearchParams } from 'react-router-dom';

import { BookingDateRangeFilter } from '@/features/dashboard/bookings/components/BookingDateRangeFilter';
import {
  useDateNavigation,
  useSyncDateRangeWithQuery,
} from '@/features/dashboard/bookings/hooks/useDateNavigation';
import { useOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { usePropertyRejectedExternalReviewsAttentionItem } from '@/features/dashboard/org/hooks/usePropertyRejectedExternalReviewsAttentionItem';
import { DashboardFinanceCalendarSection } from '@/features/dashboard/property/components/DashboardFinanceCalendarSection';
import { DashboardStatCards } from '@/features/dashboard/property/components/DashboardStatCards';
import { ViewPropertyButton } from '@/features/dashboard/property/components/ViewPropertyButton';
import { useDashboardStats } from '@/features/dashboard/property/hooks/useDashboardStats';
import {
  defaultDashboardPeriod,
  resolveDashboardPeriod,
  writeDashboardPeriodParams,
} from '@/features/dashboard/property/lib/dashboardPeriod';
import type { DashboardAttentionItem } from '@/features/dashboard/property/lib/types';
import { usePropertyPermissions } from '@/features/dashboard/team/hooks/usePropertyPermissions';
import { hasPropertyPermission } from '@/features/dashboard/team/lib/propertyPermissions';

import { FloatingPanel, FloatingToolbar } from '@/components/mobile/FloatingPanel';
import { AdminMobilePage } from '@/components/mobile/MobileBrandHero';
import { DashboardSkeleton } from '@/components/skeletons/AdminSkeletons';
import { useIsBelowMd } from '@/hooks/useMediaQuery';
import { detectPresetFromRange, fromIsoDate } from '@/lib/date/navigation';

/**
 * THESIS: KPIs lead; equal 2×3 board for ops + money + calendar.
 * OWN-WORLD: Kame surface-card peers, Plus Jakarta admin density.
 * STORY: Scan period stats, then attention/calendar, cash, maintenance/transactions.
 * FIRST VIEWPORT: KPI strip, then Calendar | Needs attention (Recent bookings when clear).
 * FORM: equal-width board (user 2026-08-09).
 */
export function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const isBelowMd = useIsBelowMd();
  const { propertySlug, orgSlug } = useOrgContext();
  const { data: access } = usePropertyPermissions();
  const canViewFinance = hasPropertyPermission(access?.permissions, 'finance:view');
  const canViewMaintenance = hasPropertyPermission(access?.permissions, 'maintenance:view');
  const { data, isLoading, error, refetch } = useDashboardStats();

  const period = useMemo(() => resolveDashboardPeriod(searchParams), [searchParams]);

  const initialFrom = fromIsoDate(period.from);
  const initialTo = fromIsoDate(period.to);
  const dateNav = useDateNavigation({
    initialPreset:
      initialFrom && initialTo ? detectPresetFromRange(initialFrom, initialTo) : 'month',
    initialRange: initialFrom && initialTo ? { from: initialFrom, to: initialTo } : null,
  });

  useEffect(() => {
    if (searchParams.get('from') || searchParams.get('to')) return;
    const def = defaultDashboardPeriod();
    setSearchParams(writeDashboardPeriodParams(def, searchParams), {
      replace: true,
    });
  }, [searchParams, setSearchParams]);

  const patchPeriod = useCallback(
    (next: { from: string | null; to: string | null }) => {
      if (!next.from || !next.to) return;
      setSearchParams(writeDashboardPeriodParams({ from: next.from, to: next.to }, searchParams), {
        replace: true,
      });
    },
    [searchParams, setSearchParams]
  );

  useSyncDateRangeWithQuery(dateNav, period.from, period.to, patchPeriod);

  const handleClearDate = useCallback(() => {
    dateNav.setDatePreset('year');
  }, [dateNav]);

  const rejectedReviewsAttentionItem = usePropertyRejectedExternalReviewsAttentionItem();

  const attentionItems = useMemo(() => {
    const clientItems = [rejectedReviewsAttentionItem].filter(
      (item): item is DashboardAttentionItem => item != null
    );
    if (!data) return clientItems;
    return [...clientItems, ...data.attention];
  }, [data, rejectedReviewsAttentionItem]);

  const dashboardActions = (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
      <BookingDateRangeFilter
        {...dateNav}
        isActive
        onClear={handleClearDate}
        fullWidth={isBelowMd}
      />
      <ViewPropertyButton propertySlug={propertySlug} />
    </div>
  );

  const overlapControls = (
    <FloatingToolbar>
      <BookingDateRangeFilter {...dateNav} isActive onClear={handleClearDate} fullWidth />
    </FloatingToolbar>
  );

  const heroViewProperty = <ViewPropertyButton propertySlug={propertySlug} variant="heroIcon" />;

  return (
    <AdminMobilePage
      title="Dashboard"
      subtitle="Overview of your property's performance and activity."
      titleId="dashboard-heading"
      heroTrailing={heroViewProperty}
      overlap={overlapControls}
      desktopActions={dashboardActions}
      desktopActionsClassName="w-full sm:w-auto"
      dense
      className="min-w-0 max-w-full"
    >
      {isLoading && !data ? (
        <DashboardSkeleton />
      ) : error ? (
        <FloatingPanel padding="lg" className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-foreground text-sm font-semibold">Could not load dashboard</p>
          <p className="text-caption max-w-sm">
            {error instanceof Error ? error.message : 'Please try again.'}
          </p>
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
          <DashboardStatCards stats={data} />

          {period.from && period.to ? (
            <DashboardFinanceCalendarSection
              from={period.from}
              to={period.to}
              datePreset={dateNav.datePreset}
              attentionItems={attentionItems}
              recentBookings={data.recentBookings ?? []}
              orgSlug={orgSlug}
              propertySlug={propertySlug}
              attentionLoading={isLoading}
              canViewFinance={canViewFinance}
              canViewMaintenance={canViewMaintenance}
            />
          ) : null}
        </div>
      ) : null}
    </AdminMobilePage>
  );
}
