import { useMemo } from 'react';

import { Link } from 'react-router-dom';

import { ArrowRight, CheckCircle2, Clock3, Wrench } from 'lucide-react';

import { useMaintenanceItems } from '@/features/dashboard/maintenance/hooks/useMaintenanceItems';
import { useMaintenanceSummary } from '@/features/dashboard/maintenance/hooks/useMaintenanceSummary';
import {
  DEFAULT_MAINTENANCE_QUERY,
  type MaintenanceItem,
  type MaintenanceQuery,
} from '@/features/dashboard/maintenance/lib/types';
import { useOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { propertySectionPath } from '@/features/dashboard/org/lib/tenantPaths';

import { AdminSurfaceCardHeader } from '@/components/shared/AdminSurfaceCardHeader';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ATTENTION_SEVERITY_STYLES } from '@/lib/statusToneColors';
import { cn } from '@/lib/utils';
import { formatIsoDate } from '@/utils/format/bookingDisplay';

const MAX_ROWS = 5;

type Props = {
  from: string;
  to: string;
  rangeLabel?: string;
  className?: string;
};

function buildQuery(from: string, to: string): MaintenanceQuery {
  return {
    ...DEFAULT_MAINTENANCE_QUERY,
    from,
    to,
    limit: 50,
    sort: 'date:asc',
  };
}

export function DashboardMaintenanceRemindersCard({ from, to, rangeLabel, className }: Props) {
  const { orgSlug, propertySlug } = useOrgContext();
  const query = useMemo(() => buildQuery(from, to), [from, to]);
  const summaryQuery = useMaintenanceSummary(query);
  const itemsQuery = useMaintenanceItems(query, { includeDueInRange: true });

  const summary = summaryQuery.data;
  const allPendingItems = useMemo(() => {
    const rows = itemsQuery.data ?? [];
    return [...rows]
      .filter((item) => !item.completed_at)
      .sort((a, b) => a.scheduled_on.localeCompare(b.scheduled_on));
  }, [itemsQuery.data]);

  const pendingItems = allPendingItems.slice(0, MAX_ROWS);
  const overflow = Math.max(0, allPendingItems.length - MAX_ROWS);

  const isLoading =
    (summaryQuery.isPending && !summary) || (itemsQuery.isPending && !itemsQuery.data);
  const isRefreshing = (summaryQuery.isFetching || itemsQuery.isFetching) && !isLoading;
  const maintenanceHref = `${propertySectionPath(orgSlug, propertySlug, 'maintenance')}?from=${from}&to=${to}`;
  const pending = summary?.pending ?? 0;
  const completed = summary?.completed ?? 0;

  return (
    <section
      className={cn(
        'surface-card flex min-h-0 min-w-0 flex-col overflow-hidden p-3 sm:p-4',
        className
      )}
      aria-label="Maintenance reminders"
    >
      <AdminSurfaceCardHeader
        icon={Wrench}
        title="Maintenance"
        description={rangeLabel ? `Reminders · ${rangeLabel}` : undefined}
        iconClassName="bg-muted/80"
        action={
          <Link
            to={maintenanceHref}
            className="text-primary hover:bg-primary/10 inline-flex min-h-[44px] items-center gap-1 rounded-lg px-2 text-sm font-semibold transition-colors"
          >
            View
            <ArrowRight className="size-4 shrink-0" aria-hidden />
          </Link>
        }
      />

      {!isLoading ? (
        <div className="mb-3 flex flex-wrap gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-semibold normal-case',
              pending > 0
                ? cn(ATTENTION_SEVERITY_STYLES.warning.chip, 'text-amber-900 dark:text-amber-100')
                : 'border-border/60 bg-muted/40 text-foreground'
            )}
          >
            <Clock3 className="size-3 shrink-0" aria-hidden />
            {pending} pending
          </span>
          <span className="border-border/60 bg-muted/40 text-foreground inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold">
            <CheckCircle2 className="text-muted-foreground size-3 shrink-0" aria-hidden />
            {completed} done
          </span>
        </div>
      ) : null}

      <div
        className={cn(
          'flex min-h-0 flex-1 flex-col transition-opacity duration-300',
          isRefreshing && 'opacity-60'
        )}
      >
        {isLoading ? (
          <div
            className="min-h-0 flex-1 space-y-2"
            aria-busy="true"
            aria-label="Loading maintenance"
          >
            <div className="mb-1 flex flex-wrap gap-2">
              <Skeleton className="h-7 w-20 rounded-full" />
              <Skeleton className="h-7 w-16 rounded-full" />
            </div>
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton
                key={i}
                className="h-14 w-full rounded-xl"
                style={{ opacity: 1 - i * 0.12 }}
              />
            ))}
          </div>
        ) : pendingItems.length === 0 ? (
          <div className="border-border/60 flex min-h-0 flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-10 text-center">
            <Wrench className="text-muted-foreground/70 size-8" aria-hidden />
            <p className="text-foreground text-sm font-semibold">No pending reminders</p>
            <p className="text-caption max-w-xs">
              {rangeLabel
                ? `Scheduled tasks for ${rangeLabel} will show here.`
                : 'Scheduled tasks for this period will show here.'}
            </p>
            <Button asChild variant="outline" size="sm" className="mt-1 min-h-[44px]">
              <Link to={maintenanceHref}>Add Reminder</Link>
            </Button>
          </div>
        ) : (
          <>
            <ul className="space-y-2">
              {pendingItems.map((item) => (
                <li key={item.id}>
                  <MaintenanceRow item={item} href={maintenanceHref} />
                </li>
              ))}
            </ul>
            {overflow > 0 ? (
              <Link
                to={maintenanceHref}
                className="border-border/60 bg-muted/30 text-primary hover:bg-primary/10 mt-3 flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors"
              >
                View all
                <span className="text-muted-foreground font-medium">(+{overflow} more)</span>
                <ArrowRight className="size-4 shrink-0" aria-hidden />
              </Link>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

function MaintenanceRow({ item, href }: { item: MaintenanceItem; href: string }) {
  return (
    <Link
      to={href}
      className="border-border/50 bg-muted/20 hover:bg-muted/35 flex min-h-[48px] items-start justify-between gap-2 rounded-xl border px-3 py-2.5 transition-colors"
    >
      <div className="min-w-0">
        <p className="text-foreground truncate text-sm font-semibold">{item.label}</p>
        {item.category ? <p className="text-caption mt-0.5 truncate">{item.category}</p> : null}
      </div>
      <span className="text-muted-foreground inline-flex shrink-0 items-center gap-1 text-[11px] font-medium tabular-nums">
        <Clock3 className="size-3 shrink-0" aria-hidden />
        {formatIsoDate(item.scheduled_on)}
      </span>
    </Link>
  );
}
