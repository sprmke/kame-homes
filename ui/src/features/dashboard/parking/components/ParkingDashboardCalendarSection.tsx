import { useLayoutEffect, useMemo, useRef, useState } from 'react';

import { CalendarDays } from 'lucide-react';

import { BookingCalendarView } from '@/features/dashboard/bookings/components/BookingCalendarView';
import {
  BookingCalendarPillLabelToggle,
  type BookingCalendarPillLabelMode,
} from '@/features/dashboard/bookings/components/calendar/BookingCalendarPillLabelToggle';
import { calendarSupportsPillLabelToggle } from '@/features/dashboard/bookings/components/calendar/calendarDateUtils';
import { FinanceTransactionsChart } from '@/features/dashboard/finance/components/FinanceTransactionsChart';
import { buildFinanceChartData } from '@/features/dashboard/finance/lib/financeChartData';
import { useParkingContext } from '@/features/dashboard/org/components/RequireParkingContext';
import { parkingSectionPath } from '@/features/dashboard/org/lib/tenantPaths';
import { DashboardTransactionsDueCard } from '@/features/dashboard/property/components/DashboardTransactionsDueCard';

import { AdminSurfaceCardHeader } from '@/components/shared/AdminSurfaceCardHeader';
import { useDashboardCompactChrome } from '@/features/dashboard/lib/dashboardChromeContext';
import { useIsBelowLg } from '@/hooks/useMediaQuery';
import { formatDateRangeDisplay, fromIsoDate, type DatePreset } from '@/lib/date/navigation';

type Props = {
  from: string;
  to: string;
  datePreset: DatePreset;
};

export function ParkingDashboardCalendarSection({ from, to, datePreset }: Props) {
  const { orgSlug, parkingSlug } = useParkingContext();
  const compactChrome = useDashboardCompactChrome();
  const rangeFrom = fromIsoDate(from);
  const rangeTo = fromIsoDate(to);
  const rangeLabel =
    rangeFrom && rangeTo
      ? formatDateRangeDisplay(rangeFrom, rangeTo, datePreset, { compact: compactChrome })
      : '';
  const financeHref = `${parkingSectionPath(orgSlug, parkingSlug, 'finance')}?from=${from}&to=${to}`;

  const chartData = useMemo(() => buildFinanceChartData([], [], from, to, 'completed'), [from, to]);

  const isBelowLg = useIsBelowLg();
  const calendarCardRef = useRef<HTMLElement>(null);
  const [calendarCardHeight, setCalendarCardHeight] = useState<number>();
  const [calendarPillLabelMode, setCalendarPillLabelMode] =
    useState<BookingCalendarPillLabelMode>('name');
  const showPillLabelToggle = useMemo(
    () => calendarSupportsPillLabelToggle(datePreset, rangeFrom, rangeTo),
    [datePreset, rangeFrom, rangeTo]
  );

  useLayoutEffect(() => {
    if (isBelowLg) {
      setCalendarCardHeight(undefined);
      return;
    }

    const node = calendarCardRef.current;
    if (!node) return;

    const syncHeight = () => {
      setCalendarCardHeight(node.getBoundingClientRect().height);
    };

    syncHeight();
    const observer = new ResizeObserver(syncHeight);
    observer.observe(node);
    return () => observer.disconnect();
  }, [isBelowLg, from, to, datePreset]);

  return (
    <div className="min-w-0 space-y-3 sm:space-y-4">
      <div className="grid min-w-0 items-stretch gap-3 lg:grid-cols-5 xl:gap-4">
        <FinanceTransactionsChart
          embedded
          isLoading={false}
          cashFlowData={chartData.cashFlowData}
          incomeBreakdown={chartData.incomeBreakdown}
          expenseBreakdown={chartData.expenseBreakdown}
          cashFlowCardClassName="lg:col-span-3 lg:col-start-1"
          breakdownCardClassName="lg:col-span-2 lg:col-start-4"
        />

        <DashboardTransactionsDueCard
          items={[]}
          from={from}
          to={to}
          rangeLabel={rangeLabel}
          datePreset={datePreset}
          transactionsHref={financeHref}
          syncedHeight={calendarCardHeight}
          isLoading={false}
          isRefreshing={false}
          className="lg:col-span-2 lg:col-start-4 lg:row-start-2"
        />

        <section
          ref={calendarCardRef}
          className="surface-card flex min-w-0 flex-col overflow-hidden p-3 sm:p-4 lg:col-span-3 lg:col-start-1 lg:row-start-2"
        >
          <AdminSurfaceCardHeader
            icon={CalendarDays}
            title="Calendar"
            description={`Tap a date to open reservation details · ${rangeLabel}`}
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
            rows={[]}
            isLoading={false}
            error={null}
            isRefreshing={false}
            variant="mini"
            rangeFrom={from}
            rangeTo={to}
            datePreset={datePreset}
            pillLabelMode={calendarPillLabelMode}
          />
        </section>
      </div>
    </div>
  );
}
