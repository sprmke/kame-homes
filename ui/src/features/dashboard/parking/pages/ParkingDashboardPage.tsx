import { useCallback, useEffect, useMemo } from 'react';

import { useSearchParams } from 'react-router-dom';

import { ExternalLink } from 'lucide-react';

import { BookingDateRangeFilter } from '@/features/dashboard/bookings/components/BookingDateRangeFilter';
import {
  useDateNavigation,
  useSyncDateRangeWithQuery,
} from '@/features/dashboard/bookings/hooks/useDateNavigation';
import { useParkingContext } from '@/features/dashboard/org/components/RequireParkingContext';
import { absoluteGuestParkingUrl } from '@/features/dashboard/org/lib/guestPublicPaths';
import { parkingSectionPath } from '@/features/dashboard/org/lib/tenantPaths';
import { ParkingDashboardCalendarSection } from '@/features/dashboard/parking/components/ParkingDashboardCalendarSection';
import { ParkingDashboardStatCards } from '@/features/dashboard/parking/components/ParkingDashboardStatCards';
import { useParkingDashboardStats } from '@/features/dashboard/parking/hooks/useParkingDashboardStats';
import { buildEmptyParkingDashboardStats } from '@/features/dashboard/parking/lib/parkingDashboardStats';
import { DashboardAttentionStrip } from '@/features/dashboard/property/components/DashboardAttentionStrip';
import {
  defaultDashboardPeriod,
  resolveDashboardPeriod,
  writeDashboardPeriodParams,
} from '@/features/dashboard/property/lib/dashboardPeriod';

import { FloatingToolbar } from '@/components/mobile/FloatingPanel';
import { AdminMobilePage } from '@/components/mobile/MobileBrandHero';
import { mobileHeroActionClassName } from '@/components/mobile/MobileHeroActionButton';
import { useIsBelowMd } from '@/hooks/useMediaQuery';
import { detectPresetFromRange, fromIsoDate } from '@/lib/date/navigation';
import { ParkingDashboardSkeleton } from '@/components/skeletons/ParkingSkeleton';
import { cn } from '@/lib/utils';

export function ParkingDashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const isBelowMd = useIsBelowMd();
  const { parking, orgSlug, parkingSlug } = useParkingContext();
  const publicParkingHref = absoluteGuestParkingUrl(parkingSlug);

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

  const { data: statsData, isLoading, error, refetch } = useParkingDashboardStats();

  const stats = useMemo(
    () => statsData ?? buildEmptyParkingDashboardStats(period, dateNav.datePreset),
    [statsData, period, dateNav.datePreset]
  );

  const reservationsHref = `${parkingSectionPath(orgSlug, parkingSlug, 'bookings')}?from=${period.from}&to=${period.to}`;

  const desktopActions = (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
      <BookingDateRangeFilter
        {...dateNav}
        isActive
        onClear={handleClearDate}
        fullWidth={isBelowMd}
      />
      <a
        href={publicParkingHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="View parking"
        className={cn(
          'inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-3 py-2 sm:px-3.5',
          'gradient-primary text-primary-foreground shadow-soft text-[13px] font-semibold',
          'hover:shadow-primary-glow transition-all duration-200 motion-safe:active:scale-[0.98]'
        )}
      >
        <ExternalLink className="size-4 shrink-0" aria-hidden />
        <span className="hidden sm:inline">View Parking</span>
      </a>
    </div>
  );

  const overlapControls = (
    <FloatingToolbar>
      <BookingDateRangeFilter {...dateNav} isActive onClear={handleClearDate} fullWidth />
    </FloatingToolbar>
  );

  const heroViewParking = (
    <a
      href={publicParkingHref}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="View parking"
      className={mobileHeroActionClassName}
    >
      <ExternalLink className="size-5" aria-hidden />
    </a>
  );

  return (
    <AdminMobilePage
      title="Dashboard"
      subtitle={`Overview for ${parking.name}.`}
      titleId="dashboard-heading"
      heroTrailing={heroViewParking}
      overlap={overlapControls}
      desktopActions={desktopActions}
      desktopActionsClassName="w-full sm:w-auto"
      dense
      className="min-w-0 max-w-full"
    >
      {isLoading && !statsData ? (
        <ParkingDashboardSkeleton />
      ) : error ? (
        <p className="text-destructive text-sm">
          {error instanceof Error ? error.message : 'Could not load dashboard.'}
          <button type="button" className="text-primary ml-2 underline" onClick={() => refetch()}>
            Retry
          </button>
        </p>
      ) : (
        <>
          <DashboardAttentionStrip items={stats.attention} />

          <ParkingDashboardStatCards stats={stats} reservationsHref={reservationsHref} />

          {period.from && period.to ? (
            <ParkingDashboardCalendarSection
              from={period.from}
              to={period.to}
              datePreset={dateNav.datePreset}
            />
          ) : null}
        </>
      )}
    </AdminMobilePage>
  );
}
