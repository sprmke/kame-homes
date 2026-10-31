import { Calendar, Edit2, Users } from 'lucide-react';

import { BookingDetailActionsMenu } from '@/features/dashboard/bookings/components/booking-detail/BookingDetailActionsMenu';
import { BookingDetailShellHeader } from '@/features/dashboard/bookings/components/booking-detail/primitives/BookingDetailShell';
import { occupiedNightsFromStay } from '@/features/dashboard/bookings/components/calendar/calendarStayAmounts';
import { StatusBadge } from '@/features/dashboard/bookings/components/StatusBadge';
import type { BookingDetailAction } from '@/features/dashboard/bookings/lib/bookingDetailActions';
import type { BookingRow } from '@/features/dashboard/bookings/lib/types';

import { Button } from '@/components/ui/button';
import { toneBadgeClasses } from '@/lib/statusToneColors';
import { cn } from '@/lib/utils';
import { formatBookingDate } from '@/utils/format/bookingDisplay';

type Props = {
  booking: BookingRow;
  onEdit: () => void;
  /** Secondary actions (parking / pets / pay parking) behind one overflow trigger. */
  actions: BookingDetailAction[];
  className?: string;
  canEdit?: boolean;
};

/** View-mode header — booking identity plus the page's single primary action. */
export function BookingDetailHeader({
  booking,
  onEdit,
  actions,
  className,
  canEdit = true,
}: Props) {
  const pax = (booking.number_of_adults ?? 0) + (booking.number_of_children ?? 0);
  const nights = occupiedNightsFromStay(
    booking.check_in_date,
    booking.check_out_date,
    booking.number_of_nights
  );
  const fb = booking.guest_facebook_name?.trim() ?? '';
  const primary = booking.primary_guest_name?.trim() ?? '';
  const heading = fb || primary || 'Booking';
  const showPrimarySubtitle = Boolean(fb && primary && fb.toLowerCase() !== primary.toLowerCase());
  const source = booking.booking_source?.trim() || 'Direct';
  const isAirbnb = source === 'Airbnb';

  return (
    <BookingDetailShellHeader as="header" className={className}>
      <div
        data-booking-detail-header
        className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-5"
      >
        <div className="min-w-0 space-y-1.5">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
            <h1 className="text-foreground min-w-0 break-words text-lg font-bold leading-tight tracking-tight sm:text-xl md:text-2xl">
              {heading}
            </h1>
            <StatusBadge status={booking.status} />
            <span
              className={cn(
                'inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                isAirbnb
                  ? toneBadgeClasses('orange')
                  : 'border-primary/25 bg-primary/10 text-primary'
              )}
            >
              {source}
            </span>
          </div>

          {showPrimarySubtitle ? (
            <p className="text-muted-foreground truncate text-sm font-medium">{primary}</p>
          ) : null}

          <p className="text-muted-foreground flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium">
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <Calendar className="size-3.5 shrink-0 opacity-70" aria-hidden />
              <span className="min-w-0 [overflow-wrap:anywhere]">
                {formatBookingDate(booking.check_in_date)}
                <span className="text-muted-foreground/50 mx-1" aria-hidden>
                  →
                </span>
                {formatBookingDate(booking.check_out_date)}
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-3.5 shrink-0 opacity-70" aria-hidden />
              {pax} pax · {nights} {nights === 1 ? 'night' : 'nights'}
            </span>
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {canEdit ? (
            <Button
              type="button"
              size="sm"
              onClick={onEdit}
              className="h-11 min-h-[44px] flex-1 gap-1.5 text-[13px] sm:flex-none lg:h-9 lg:min-h-0"
            >
              <Edit2 className="size-4 shrink-0" aria-hidden />
              Edit booking
            </Button>
          ) : null}
          <BookingDetailActionsMenu actions={actions} />
        </div>
      </div>
    </BookingDetailShellHeader>
  );
}
