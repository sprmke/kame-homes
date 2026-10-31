import { Link } from 'react-router-dom';

import { AlertTriangle, ArrowRight, Bell, CalendarDays, ChevronRight } from 'lucide-react';

import { StatusBadge } from '@/features/dashboard/bookings/components/StatusBadge';
import { bookingDetailPath } from '@/features/dashboard/org/lib/tenantPaths';
import { resolvePropertyDashboardHref } from '@/features/dashboard/property/lib/resolvePropertyDashboardHref';
import type {
  DashboardAttentionItem,
  DashboardRecentBooking,
} from '@/features/dashboard/property/lib/types';

import { AdminSurfaceCardHeader } from '@/components/shared/AdminSurfaceCardHeader';
import { Skeleton } from '@/components/ui/skeleton';
import { ATTENTION_SEVERITY_STYLES } from '@/lib/statusToneColors';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/utils/format/currency';
import { formatStayDateRange } from '@/utils/format/dates';

const MAX_ITEMS = 5;

type Props = {
  items: DashboardAttentionItem[];
  /** Period check-ins — shown when attention is empty so the peer calendar cell stays filled. */
  recentBookings?: DashboardRecentBooking[];
  orgSlug: string;
  propertySlug: string;
  /** Period-scoped bookings list for “View”. */
  viewAllHref: string;
  rangeLabel?: string;
  isLoading?: boolean;
  className?: string;
};

function formatStayRange(checkInIso: string, checkOutIso: string): string {
  return formatStayDateRange(checkInIso, checkOutIso) ?? '';
}

function RecentBookingsBody({
  bookings,
  orgSlug,
  propertySlug,
}: {
  bookings: DashboardRecentBooking[];
  orgSlug: string;
  propertySlug: string;
}) {
  if (bookings.length === 0) {
    return (
      <div className="border-border/60 flex flex-1 flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed px-4 py-6 text-center">
        <CalendarDays className="text-muted-foreground/70 size-6" aria-hidden />
        <p className="text-foreground text-sm font-semibold">No bookings</p>
      </div>
    );
  }

  return (
    <ul className="border-border/50 divide-border/50 divide-y overflow-hidden rounded-xl border">
      {bookings.slice(0, MAX_ITEMS).map((booking) => {
        const detailPath = bookingDetailPath(orgSlug, propertySlug, booking.id);
        const stayRange = formatStayRange(booking.checkInIso, booking.checkOutIso);

        return (
          <li key={booking.id}>
            <Link
              to={detailPath}
              className="hover:bg-muted/35 group flex min-h-11 items-center gap-2 px-3 py-2 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="text-foreground min-w-0 truncate text-sm font-medium">
                    {booking.guestName}
                  </span>
                  <StatusBadge
                    status={booking.status}
                    className="hidden shrink-0 gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold sm:inline-flex"
                  />
                </div>
                {stayRange ? (
                  <p className="text-muted-foreground mt-0.5 truncate text-[11px] leading-snug">
                    {stayRange}
                  </p>
                ) : null}
              </div>
              <span className="text-foreground shrink-0 text-sm font-semibold tabular-nums">
                {formatMoney(booking.amount)}
              </span>
              <ChevronRight
                className="text-muted-foreground size-4 shrink-0 opacity-50 transition-opacity group-hover:opacity-100"
                aria-hidden
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function DashboardAttentionCard({
  items,
  recentBookings = [],
  orgSlug,
  propertySlug,
  viewAllHref,
  rangeLabel,
  isLoading,
  className,
}: Props) {
  const showRecent = !isLoading && items.length === 0;
  const criticalCount = items.filter((i) => i.severity === 'critical').length;
  const visibleItems = items.slice(0, MAX_ITEMS);
  const overflow = Math.max(0, items.length - MAX_ITEMS);

  return (
    <section
      className={cn(
        'surface-card flex min-h-0 min-w-0 flex-col overflow-hidden p-3 sm:p-4',
        className
      )}
      aria-label={showRecent ? 'Recent bookings' : 'Needs attention'}
    >
      <AdminSurfaceCardHeader
        icon={showRecent ? CalendarDays : Bell}
        title={showRecent ? 'Recent bookings' : 'Needs attention'}
        description={
          showRecent
            ? rangeLabel
              ? `Check-ins · ${rangeLabel}`
              : 'Check-ins in period'
            : 'Bookings & reviews'
        }
        iconClassName="bg-muted/80"
        action={
          !isLoading && (showRecent || items.length > 0) ? (
            <Link
              to={viewAllHref}
              className="text-primary hover:bg-primary/10 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-semibold transition-colors"
            >
              View
              <ArrowRight className="size-4 shrink-0" aria-hidden />
            </Link>
          ) : null
        }
      />

      {!isLoading && !showRecent && criticalCount > 0 ? (
        <div className="mb-3 flex flex-wrap gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-semibold',
              ATTENTION_SEVERITY_STYLES.critical.chip,
              'text-rose-800 dark:text-rose-200'
            )}
          >
            <AlertTriangle className="size-3 shrink-0" aria-hidden />
            {criticalCount} urgent
          </span>
          {items.length > criticalCount ? (
            <span className="border-border/60 bg-muted/40 text-foreground inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tabular-nums">
              {items.length - criticalCount} more
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col">
        {isLoading ? (
          <div
            className="border-border/50 overflow-hidden rounded-xl border"
            aria-busy="true"
            aria-label={showRecent ? 'Loading recent bookings' : 'Loading attention items'}
          >
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={cn('px-3 py-2.5', i > 0 && 'border-border/50 border-t')}>
                <Skeleton className="h-4 w-full" style={{ opacity: 1 - i * 0.1 }} />
              </div>
            ))}
          </div>
        ) : showRecent ? (
          <RecentBookingsBody
            bookings={recentBookings}
            orgSlug={orgSlug}
            propertySlug={propertySlug}
          />
        ) : (
          <>
            <ul className="border-border/50 divide-border/50 divide-y overflow-hidden rounded-xl border">
              {visibleItems.map((item) => {
                const style = ATTENTION_SEVERITY_STYLES[item.severity];
                return (
                  <li key={item.id}>
                    <Link
                      to={resolvePropertyDashboardHref(item.href, orgSlug, propertySlug)}
                      className="hover:bg-muted/35 group flex min-h-11 items-center gap-2.5 px-3 py-2 transition-colors"
                    >
                      <span className={cn('size-2 shrink-0 rounded-full', style.dot)} aria-hidden />
                      <span className="text-foreground min-w-0 flex-1 truncate text-sm font-medium">
                        {item.label}
                      </span>
                      {item.count != null ? (
                        <span
                          className={cn('shrink-0 text-sm font-bold tabular-nums', style.count)}
                        >
                          {item.count}
                        </span>
                      ) : (
                        <ChevronRight
                          className="text-muted-foreground size-4 shrink-0 opacity-50 transition-opacity group-hover:opacity-100"
                          aria-hidden
                        />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>

            {overflow > 0 ? (
              <Link
                to={viewAllHref}
                className="border-border/60 bg-muted/30 text-primary hover:bg-primary/10 mt-3 flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors"
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
