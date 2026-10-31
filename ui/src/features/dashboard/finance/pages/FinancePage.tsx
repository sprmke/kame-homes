import { useCallback, useEffect, useMemo, useState } from 'react';

import { useNavigate, useSearchParams } from 'react-router-dom';

import { useQuery } from '@tanstack/react-query';
import { endOfMonth, format, startOfMonth } from 'date-fns';
import { Plus } from 'lucide-react';

import { AdminListPagination } from '@/features/dashboard/bookings/components/AdminListToolbar';
import { BookingDateRangeFilter } from '@/features/dashboard/bookings/components/BookingDateRangeFilter';
import { CALENDAR_OCCUPANCY_LIMIT } from '@/features/dashboard/bookings/components/calendar/OccupancyCalendarView';
import {
  useDateNavigation,
  useSyncDateRangeWithQuery,
} from '@/features/dashboard/bookings/hooks/useDateNavigation';
import {
  FinanceExportMenu,
  financeAddTransactionAction,
} from '@/features/dashboard/finance/components/FinanceExportMenu';
import { FinanceLedgerCalendarView } from '@/features/dashboard/finance/components/FinanceLedgerCalendarView';
import { FinanceLedgerCardGrid } from '@/features/dashboard/finance/components/FinanceLedgerCardGrid';
import { FinanceLedgerTable } from '@/features/dashboard/finance/components/FinanceLedgerTable';
import { FinanceLedgerToolbar } from '@/features/dashboard/finance/components/FinanceLedgerToolbar';
import { FinanceSummaryCards } from '@/features/dashboard/finance/components/FinanceSummaryCards';
import { FinanceTransactionModals } from '@/features/dashboard/finance/components/FinanceTransactionModals';
import { FinanceTransactionsChart } from '@/features/dashboard/finance/components/FinanceTransactionsChart';
import { fetchAllFinanceBookings } from '@/features/dashboard/finance/hooks/useFinanceApi';
import { useFinanceBookings } from '@/features/dashboard/finance/hooks/useFinanceBookings';
import { useFinanceLineItems } from '@/features/dashboard/finance/hooks/useFinanceLineItems';
import { useFinanceSummary } from '@/features/dashboard/finance/hooks/useFinanceSummary';
import { buildFinanceChartData } from '@/features/dashboard/finance/lib/financeChartData';
import {
  buildFinanceLedgerEntries,
  collectLedgerCategories,
  filterFinanceLedgerEntries,
  paginateFinanceLedgerEntries,
  sortFinanceLedgerEntries,
  type FinanceLedgerEntry,
} from '@/features/dashboard/finance/lib/financeLedger';
import {
  FINANCE_CHART_BOOKINGS_LIMIT,
  parseFinanceQueryFromParams,
  previousFinancePeriodRange,
  rangeForPreset,
  writeFinanceQueryToParams,
  type FinanceRangePreset,
} from '@/features/dashboard/finance/lib/financePeriod';
import {
  computeFinanceSummaryCardStats,
  withPeriodComparison,
} from '@/features/dashboard/finance/lib/financeSummaryStats';
import type { FinanceLineItem, FinanceQuery } from '@/features/dashboard/finance/lib/types';
import { useOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { assetScopeKey, useAdminAssetScope } from '@/features/dashboard/org/lib/adminAssetScope';
import { propertyNotificationsPath } from '@/features/dashboard/org/lib/tenantPaths';
import { usePropertyPermissions } from '@/features/dashboard/team/hooks/usePropertyPermissions';
import { hasPropertyPermission } from '@/features/dashboard/team/lib/propertyPermissions';

import { FloatingPanel, FloatingToolbar } from '@/components/mobile/FloatingPanel';
import { AdminMobilePage } from '@/components/mobile/MobileBrandHero';
import { FinanceOverviewSkeleton } from '@/components/skeletons/AdminSkeletons';
import { useAdminMobileCardViewGuard } from '@/hooks/useAdminMobileCardViewGuard';
import { useIsBelowLg, useIsBelowMd } from '@/hooks/useMediaQuery';
import { fromIsoDate } from '@/lib/date/navigation';
import { buildPageItems } from '@/lib/table/pagination';

export function FinancePage() {
  const navigate = useNavigate();
  const scope = useAdminAssetScope();
  const scopeKey = assetScopeKey(scope);
  const { orgSlug, propertySlug } = useOrgContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobileLayout = useIsBelowLg();
  const isBelowMd = useIsBelowMd();
  const { data: propertyAccess } = usePropertyPermissions();
  const isParkingScope = Boolean(scope.parkingId);
  const canAddTransaction =
    isParkingScope ||
    hasPropertyPermission(propertyAccess?.permissions, 'finance.transactions:add');
  const canEditTransaction =
    isParkingScope ||
    hasPropertyPermission(propertyAccess?.permissions, 'finance.transactions:edit');
  const canDeleteTransaction =
    isParkingScope ||
    hasPropertyPermission(propertyAccess?.permissions, 'finance.transactions:delete');

  const [createOpen, setCreateOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FinanceLineItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<FinanceLineItem | null>(null);
  const [seriesAnchor, setSeriesAnchor] = useState<FinanceLineItem | null>(null);

  const query = useMemo(() => {
    const parsed = parseFinanceQueryFromParams(searchParams);
    if (!parsed.from && !parsed.to && !searchParams.has('from')) {
      const thisMonth = rangeForPreset('this_month');
      return { ...parsed, ...thisMonth };
    }
    return parsed;
  }, [searchParams]);

  useEffect(() => {
    if (searchParams.get('tab') !== 'settings') return;
    navigate(propertyNotificationsPath(orgSlug, propertySlug, 'finance'), {
      replace: true,
    });
  }, [navigate, orgSlug, propertySlug, searchParams]);

  const setQuery = useCallback(
    (next: FinanceQuery, preset?: FinanceRangePreset) => {
      setSearchParams(writeFinanceQueryToParams(next, preset), {
        replace: true,
      });
    },
    [setSearchParams]
  );

  const initialFromDate = fromIsoDate(query.from);
  const initialToDate = fromIsoDate(query.to);
  const dateNav = useDateNavigation({
    initialPreset: 'month',
    initialRange:
      initialFromDate && initialToDate ? { from: initialFromDate, to: initialToDate } : null,
  });

  useSyncDateRangeWithQuery(dateNav, query.from, query.to, (next) => {
    setQuery({ ...query, page: 1, from: next.from, to: next.to });
  });

  const handleClearDate = useCallback(() => {
    setQuery({ ...query, page: 1, from: null, to: null });
  }, [query, setQuery]);

  const chartBookingsQuery = useMemo(
    (): FinanceQuery => ({
      ...query,
      page: 1,
      limit: FINANCE_CHART_BOOKINGS_LIMIT,
    }),
    [query]
  );

  const previousPeriodQuery = useMemo((): FinanceQuery => {
    const previous = previousFinancePeriodRange(query.from, query.to);
    return { ...query, ...previous, page: 1 };
  }, [query]);

  const summaryQuery = useFinanceSummary(query);
  const previousSummaryQuery = useFinanceSummary(previousPeriodQuery);
  const lineItemsQuery = useFinanceLineItems(query);
  const chartBookingsQueryResult = useFinanceBookings(chartBookingsQuery);

  const ledgerBookingsQuery = useQuery({
    queryKey: ['finance-ledger-bookings', scopeKey, query] as const,
    queryFn: () => fetchAllFinanceBookings(query, scope),
    placeholderData: (previous) => previous,
    enabled: !scope.parkingId,
  });

  useAdminMobileCardViewGuard(isMobileLayout, query, setQuery);

  useEffect(() => {
    if (query.view !== 'calendar') return;
    const needsPatch = query.limit !== CALENDAR_OCCUPANCY_LIMIT || query.page !== 1;
    if (!needsPatch) return;
    setQuery({
      ...query,
      limit: CALENDAR_OCCUPANCY_LIMIT,
      page: 1,
    });
  }, [query, setQuery]);

  const handleCalendarMonthChange = useCallback(
    (month: Date) => {
      setQuery({
        ...query,
        from: format(startOfMonth(month), 'yyyy-MM-dd'),
        to: format(endOfMonth(month), 'yyyy-MM-dd'),
        page: 1,
      });
    },
    [query, setQuery]
  );

  const allEntries = useMemo(() => {
    return buildFinanceLedgerEntries(ledgerBookingsQuery.data ?? [], lineItemsQuery.data ?? []);
  }, [ledgerBookingsQuery.data, lineItemsQuery.data]);

  const filteredEntries = useMemo(
    () => filterFinanceLedgerEntries(allEntries, query),
    [allEntries, query]
  );

  const sortedEntries = useMemo(
    () => sortFinanceLedgerEntries(filteredEntries, query.sort),
    [filteredEntries, query.sort]
  );

  const categories = useMemo(() => collectLedgerCategories(allEntries), [allEntries]);

  const pagedEntries = useMemo(() => {
    if (query.view === 'calendar') {
      return { rows: sortedEntries, total: sortedEntries.length };
    }
    return paginateFinanceLedgerEntries(sortedEntries, query.page, query.limit);
  }, [sortedEntries, query.page, query.limit, query.view]);

  const chartData = useMemo(
    () =>
      buildFinanceChartData(
        lineItemsQuery.data ?? [],
        chartBookingsQueryResult.data?.rows ?? [],
        query.from,
        query.to,
        query.basis
      ),
    [lineItemsQuery.data, chartBookingsQueryResult.data?.rows, query.from, query.to, query.basis]
  );

  const summaryStats = useMemo(() => {
    if (!summaryQuery.data) return null;
    const current = computeFinanceSummaryCardStats(summaryQuery.data, lineItemsQuery.data ?? []);
    const previous = previousSummaryQuery.data
      ? computeFinanceSummaryCardStats(previousSummaryQuery.data, [])
      : undefined;
    return withPeriodComparison(current, previous);
  }, [summaryQuery.data, previousSummaryQuery.data, lineItemsQuery.data]);

  const pageCount = Math.max(1, Math.ceil(pagedEntries.total / query.limit));
  const pageItems = useMemo(() => buildPageItems(query.page, pageCount), [query.page, pageCount]);

  const showCalendarView = query.view === 'calendar';
  const showTableView = query.view === 'table' && !isMobileLayout;
  const showCardView = query.view === 'card' || (isMobileLayout && query.view !== 'calendar');
  const showPagination = !showCalendarView && pageCount > 1;
  const isLedgerLoading = ledgerBookingsQuery.isLoading || lineItemsQuery.isLoading;
  const isLedgerRefreshing = ledgerBookingsQuery.isFetching || lineItemsQuery.isFetching;
  const chartsLoading = lineItemsQuery.isPending || chartBookingsQueryResult.isPending;

  function handleEditEntry(entry: FinanceLedgerEntry) {
    if (!canEditTransaction || !entry.transaction) return;
    setEditingItem(entry.transaction);
    setCreateOpen(false);
  }

  function handleDeleteEntry(entry: FinanceLedgerEntry) {
    if (!canDeleteTransaction || !entry.transaction) return;
    setDeletingItem(entry.transaction);
  }

  function handleOpenSeries(entry: FinanceLedgerEntry) {
    if (!entry.transaction?.recurrence_series_id) return;
    setSeriesAnchor(entry.transaction);
  }

  function handleOpenCreate() {
    if (!canAddTransaction) return;
    setEditingItem(null);
    setCreateOpen(true);
  }

  const desktopActions = (
    <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-2">
      <BookingDateRangeFilter
        {...dateNav}
        isActive={!!(query.from || query.to)}
        onClear={handleClearDate}
        fullWidth={isBelowMd}
      />
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
        <FinanceExportMenu
          query={query}
          summary={summaryQuery.data}
          operating={lineItemsQuery.data}
        />
        {canAddTransaction ? (
          <button type="button" className="native-cta sm:px-3.5" onClick={handleOpenCreate}>
            <Plus className="size-4" aria-hidden />
            <span className="hidden sm:inline">Add Transaction</span>
            <span className="sm:hidden">Add</span>
          </button>
        ) : null}
      </div>
    </div>
  );

  const overlapControls = (
    <FloatingToolbar>
      <BookingDateRangeFilter
        {...dateNav}
        isActive={!!(query.from || query.to)}
        onClear={handleClearDate}
        fullWidth
      />
    </FloatingToolbar>
  );

  const heroActions = (
    <FinanceExportMenu
      variant="hero"
      query={query}
      summary={summaryQuery.data}
      operating={lineItemsQuery.data}
      leadingActions={canAddTransaction ? [financeAddTransactionAction(handleOpenCreate)] : []}
    />
  );

  return (
    <AdminMobilePage
      title="Finance"
      subtitle="Track income and expenses for this property."
      titleId="finance-heading"
      heroTrailing={heroActions}
      overlap={overlapControls}
      desktopActions={desktopActions}
      desktopActionsClassName="w-full sm:w-auto"
    >
      {summaryQuery.isLoading && !summaryStats ? (
        <FinanceOverviewSkeleton />
      ) : summaryStats ? (
        <FinanceSummaryCards {...summaryStats} />
      ) : null}

      <FinanceTransactionsChart
        cashFlowData={chartData.cashFlowData}
        incomeBreakdown={chartData.incomeBreakdown}
        expenseBreakdown={chartData.expenseBreakdown}
        isLoading={chartsLoading}
      />

      <FloatingToolbar>
        <FinanceLedgerToolbar
          query={query}
          categories={categories}
          onChange={setQuery}
          hideTableView={isMobileLayout}
          showPerPage={!showCalendarView}
        />
      </FloatingToolbar>

      {showCalendarView ? (
        <FloatingPanel padding="md" className="overflow-hidden">
          <FinanceLedgerCalendarView
            rows={sortedEntries}
            isLoading={isLedgerLoading}
            isRefreshing={isLedgerRefreshing}
            initialMonth={dateNav.dateRange.from ?? undefined}
            onMonthChange={handleCalendarMonthChange}
            onEditTransaction={canEditTransaction ? handleEditEntry : undefined}
            onDeleteTransaction={canDeleteTransaction ? handleDeleteEntry : undefined}
            onOpenSeries={handleOpenSeries}
          />
        </FloatingPanel>
      ) : null}

      {showTableView ? (
        <FinanceLedgerTable
          rows={pagedEntries.rows}
          isLoading={isLedgerLoading}
          onEditTransaction={canEditTransaction ? handleEditEntry : undefined}
          onDeleteTransaction={canDeleteTransaction ? handleDeleteEntry : undefined}
          onOpenSeries={handleOpenSeries}
        />
      ) : null}

      {showCardView ? (
        pagedEntries.rows.length === 0 && !isLedgerLoading ? (
          <FloatingPanel
            padding="lg"
            className="flex flex-col items-center justify-center py-14 text-center"
          >
            <p className="text-foreground text-sm font-semibold">No transactions in this period</p>
          </FloatingPanel>
        ) : (
          <FinanceLedgerCardGrid
            rows={pagedEntries.rows}
            isLoading={isLedgerLoading}
            isRefreshing={isLedgerRefreshing}
            onEditTransaction={canEditTransaction ? handleEditEntry : undefined}
            onDeleteTransaction={canDeleteTransaction ? handleDeleteEntry : undefined}
            onOpenSeries={handleOpenSeries}
          />
        )
      ) : null}

      {showPagination ? (
        <AdminListPagination
          page={query.page}
          pageCount={pageCount}
          pageItems={pageItems}
          isLoading={isLedgerLoading}
          onPageChange={(page) => setQuery({ ...query, page })}
          ariaLabel="Finance ledger pagination"
        />
      ) : null}

      <FinanceTransactionModals
        query={query}
        createOpen={createOpen}
        editingItem={editingItem}
        deletingItem={deletingItem}
        seriesAnchor={seriesAnchor}
        onCloseEditor={() => {
          setCreateOpen(false);
          setEditingItem(null);
        }}
        onDeletingChange={setDeletingItem}
        onSeriesAnchorChange={setSeriesAnchor}
      />
    </AdminMobilePage>
  );
}
