import { useCallback, useEffect, useMemo, useState } from 'react';

import { useSearchParams } from 'react-router-dom';

import { endOfMonth, format, startOfMonth } from 'date-fns';
import { CalendarPlus } from 'lucide-react';

import { AdminListPagination } from '@/features/dashboard/bookings/components/AdminListToolbar';
import { BookingCalendarView } from '@/features/dashboard/bookings/components/BookingCalendarView';
import { BookingCardGrid } from '@/features/dashboard/bookings/components/BookingCardGrid';
import { BookingDateRangeFilter } from '@/features/dashboard/bookings/components/BookingDateRangeFilter';
import { BookingFilters } from '@/features/dashboard/bookings/components/BookingFilters';
import { BookingsSummaryCards } from '@/features/dashboard/bookings/components/BookingsSummaryCards';
import { BookingTable } from '@/features/dashboard/bookings/components/BookingTable';
import type { BookingView } from '@/features/dashboard/bookings/components/BookingViewToggle';
import {
  useDateNavigation,
  useSyncDateRangeWithQuery,
} from '@/features/dashboard/bookings/hooks/useDateNavigation';
import { resolveBookingListHref } from '@/features/dashboard/bookings/lib/bookingListNavigation';
import {
  countBookingsByStage,
  effectiveStatusFilter,
  parseBookingStage,
  type BookingStage,
} from '@/features/dashboard/bookings/lib/bookingStages';
import { PARKING_ONLY_STATUSES } from '@/features/dashboard/bookings/lib/bookingStatus';
import {
  DEFAULT_BOOKINGS_QUERY,
  type BookingsQuery,
  type BookingsSort,
} from '@/features/dashboard/bookings/lib/types';
import { useParkingContext } from '@/features/dashboard/org/components/RequireParkingContext';
import { AdminParkingNewBookingModal } from '@/features/dashboard/parking/components/AdminParkingNewBookingModal';
import { useParkingBookings } from '@/features/dashboard/parking/hooks/useParkingBookings';

import { FloatingPanel, FloatingToolbar } from '@/components/mobile/FloatingPanel';
import { AdminMobilePage } from '@/components/mobile/MobileBrandHero';
import { MobileHeroActionButton } from '@/components/mobile/MobileHeroActionButton';
import { useIsBelowLg, useIsBelowMd } from '@/hooks/useMediaQuery';
import { fromIsoDate } from '@/lib/date/navigation';
import { buildPageItems, normalizeAdminPageLimit } from '@/lib/table/pagination';

const BOARD_BOOKINGS_LIMIT = 100;
const VIEWS: ReadonlyArray<BookingView> = ['table', 'card', 'calendar'];

const PARKING_STAGE_LABELS = {
  action_required: 'Needs action',
  pending_docs: 'Pending',
  confirmed: 'Active',
  history: 'Completed',
} as const;

function parseQueryFromParams(sp: URLSearchParams): BookingsQuery {
  const statuses = (sp.get('status') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const page = Number(sp.get('page') ?? '1');
  const limit = Number(sp.get('limit') ?? String(DEFAULT_BOOKINGS_QUERY.limit));
  const sortParam = (sp.get('sort') ?? DEFAULT_BOOKINGS_QUERY.sort) as BookingsSort;
  const VALID_SORTS: BookingsSort[] = [
    'status_priority:asc',
    'check_in_date:asc',
    'check_in_date:desc',
    'created_at:asc',
    'created_at:desc',
  ];
  const sort: BookingsSort = VALID_SORTS.includes(sortParam as BookingsSort)
    ? (sortParam as BookingsSort)
    : DEFAULT_BOOKINGS_QUERY.sort;
  return {
    q: sp.get('q') ?? '',
    status: statuses,
    from: sp.get('from'),
    to: sp.get('to'),
    hasPets: null,
    needParking: null,
    bookingKind: null,
    showCompletedBookings:
      sp.get('showCompletedBookings') === 'true' || sp.get('showPreviousBookings') === 'true',
    sort,
    page: Number.isFinite(page) && page > 0 ? Math.floor(page) : 1,
    limit: normalizeAdminPageLimit(limit),
  };
}

function parseViewFromParams(sp: URLSearchParams, isMobileLayout: boolean): BookingView {
  const v = sp.get('view') as BookingView | null;
  if (v === 'kanban') return isMobileLayout ? 'card' : 'table';
  if (v && VIEWS.includes(v)) {
    if (isMobileLayout && v === 'table') return 'card';
    return v;
  }
  return isMobileLayout ? 'card' : 'table';
}

function writeQueryToParams(q: BookingsQuery, cur: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(cur);
  const set = (k: string, v: string | null | undefined) => {
    if (!v) next.delete(k);
    else next.set(k, v);
  };
  set('q', q.q);
  set('status', q.status.length ? q.status.join(',') : null);
  set('from', q.from);
  set('to', q.to);
  set('showCompletedBookings', q.showCompletedBookings ? 'true' : null);
  set('sort', q.sort === DEFAULT_BOOKINGS_QUERY.sort ? null : q.sort);
  set('page', q.page === 1 ? null : String(q.page));
  set('limit', q.limit === DEFAULT_BOOKINGS_QUERY.limit ? null : String(q.limit));
  return next;
}

export function ParkingBookingsPage() {
  const { parking, orgSlug } = useParkingContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const [newBookingOpen, setNewBookingOpen] = useState(false);
  const isMobileLayout = useIsBelowLg();
  const isBelowMd = useIsBelowMd();
  const query = useMemo(() => parseQueryFromParams(searchParams), [searchParams]);
  const view = useMemo(
    () => parseViewFromParams(searchParams, isMobileLayout),
    [searchParams, isMobileLayout]
  );

  const stage = useMemo(() => parseBookingStage(searchParams.get('stage')), [searchParams]);
  const effectiveStatus = useMemo(
    () => effectiveStatusFilter(stage, query.status),
    [stage, query.status]
  );

  const listQuery = useMemo((): BookingsQuery => {
    const base: BookingsQuery = { ...query, status: effectiveStatus };
    if (view === 'calendar') {
      return { ...base, showCompletedBookings: true, limit: BOARD_BOOKINGS_LIMIT, page: 1 };
    }
    return base;
  }, [query, view, effectiveStatus]);

  const summaryQuery = useMemo(
    (): BookingsQuery => ({
      q: '',
      status: [],
      from: query.from,
      to: query.to,
      hasPets: null,
      needParking: null,
      bookingKind: null,
      showCompletedBookings: true,
      sort: query.sort,
      page: 1,
      limit: BOARD_BOOKINGS_LIMIT,
    }),
    [query.from, query.to, query.sort]
  );

  const { data, isLoading, isFetching, error } = useParkingBookings(listQuery);
  const { data: summaryData } = useParkingBookings(summaryQuery);

  const resolveBookingHref = useCallback(
    (row: Parameters<typeof resolveBookingListHref>[0]) =>
      resolveBookingListHref(row, { orgSlug, scope: 'parking' }),
    [orgSlug]
  );

  const stageCounts = useMemo(
    () => countBookingsByStage(summaryData?.rows ?? []),
    [summaryData?.rows]
  );
  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const errorMessage = error ? (error as Error).message : null;

  useEffect(() => {
    if (!isMobileLayout || view !== 'table') return;
    setSearchParams(
      (prev) => {
        const sp = new URLSearchParams(prev);
        sp.set('view', 'card');
        sp.delete('page');
        return sp;
      },
      { replace: true }
    );
  }, [isMobileLayout, view, setSearchParams]);

  const initialFromDate = fromIsoDate(query.from);
  const initialToDate = fromIsoDate(query.to);
  const dateNav = useDateNavigation({
    initialPreset: 'month',
    initialRange:
      initialFromDate && initialToDate ? { from: initialFromDate, to: initialToDate } : null,
  });

  const patch = useCallback(
    (p: Partial<BookingsQuery>) =>
      setSearchParams((prev) => writeQueryToParams({ ...query, ...p }, prev), {
        replace: true,
      }),
    [query, setSearchParams]
  );

  const setStage = useCallback(
    (next: BookingStage) =>
      setSearchParams(
        (prev) => {
          const sp = new URLSearchParams(prev);
          if (next === 'all') sp.delete('stage');
          else sp.set('stage', next);
          sp.delete('page');
          return sp;
        },
        { replace: true }
      ),
    [setSearchParams]
  );

  useSyncDateRangeWithQuery(dateNav, query.from, query.to, ({ from, to }) => {
    patch({ from, to, page: 1 });
  });

  const setView = useCallback(
    (next: BookingView) =>
      setSearchParams(
        (prev) => {
          const sp = new URLSearchParams(prev);
          if (next === 'table') sp.delete('view');
          else sp.set('view', next);
          if (next === 'calendar') {
            sp.set('showCompletedBookings', 'true');
            sp.set('limit', String(BOARD_BOOKINGS_LIMIT));
          }
          sp.delete('page');
          return sp;
        },
        { replace: true }
      ),
    [setSearchParams]
  );

  const handleClearDate = useCallback(() => {
    dateNav.setDatePreset('month');
    patch({ from: null, to: null, page: 1 });
  }, [dateNav, patch]);

  const resetFilters = useCallback(() => {
    setSearchParams(new URLSearchParams(), { replace: true });
    dateNav.setDatePreset('month');
  }, [setSearchParams, dateNav]);

  const handleCalendarMonthChange = useCallback(
    (month: Date) => {
      patch({
        from: format(startOfMonth(month), 'yyyy-MM-dd'),
        to: format(endOfMonth(month), 'yyyy-MM-dd'),
        page: 1,
        showCompletedBookings: true,
      });
    },
    [patch]
  );

  const pageCount = Math.max(1, Math.ceil(total / listQuery.limit));
  const pageItems = buildPageItems(listQuery.page, pageCount);
  const showPagination = view !== 'calendar' && pageCount > 1;
  const showTableView = view === 'table' && !isMobileLayout;

  const handleStaySortChange = useCallback(
    (next: BookingsSort) => patch({ sort: next, page: 1 }),
    [patch]
  );

  const desktopActions = (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
      <BookingDateRangeFilter
        {...dateNav}
        isActive={Boolean(query.from || query.to)}
        onClear={handleClearDate}
        fullWidth={isBelowMd}
      />
      <button
        type="button"
        className="native-cta sm:w-auto sm:px-3.5"
        onClick={() => setNewBookingOpen(true)}
      >
        <CalendarPlus className="size-4" aria-hidden />
        <span className="hidden sm:inline">New booking</span>
        <span className="sm:hidden">New</span>
      </button>
    </div>
  );

  const dateFilter = (
    <BookingDateRangeFilter
      {...dateNav}
      isActive={Boolean(query.from || query.to)}
      onClear={handleClearDate}
      fullWidth
    />
  );

  const filterControls = (
    <BookingFilters
      query={query}
      onChange={patch}
      onReset={resetFilters}
      sort={query.sort}
      onSortChange={handleStaySortChange}
      view={view}
      onViewChange={setView}
      hideTableView={isMobileLayout}
      hideKanbanView
      showPerPage={view !== 'calendar'}
      hideGuestStayFilters
      searchPlaceholder="Search guest, email, phone, plate…"
      extraStatuses={PARKING_ONLY_STATUSES}
    />
  );

  const stickyMoreActiveCount = query.status.length;

  const overlapControls = (
    <FloatingToolbar>
      <div className="space-y-2.5">
        {dateFilter}
        {filterControls}
      </div>
    </FloatingToolbar>
  );

  const heroNewBooking = (
    <MobileHeroActionButton aria-label="New booking" onClick={() => setNewBookingOpen(true)}>
      <CalendarPlus className="size-5" aria-hidden />
    </MobileHeroActionButton>
  );

  return (
    <>
      <AdminMobilePage
        title="Bookings"
        subtitle="Reservations for this parking slot."
        titleId="bookings-heading"
        heroTrailing={heroNewBooking}
        overlap={overlapControls}
        stickyPrimary={dateFilter}
        stickyMore={filterControls}
        stickyMoreActiveCount={stickyMoreActiveCount}
        stickyMoreAriaLabel="Refine bookings"
        desktopActions={desktopActions}
        desktopActionsClassName="w-full sm:w-auto"
        dense
      >
        <BookingsSummaryCards
          counts={stageCounts}
          activeStage={stage}
          onStageChange={setStage}
          stageLabels={PARKING_STAGE_LABELS}
          hideStatusFooter
        />
        <div className="hidden lg:block">{filterControls}</div>

        {showTableView && (
          <BookingTable
            rows={rows}
            isLoading={isLoading}
            error={errorMessage}
            isRefreshing={isFetching}
            sort={query.sort}
            onStaySortChange={handleStaySortChange}
            resolveBookingHref={resolveBookingHref}
          />
        )}
        {view === 'card' && (
          <BookingCardGrid
            rows={rows}
            isLoading={isLoading}
            error={errorMessage}
            isRefreshing={isFetching}
            resolveBookingHref={resolveBookingHref}
          />
        )}
        {view === 'calendar' && (
          <FloatingPanel padding="md" className="overflow-hidden">
            <BookingCalendarView
              rows={rows}
              isLoading={isLoading}
              error={errorMessage}
              isRefreshing={isFetching}
              initialMonth={dateNav.dateRange.from}
              onMonthChange={handleCalendarMonthChange}
              resolveBookingHref={resolveBookingHref}
            />
          </FloatingPanel>
        )}

        {showPagination && (
          <AdminListPagination
            ariaLabel="Bookings pagination"
            page={listQuery.page}
            pageCount={pageCount}
            pageItems={pageItems}
            isLoading={isLoading}
            onPageChange={(page) => patch({ page })}
          />
        )}
      </AdminMobilePage>
      <AdminParkingNewBookingModal
        open={newBookingOpen}
        onOpenChange={setNewBookingOpen}
        orgSlug={orgSlug}
        parkingSlug={parking.slug}
        parkingId={parking.id}
        towerLabel={parking.tower}
      />
    </>
  );
}
