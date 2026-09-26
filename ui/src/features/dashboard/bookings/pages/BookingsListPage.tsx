import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useSearchParams } from 'react-router-dom';

import { endOfMonth, format, startOfMonth } from 'date-fns';
import { CalendarPlus, Upload } from 'lucide-react';

import { AdminListPagination } from '@/features/dashboard/bookings/components/AdminListToolbar';
import { AdminNewBookingModal } from '@/features/dashboard/bookings/components/AdminNewBookingModal';
import { BookingCalendarView } from '@/features/dashboard/bookings/components/BookingCalendarView';
import { BookingCardGrid } from '@/features/dashboard/bookings/components/BookingCardGrid';
import { BookingDateRangeFilter } from '@/features/dashboard/bookings/components/BookingDateRangeFilter';
import { BookingFilters } from '@/features/dashboard/bookings/components/BookingFilters';
import { BookingKanban } from '@/features/dashboard/bookings/components/BookingKanban';
import { BookingsSummaryCards } from '@/features/dashboard/bookings/components/BookingsSummaryCards';
import { BookingsStageSummarySkeleton } from '@/components/skeletons/BookingsExtrasSkeleton';
import { BookingTable } from '@/features/dashboard/bookings/components/BookingTable';
import type { BookingView } from '@/features/dashboard/bookings/components/BookingViewToggle';
import {
  CalendarBookingCelebration,
  type CalendarBookingCelebrationTrigger,
} from '@/features/dashboard/bookings/components/calendar/CalendarBookingCelebration';
import { useAppSettings } from '@/features/dashboard/bookings/hooks/useAppSettings';
import { useBookings } from '@/features/dashboard/bookings/hooks/useBookings';
import {
  useDateNavigation,
  useSyncDateRangeWithQuery,
} from '@/features/dashboard/bookings/hooks/useDateNavigation';
import {
  resolveBookingListHref,
  type BookingsListScope,
} from '@/features/dashboard/bookings/lib/bookingListNavigation';
import {
  countBookingsByStage,
  effectiveStatusFilter,
  parseBookingStage,
  type BookingStage,
} from '@/features/dashboard/bookings/lib/bookingStages';
import {
  DEFAULT_BOOKINGS_QUERY,
  type BookingKind,
  type BookingsQuery,
  type BookingsSort,
} from '@/features/dashboard/bookings/lib/types';
import { ImportWizardModal } from '@/features/dashboard/import/components/ImportWizardModal';
import { useOptionalOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { useOrgSlugParam } from '@/features/dashboard/org/lib/adminApiScope';
import { TierBadge, TierBadgeAnchor } from '@/features/dashboard/plans/components/TierBadge';
import { usePropertyPermissions } from '@/features/dashboard/team/hooks/usePropertyPermissions';
import { hasPropertyPermission } from '@/features/dashboard/team/lib/propertyPermissions';

import { FloatingPanel, FloatingToolbar } from '@/components/mobile/FloatingPanel';
import { AdminMobilePage } from '@/components/mobile/MobileBrandHero';
import { MobileHeroActionButton } from '@/components/mobile/MobileHeroActionButton';
import { Button } from '@/components/ui/button';
import { useIsBelowLg, useIsBelowMd } from '@/hooks/useMediaQuery';
import { fromIsoDate } from '@/lib/date/navigation';
import { buildPageItems, normalizeAdminPageLimit } from '@/lib/table/pagination';

const BOARD_BOOKINGS_LIMIT = 100;
const VIEWS: ReadonlyArray<BookingView> = ['table', 'card', 'calendar', 'kanban'];
/** Calendar view: a viewed month at/above this count triggers the busy-month celebration. */
const BUSY_MONTH_CELEBRATION_THRESHOLD = 20;

// ─── URL ↔ query helpers ─────────────────────────────────────

function parseQueryFromParams(sp: URLSearchParams): BookingsQuery {
  const statuses = (sp.get('status') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const parseTri = (v: string | null): boolean | null =>
    v === 'true' ? true : v === 'false' ? false : null;
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
  const parseKind = (v: string | null): BookingKind | null =>
    v === 'property' || v === 'parking' ? v : null;
  return {
    q: sp.get('q') ?? '',
    status: statuses,
    from: sp.get('from'),
    to: sp.get('to'),
    hasPets: parseTri(sp.get('hasPets')),
    needParking: parseTri(sp.get('needParking')),
    bookingKind: parseKind(sp.get('bookingKind')),
    showCompletedBookings:
      sp.get('showCompletedBookings') === 'true' ||
      sp.get('showPreviousBookings') === 'true' ||
      sp.get('hideStaleCompleted') === 'false',
    sort,
    page: Number.isFinite(page) && page > 0 ? Math.floor(page) : 1,
    limit: normalizeAdminPageLimit(limit),
  };
}

function parseViewFromParams(
  sp: URLSearchParams,
  isMobileLayout: boolean,
  kanbanUnavailable: boolean
): BookingView {
  const v = sp.get('view') as BookingView | null;
  if (v && VIEWS.includes(v)) {
    if (kanbanUnavailable && v === 'kanban') return isMobileLayout ? 'card' : 'table';
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
  set('hasPets', q.hasPets === null ? null : String(q.hasPets));
  set('needParking', q.needParking === null ? null : String(q.needParking));
  set('bookingKind', q.bookingKind);
  set('showCompletedBookings', q.showCompletedBookings ? 'true' : null);
  set('sort', q.sort === DEFAULT_BOOKINGS_QUERY.sort ? null : q.sort);
  set('page', q.page === 1 ? null : String(q.page));
  set('limit', q.limit === DEFAULT_BOOKINGS_QUERY.limit ? null : String(q.limit));
  return next;
}

// ─── Page component ──────────────────────────────────────────

type BookingsListPageProps = {
  scope?: BookingsListScope;
};

export function BookingsListPage({ scope = 'property' }: BookingsListPageProps) {
  const orgContext = useOptionalOrgContext();
  const orgSlug = useOrgSlugParam();
  const propertySlug = orgContext?.propertySlug ?? null;
  const showProperty = scope === 'org';
  const hideKanban = scope === 'org';
  const [searchParams, setSearchParams] = useSearchParams();
  const [importOpen, setImportOpen] = useState(false);
  const [newBookingOpen, setNewBookingOpen] = useState(false);
  const { data: propertyAccess } = usePropertyPermissions();
  const canImport =
    scope !== 'org' && hasPropertyPermission(propertyAccess?.permissions, 'bookings.import:add');
  const canCreateBooking =
    scope !== 'org' && hasPropertyPermission(propertyAccess?.permissions, 'bookings.create:add');
  const canMutateWorkflow =
    scope !== 'org' &&
    hasPropertyPermission(propertyAccess?.permissions, 'bookings.detail.workflow:edit');

  const isMobileLayout = useIsBelowLg();
  const isBelowMd = useIsBelowMd();
  /** Org scope + phone (`max-md`) — kanban needs drag + wide board. */
  const kanbanUnavailable = hideKanban || isBelowMd;
  const query = useMemo(() => parseQueryFromParams(searchParams), [searchParams]);
  const view = useMemo(
    () => parseViewFromParams(searchParams, isMobileLayout, kanbanUnavailable),
    [searchParams, isMobileLayout, kanbanUnavailable]
  );

  const stage = useMemo(() => parseBookingStage(searchParams.get('stage')), [searchParams]);

  const effectiveStatus = useMemo(
    () => effectiveStatusFilter(stage, query.status),
    [stage, query.status]
  );

  /** Board views need a higher row cap; stage filter maps to `status[]`. */
  const listQuery = useMemo((): BookingsQuery => {
    const base: BookingsQuery = {
      ...query,
      status: effectiveStatus,
      expandImportedBatch: query.status.includes('IMPORTED'),
    };
    if (view === 'calendar' || view === 'kanban') {
      return {
        ...base,
        showCompletedBookings: true,
        limit: BOARD_BOOKINGS_LIMIT,
        page: 1,
      };
    }
    return base;
  }, [query, view, effectiveStatus]);

  const summaryQuery = useMemo(
    (): BookingsQuery => ({
      q: '',
      status: [],
      from: query.from,
      to: query.to,
      hasPets: query.hasPets,
      needParking: query.needParking,
      bookingKind: query.bookingKind,
      showCompletedBookings: true,
      sort: query.sort,
      page: 1,
      limit: BOARD_BOOKINGS_LIMIT,
    }),
    [query.from, query.to, query.hasPets, query.needParking, query.bookingKind, query.sort]
  );

  // Org scope or phone: leave kanban URL / view.
  useEffect(() => {
    if (!kanbanUnavailable || view !== 'kanban') return;
    setSearchParams(
      (prev) => {
        const sp = new URLSearchParams(prev);
        if (hideKanban) {
          sp.delete('view');
        } else {
          sp.set('view', 'card');
        }
        return sp;
      },
      { replace: true }
    );
  }, [kanbanUnavailable, hideKanban, view, setSearchParams]);

  // Table is desktop-only; switch away live when the viewport narrows.
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

  // Hydrate date navigation from URL `from`/`to` (if present).
  // The hook then emits ISO strings back via `useSyncDateRangeWithQuery`
  // when user navigates presets or picks a custom range.
  const initialFromDate = fromIsoDate(query.from);
  const initialToDate = fromIsoDate(query.to);
  const dateNav = useDateNavigation({
    initialPreset: 'month',
    initialRange:
      initialFromDate && initialToDate ? { from: initialFromDate, to: initialToDate } : null,
  });

  const { data, isLoading, isFetching, error } = useBookings(listQuery, { scope });
  const { data: summaryData, isLoading: isSummaryLoading } = useBookings(summaryQuery, { scope });
  // Resolved document requirements (§4.5) for the kanban view only — property-scoped,
  // disabled automatically when `usePropertyIdParam()` has no property (org scope).
  const { data: appSettings } = useAppSettings();
  const documentRequirements = appSettings?.resolvedDocumentRequirements;

  const resolveBookingHref = useCallback(
    (row: Parameters<typeof resolveBookingListHref>[0]) =>
      resolveBookingListHref(row, { orgSlug, propertySlug, scope }),
    [orgSlug, propertySlug, scope]
  );

  const stageCounts = useMemo(
    () => countBookingsByStage(summaryData?.rows ?? []),
    [summaryData?.rows]
  );

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

  // Keep URL in sync when entering calendar or kanban view (toggle + limit).
  useEffect(() => {
    if (view !== 'calendar' && view !== 'kanban') return;
    const needsPatch =
      !query.showCompletedBookings || query.limit !== BOARD_BOOKINGS_LIMIT || query.page !== 1;
    if (!needsPatch) return;
    patch({
      showCompletedBookings: true,
      limit: BOARD_BOOKINGS_LIMIT,
      page: 1,
    });
  }, [view, query.showCompletedBookings, query.limit, query.page, patch]);

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

  // Sync date-nav state changes (preset switches, custom range, prev/next) → URL.
  // Pass the URL-derived from/to so the hook can detect "URL is empty but the
  // user just clicked Month" and still fire a patch.
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
          if (next === 'calendar' || next === 'kanban') {
            sp.set('showCompletedBookings', 'true');
            sp.set('limit', String(BOARD_BOOKINGS_LIMIT));
          }
          // Reset to first page when switching views; calendar in particular
          // benefits from seeing all results in the active range.
          sp.delete('page');
          return sp;
        },
        { replace: true }
      ),
    [setSearchParams]
  );

  const handleClearDate = useCallback(() => {
    // Reset preset state to the default month view (no range applied).
    dateNav.setDatePreset('month');
    patch({ from: null, to: null, page: 1 });
  }, [dateNav, patch]);

  const resetFilters = useCallback(() => {
    setSearchParams(new URLSearchParams(), { replace: true });
    dateNav.setDatePreset('month');
  }, [setSearchParams, dateNav]);

  const total = data?.total ?? 0;
  const rows = data?.rows ?? [];
  const pageCount = Math.max(1, Math.ceil(total / query.limit));
  const pageItems = buildPageItems(query.page, pageCount);

  // Busy-month celebration: fires once per distinct month reaching the
  // threshold, and again on navigating to another month that also qualifies.
  const [celebration, setCelebration] = useState<CalendarBookingCelebrationTrigger | null>(null);
  const celebratedMonthsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (view !== 'calendar' || isLoading || isFetching) return;
    const monthStart = dateNav.dateRange.from;
    if (!monthStart || total < BUSY_MONTH_CELEBRATION_THRESHOLD) return;
    const monthKey = format(monthStart, 'yyyy-MM');
    if (celebratedMonthsRef.current.has(monthKey)) return;
    celebratedMonthsRef.current.add(monthKey);
    setCelebration({ key: monthKey, count: total });
  }, [view, isLoading, isFetching, total, dateNav.dateRange.from]);

  // Calendar view: fetch a higher cap so an entire month range can render.
  // We don't want pagination chopping a month view in half. The list-bookings
  // edge function caps `limit` at 100 — good enough for a single month at this
  // property's volume; widen later if needed via a cursor / infinite query.
  const showPagination = view !== 'calendar' && view !== 'kanban' && pageCount > 1;

  const showTableView = view === 'table' && !isMobileLayout;

  const handleStaySortChange = useCallback(
    (next: BookingsSort) => patch({ sort: next, page: 1 }),
    [patch]
  );

  const bookingActions =
    scope === 'org' ? undefined : (
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
        <BookingDateRangeFilter
          {...dateNav}
          isActive={Boolean(query.from || query.to)}
          onClear={handleClearDate}
          fullWidth={isMobileLayout}
        />
        {canImport ? (
          <TierBadgeAnchor feature="bookingImport">
            <Button
              type="button"
              variant="outline"
              className="native-cta-secondary sm:w-auto sm:px-3.5"
              onClick={() => setImportOpen(true)}
            >
              <Upload className="size-4" aria-hidden />
              Import
            </Button>
          </TierBadgeAnchor>
        ) : null}
        {canCreateBooking ? (
          <button
            type="button"
            className="native-cta sm:w-auto sm:px-3.5"
            onClick={() => setNewBookingOpen(true)}
          >
            <CalendarPlus className="size-4" aria-hidden />
            <span className="sm:hidden">New</span>
            <span className="hidden sm:inline">New booking</span>
          </button>
        ) : null}
      </div>
    );

  const bookingsSubtitle = showProperty
    ? 'Property stays and parking reservations across your organization.'
    : 'Manage and track all bookings for this property.';

  const heroNewBooking =
    scope === 'org' ? undefined : (
      <>
        {canImport ? (
          <span className="relative inline-flex">
            <MobileHeroActionButton
              aria-label="Import bookings"
              onClick={() => setImportOpen(true)}
            >
              <Upload className="size-5" aria-hidden />
            </MobileHeroActionButton>
            <TierBadge feature="bookingImport" placement="corner" />
          </span>
        ) : null}
        {canCreateBooking ? (
          <MobileHeroActionButton aria-label="New booking" onClick={() => setNewBookingOpen(true)}>
            <CalendarPlus className="size-5" aria-hidden />
          </MobileHeroActionButton>
        ) : null}
      </>
    );

  /** Mobile float — date only (same pattern as Finance / Maintenance). */
  const overlapControls =
    scope !== 'org' ? (
      <FloatingToolbar>
        <BookingDateRangeFilter
          {...dateNav}
          isActive={Boolean(query.from || query.to)}
          onClear={handleClearDate}
          fullWidth
        />
      </FloatingToolbar>
    ) : undefined;

  return (
    <>
      <AdminMobilePage
        title="Bookings"
        subtitle={bookingsSubtitle}
        titleId="bookings-heading"
        heroTrailing={heroNewBooking}
        overlap={overlapControls}
        desktopActions={bookingActions}
        desktopActionsClassName="w-full sm:w-auto"
        dense
      >
        {isSummaryLoading && !summaryData ? (
          <BookingsStageSummarySkeleton />
        ) : (
          <BookingsSummaryCards counts={stageCounts} activeStage={stage} onStageChange={setStage} />
        )}

        <FloatingToolbar>
          <BookingFilters
            query={query}
            onChange={patch}
            onReset={resetFilters}
            sort={query.sort}
            onSortChange={handleStaySortChange}
            view={view}
            onViewChange={setView}
            hideTableView={isMobileLayout}
            hideKanbanView={kanbanUnavailable}
            showBookingKindFilter={scope === 'org'}
            showPerPage={view !== 'calendar' && view !== 'kanban'}
          />
        </FloatingToolbar>

        {/* Active view */}
        {showTableView && (
          <BookingTable
            rows={rows}
            isLoading={isLoading}
            error={error ? (error as Error).message : null}
            isRefreshing={isFetching}
            sort={query.sort}
            onStaySortChange={handleStaySortChange}
            showProperty={showProperty}
            resolveBookingHref={resolveBookingHref}
          />
        )}
        {view === 'card' && (
          <BookingCardGrid
            rows={rows}
            isLoading={isLoading}
            error={error ? (error as Error).message : null}
            isRefreshing={isFetching}
            showProperty={showProperty}
            resolveBookingHref={resolveBookingHref}
          />
        )}
        {view === 'kanban' && !kanbanUnavailable ? (
          <BookingKanban
            rows={rows}
            isLoading={isLoading}
            error={error ? (error as Error).message : null}
            isRefreshing={isFetching}
            showProperty={showProperty}
            documentRequirements={documentRequirements}
            canMutateWorkflow={canMutateWorkflow}
          />
        ) : null}
        {view === 'calendar' ? (
          <FloatingPanel padding="md" className="overflow-hidden">
            <BookingCalendarView
              rows={rows}
              isLoading={isLoading}
              error={error ? (error as Error).message : null}
              isRefreshing={isFetching}
              initialMonth={dateNav.dateRange.from}
              onMonthChange={handleCalendarMonthChange}
              showProperty={showProperty}
              resolveBookingHref={resolveBookingHref}
            />
          </FloatingPanel>
        ) : null}

        {/* Pagination — hidden in calendar view (range already filters scope) */}
        {showPagination ? (
          <AdminListPagination
            ariaLabel="Bookings pagination"
            page={query.page}
            pageCount={pageCount}
            pageItems={pageItems}
            isLoading={isLoading}
            onPageChange={(page) => patch({ page })}
          />
        ) : null}
      </AdminMobilePage>

      {canImport ? <ImportWizardModal open={importOpen} onOpenChange={setImportOpen} /> : null}
      {scope !== 'org' ? (
        <AdminNewBookingModal
          open={newBookingOpen}
          onOpenChange={setNewBookingOpen}
          orgSlug={orgSlug}
          propertySlug={propertySlug}
        />
      ) : null}

      <CalendarBookingCelebration trigger={celebration} onDone={() => setCelebration(null)} />
    </>
  );
}
