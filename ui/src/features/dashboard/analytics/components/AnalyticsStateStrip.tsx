import { Link, useParams } from 'react-router-dom';

import { FORWARD_OCCUPANCY_COPY } from '@/features/dashboard/analytics/lib/occupancyStateCopy';
import type { AnalyticsStateAssessment } from '@/features/dashboard/analytics/lib/types';
import { propertySectionPath } from '@/features/dashboard/org/lib/tenantPaths';

import { cn } from '@/lib/utils';
import { formatMoney } from '@/utils/format/currency';

type Props = {
  state: AnalyticsStateAssessment;
};

export function AnalyticsStateStrip({ state }: Props) {
  const { orgSlug = '', propertySlug = '' } = useParams<{
    orgSlug: string;
    propertySlug: string;
  }>();
  const occupancy = FORWARD_OCCUPANCY_COPY[state.forwardOccupancyState30d];
  const showBalances = state.balanceCollectionState !== 'clear';

  return (
    <section className="flex flex-wrap items-center gap-2" aria-label="Occupancy outlook">
      <p className="border-border/70 bg-card inline-flex min-h-[44px] items-center gap-2 rounded-full border px-3 text-xs font-medium sm:text-sm">
        <span className={cn('size-2 shrink-0 rounded-full', occupancy.dot)} aria-hidden />
        <span className={cn('font-semibold', occupancy.text)}>{occupancy.label}</span>
        <span className="text-muted-foreground hidden sm:inline">{occupancy.clause}</span>
      </p>
      {showBalances ? (
        <Link
          to={propertySectionPath(orgSlug, propertySlug, 'bookings')}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 text-xs font-medium text-amber-800 sm:text-sm dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200"
        >
          {state.unpaidBalanceUpcomingCount} unpaid
          <span className="hidden tabular-nums sm:inline">
            {formatMoney(state.unpaidBalanceUpcomingTotal)}
          </span>
        </Link>
      ) : null}
    </section>
  );
}
