import { BarChart3, PieChart } from 'lucide-react';

import { FloatingPanel } from '@/components/mobile/FloatingPanel';
import {
  AdminListToolbarSkeleton,
  BookingsCalendarSkeleton,
  FinanceOperatingTabSkeleton,
  FinanceOverviewSkeleton,
  FinanceStaysCardGridSkeleton,
  FinanceStaysTableSkeleton,
} from '@/components/skeletons/AdminSkeletons';
import { Skeleton } from '@/components/ui/skeleton';

function FinanceChartCardSkeleton({
  title,
  icon: Icon,
  description,
  className,
}: {
  title: string;
  icon: typeof BarChart3;
  description: string;
  className?: string;
}) {
  return (
    <section className={className} aria-hidden>
      <div className="surface-card flex h-full min-h-0 flex-col p-3 sm:p-4">
        <div className="mb-2.5 flex flex-col gap-2 sm:mb-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="icon-well-sm bg-muted/80 inline-flex !size-8 shrink-0 items-center justify-center !rounded-lg lg:!size-10 lg:!rounded-xl">
              <Icon className="text-muted-foreground size-4 lg:size-5" aria-hidden />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="text-card-title">{title}</p>
              <p className="text-muted-foreground hidden text-xs leading-snug lg:block">
                {description}
              </p>
            </div>
          </div>
          <Skeleton className="hidden h-9 w-24 shrink-0 rounded-lg sm:block" />
        </div>
        <Skeleton className="h-[180px] w-full min-w-0 rounded-xl sm:h-[220px]" />
      </div>
    </section>
  );
}

/** Cash flow (3/5) beside breakdown (2/5), as `FinanceTransactionsChart` renders them. */
export function FinanceChartsSkeleton() {
  return (
    <div className="grid min-w-0 items-stretch gap-3 lg:grid-cols-5 xl:gap-4" aria-hidden>
      <FinanceChartCardSkeleton
        title="Cash flow"
        icon={BarChart3}
        description="Stay net, transactions, and expenses over time"
        className="lg:col-span-3"
      />
      <FinanceChartCardSkeleton
        title="Breakdown"
        icon={PieChart}
        description="By category"
        className="lg:col-span-2"
      />
    </div>
  );
}

function LedgerViewSkeleton({ view }: { view: 'table' | 'card' | 'calendar' }) {
  if (view === 'calendar') {
    return (
      <FloatingPanel padding="md" className="overflow-hidden">
        <BookingsCalendarSkeleton gridOnly />
      </FloatingPanel>
    );
  }

  return (
    <>
      <div className="hidden lg:block">
        <FinanceStaysTableSkeleton />
      </div>
      <div className="lg:hidden">
        <FinanceStaysCardGridSkeleton />
      </div>
    </>
  );
}

/**
 * Finance data region: summary KPIs, cash-flow / breakdown charts, ledger toolbar, then the
 * selected ledger view (table on desktop, cards on phone, or the calendar).
 */
export function FinancePageBodySkeleton({
  view = 'table',
}: {
  view?: 'table' | 'card' | 'calendar';
}) {
  return (
    <div
      role="status"
      className="space-y-3 sm:space-y-4"
      aria-busy="true"
      aria-label="Loading finance"
    >
      <FinanceOverviewSkeleton />
      <FinanceChartsSkeleton />
      <AdminListToolbarSkeleton sort />
      <LedgerViewSkeleton view={view} />
    </div>
  );
}

/** Maintenance data region: summary KPIs, reminders toolbar, then table / cards / calendar. */
export function MaintenancePageBodySkeleton({
  view = 'table',
}: {
  view?: 'table' | 'card' | 'calendar';
}) {
  return (
    <div
      role="status"
      className="space-y-3 sm:space-y-4"
      aria-busy="true"
      aria-label="Loading maintenance"
    >
      <FinanceOverviewSkeleton />
      <AdminListToolbarSkeleton sort />
      {view === 'calendar' ? (
        <FloatingPanel padding="md" className="overflow-hidden">
          <BookingsCalendarSkeleton gridOnly />
        </FloatingPanel>
      ) : (
        <>
          <div className="hidden lg:block">
            <FinanceOperatingTabSkeleton />
          </div>
          <div className="lg:hidden">
            <FinanceStaysCardGridSkeleton />
          </div>
        </>
      )}
    </div>
  );
}
