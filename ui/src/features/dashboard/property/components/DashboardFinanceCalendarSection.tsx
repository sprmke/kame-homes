import { useMemo, useState } from 'react';

import { CalendarDays } from 'lucide-react';

import { BookingCalendarView } from '@/features/dashboard/bookings/components/BookingCalendarView';
import {
  BookingCalendarPillLabelToggle,
  type BookingCalendarPillLabelMode,
} from '@/features/dashboard/bookings/components/calendar/BookingCalendarPillLabelToggle';
import { calendarSupportsPillLabelToggle } from '@/features/dashboard/bookings/components/calendar/calendarDateUtils';
import { useBookings } from '@/features/dashboard/bookings/hooks/useBookings';
import {
  DEFAULT_BOOKINGS_QUERY,
  type BookingsQuery,
} from '@/features/dashboard/bookings/lib/types';
import { FinanceTransactionsChart } from '@/features/dashboard/finance/components/FinanceTransactionsChart';
import { useFinanceBookings } from '@/features/dashboard/finance/hooks/useFinanceBookings';
import { useFinanceLineItems } from '@/features/dashboard/finance/hooks/useFinanceLineItems';
import { buildFinanceChartData } from '@/features/dashboard/finance/lib/financeChartData';
import { FINANCE_CHART_BOOKINGS_LIMIT } from '@/features/dashboard/finance/lib/financePeriod';
import { DEFAULT_FINANCE_QUERY, type FinanceQuery } from '@/features/dashboard/finance/lib/types';
import { propertySectionPath } from '@/features/dashboard/org/lib/tenantPaths';
import { DashboardAttentionCard } from '@/features/dashboard/property/components/DashboardAttentionCard';
import { DashboardMaintenanceRemindersCard } from '@/features/dashboard/property/components/DashboardMaintenanceRemindersCard';
import { DashboardTransactionsDueCard } from '@/features/dashboard/property/components/DashboardTransactionsDueCard';
import type {
  DashboardAttentionItem,
  DashboardRecentBooking,
} from '@/features/dashboard/property/lib/types';

import { AdminSurfaceCardHeader } from '@/components/shared/AdminSurfaceCardHeader';
import { useDashboardCompactChrome } from '@/features/dashboard/lib/dashboardChromeContext';
import { formatDateRangeDisplay, fromIsoDate, type DatePreset } from '@/lib/date/navigation';

type Props = {
  from: string;
  to: string;
  datePreset: DatePreset;
  attentionItems: DashboardAttentionItem[];
  recentBookings: DashboardRecentBooking[];
  orgSlug: string;
  propertySlug: string;
  attentionLoading?: boolean;
  canViewFinance?: boolean;
  canViewMaintenance?: boolean;
};

/**
 * Equal-width 2×3 board after KPIs:
 * Calendar         | Needs attention (or Recent bookings when clear)
 * Cash flow        | Breakdown
 * Maintenance      | Transactions
 */
export function DashboardFinanceCalendarSection({
  from,
  to,
  datePreset,
  attentionItems,
  recentBookings,
  orgSlug,
  propertySlug,
  attentionLoading,
  canViewFinance = true,
  canViewMaintenance = true,
}: Props) {
  const compactChrome = useDashboardCompactChrome();
  const rangeFrom = fromIsoDate(from);
  const rangeTo = fromIsoDate(to);
  const rangeLabel =
    rangeFrom && rangeTo
      ? formatDateRangeDisplay(rangeFrom, rangeTo, datePreset, { compact: compactChrome })
      : '';

  const financeQuery = useMemo(
    (): FinanceQuery => ({
      ...DEFAULT_FINANCE_QUERY,
      from,
      to,
      page: 1,
      limit: FINANCE_CHART_BOOKINGS_LIMIT,
    }),
    [from, to]
  );

  const bookingsQuery = useMemo(
    (): BookingsQuery => ({
      ...DEFAULT_BOOKINGS_QUERY,
      from,
      to,
      showCompletedBookings: true,
      limit: FINANCE_CHART_BOOKINGS_LIMIT,
      page: 1,
    }),
    [from, to]
  );

  const lineItemsQuery = useFinanceLineItems(financeQuery, { enabled: canViewFinance });
  const financeBookingsQuery = useFinanceBookings(financeQuery, {
    enabled: canViewFinance,
  });
  const bookingsQueryResult = useBookings(bookingsQuery);

  const chartData = useMemo(
    () =>
      buildFinanceChartData(
        lineItemsQuery.data ?? [],
        financeBookingsQuery.data?.rows ?? [],
        from,
        to,
        financeQuery.basis
      ),
    [lineItemsQuery.data, financeBookingsQuery.data?.rows, from, to, financeQuery.basis]
  );

  const financeChartsLoading = lineItemsQuery.isPending || financeBookingsQuery.isPending;
  const [calendarPillLabelMode, setCalendarPillLabelMode] =
    useState<BookingCalendarPillLabelMode>('name');
  const showPillLabelToggle = useMemo(
    () => calendarSupportsPillLabelToggle(datePreset, rangeFrom, rangeTo),
    [datePreset, rangeFrom, rangeTo]
  );

  const bookingsHref = `${propertySectionPath(orgSlug, propertySlug, 'bookings')}?from=${from}&to=${to}`;
  const financeHref = `${propertySectionPath(orgSlug, propertySlug, 'finance')}?from=${from}&to=${to}`;

  return (
    <div className="grid min-w-0 items-stretch gap-2.5 sm:gap-3 lg:grid-cols-2 lg:gap-4">
      <section className="surface-card flex h-full min-w-0 flex-col overflow-hidden p-3 sm:p-4">
        <AdminSurfaceCardHeader
          icon={CalendarDays}
          title="Calendar"
          description={`Tap a date to open booking details · ${rangeLabel}`}
          iconClassName="bg-muted/80"
          action={
            showPillLabelToggle ? (
              <BookingCalendarPillLabelToggle
                value={calendarPillLabelMode}
                onChange={setCalendarPillLabelMode}
              />
            ) : undefined
          }
        />

        <BookingCalendarView
          rows={bookingsQueryResult.data?.rows ?? []}
          isLoading={bookingsQueryResult.isLoading}
          error={bookingsQueryResult.error ? (bookingsQueryResult.error as Error).message : null}
          isRefreshing={bookingsQueryResult.isFetching}
          variant="mini"
          rangeFrom={from}
          rangeTo={to}
          datePreset={datePreset}
          pillLabelMode={calendarPillLabelMode}
        />
      </section>

      <DashboardAttentionCard
        className="h-full"
        items={attentionItems}
        recentBookings={recentBookings}
        orgSlug={orgSlug}
        propertySlug={propertySlug}
        viewAllHref={bookingsHref}
        rangeLabel={rangeLabel}
        isLoading={attentionLoading}
      />

      {canViewFinance ? (
        <FinanceTransactionsChart
          embedded
          isLoading={financeChartsLoading}
          cashFlowData={chartData.cashFlowData}
          incomeBreakdown={chartData.incomeBreakdown}
          expenseBreakdown={chartData.expenseBreakdown}
          financeHref={financeHref}
        />
      ) : null}

      {canViewMaintenance ? (
        <DashboardMaintenanceRemindersCard from={from} to={to} rangeLabel={rangeLabel} />
      ) : null}

      {canViewFinance ? (
        <DashboardTransactionsDueCard
          items={lineItemsQuery.data ?? []}
          from={from}
          to={to}
          rangeLabel={rangeLabel}
          datePreset={datePreset}
          transactionsHref={financeHref}
          isLoading={lineItemsQuery.isLoading}
          isRefreshing={lineItemsQuery.isFetching}
        />
      ) : null}
    </div>
  );
}
