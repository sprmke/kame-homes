import { Link } from 'react-router-dom';

import { ArrowRight, CalendarDays, ChevronRight } from 'lucide-react';

import { StatusBadge } from '@/features/dashboard/bookings/components/StatusBadge';
import {
  bookingDetailPath,
  orgBookingsPath,
  parkingBookingDetailPath,
} from '@/features/dashboard/org/lib/tenantPaths';
import type { DashboardRecentBooking } from '@/features/dashboard/property/lib/types';

import { AdminSurfaceCardHeader } from '@/components/shared/AdminSurfaceCardHeader';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/utils/format/currency';
import { formatStayDateRange } from '@/utils/format/dates';

function formatStayRange(checkInIso: string, checkOutIso: string): string {
  return formatStayDateRange(checkInIso, checkOutIso) ?? '';
}

function resourceName(booking: DashboardRecentBooking): string {
  if (booking.bookingKind === 'parking') {
    return booking.parkingName || 'Parking';
  }
  return booking.propertyName || 'Property';
}

function bookingHref(orgSlug: string, booking: DashboardRecentBooking): string | null {
  if (booking.bookingKind === 'parking' && booking.parkingSlug) {
    return parkingBookingDetailPath(orgSlug, booking.parkingSlug, booking.id);
  }
  if (booking.propertySlug) {
    return bookingDetailPath(orgSlug, booking.propertySlug, booking.id);
  }
  return null;
}

type Props = {
  orgSlug: string;
  bookings: DashboardRecentBooking[];
  rangeLabel?: string;
  className?: string;
};

export function OrgRecentBookingsList({ orgSlug, bookings, rangeLabel, className }: Props) {
  const viewAllHref = orgBookingsPath(orgSlug);

  return (
    <section
      className={cn(
        'surface-card flex h-full min-h-0 min-w-0 flex-col overflow-hidden p-3 sm:p-4',
        className
      )}
      aria-label="Recent bookings"
    >
      <AdminSurfaceCardHeader
        icon={CalendarDays}
        title="Recent Bookings"
        description={rangeLabel ? `Check-ins · ${rangeLabel}` : 'Check-ins in period'}
        iconClassName="bg-muted/80"
        action={
          <Link
            to={viewAllHref}
            className="text-primary hover:bg-primary/10 inline-flex min-h-[44px] items-center gap-1 rounded-lg px-2 text-sm font-semibold transition-colors"
          >
            View
            <ArrowRight className="size-4 shrink-0" aria-hidden />
          </Link>
        }
      />

      {bookings.length === 0 ? (
        <p className="text-muted-foreground flex flex-1 items-center justify-center py-8 text-center text-sm">
          No bookings in this period
        </p>
      ) : (
        <ul className="border-border/50 divide-border/50 divide-y overflow-hidden rounded-xl border">
          {bookings.map((booking) => {
            const detailPath = bookingHref(orgSlug, booking);
            const stayRange = formatStayRange(booking.checkInIso, booking.checkOutIso);
            const meta = [resourceName(booking), stayRange].filter(Boolean).join(' · ');

            const row = (
              <div className="hover:bg-muted/35 group flex min-h-[40px] items-center gap-2 px-3 py-2 transition-colors">
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
                  <p className="text-muted-foreground mt-0.5 truncate text-[10px] leading-snug sm:text-[11px]">
                    {meta}
                  </p>
                </div>
                <span className="text-foreground shrink-0 text-sm font-semibold tabular-nums">
                  {formatMoney(booking.amount)}
                </span>
                {detailPath ? (
                  <ChevronRight
                    className="text-muted-foreground size-3.5 shrink-0 opacity-50 transition-opacity group-hover:opacity-100 sm:size-4"
                    aria-hidden
                  />
                ) : null}
              </div>
            );

            return (
              <li key={booking.id}>
                {detailPath ? (
                  <Link to={detailPath} className="block min-w-0">
                    {row}
                  </Link>
                ) : (
                  row
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
