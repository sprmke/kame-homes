import { Calendar, ChevronDown, Edit2, PencilLine, Users, X } from 'lucide-react';

import { BookingDetailActionsMenu } from '@/features/dashboard/bookings/components/booking-detail/BookingDetailActionsMenu';
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
  detailsExpanded: boolean;
  onToggleDetails: () => void;
  editMode?: boolean;
  onEdit?: () => void;
  onCancelEdit?: () => void;
  /** Secondary actions (parking / pets / pay parking) — same set as the desktop header. */
  actions?: BookingDetailAction[];
  className?: string;
};

/**
 * Compact booking strip for mobile detail.
 * Keeps workflow (Progress) above the fold; expanded panel shows Actions + tabs.
 */
export function BookingDetailMobileSummary({
  booking,
  detailsExpanded,
  onToggleDetails,
  editMode = false,
  onEdit,
  onCancelEdit,
  actions = [],
  className,
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
  const source = booking.booking_source?.trim() || 'Direct';
  const isAirbnb = source === 'Airbnb';

  return (
    <section
      className={cn(
        'surface-card border-border/80 rounded-2xl border p-3 sm:p-4',
        editMode &&
          'border-primary/40 bg-primary/5 ring-primary/30 ring-offset-background ring-2 ring-offset-2',
        className
      )}
      aria-label={editMode ? 'Editing booking summary' : 'Booking summary'}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {editMode ? (
          <span className="bg-primary/15 text-primary inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
            <PencilLine className="size-3" aria-hidden />
            Editing
          </span>
        ) : null}
        {/* h2 — the phone brand hero ("Booking") owns the page h1. */}
        <h2 className="text-foreground min-w-0 break-words text-base font-bold leading-tight">
          {heading}
        </h2>
        {!editMode ? <StatusBadge status={booking.status} /> : null}
        {!editMode ? (
          <span
            className={cn(
              'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
              isAirbnb ? toneBadgeClasses('orange') : 'border-primary/25 bg-primary/10 text-primary'
            )}
          >
            {source}
          </span>
        ) : null}
      </div>
      {fb && primary && fb.toLowerCase() !== primary.toLowerCase() && (
        <p className="text-muted-foreground mt-0.5 truncate text-[11px] font-medium">{primary}</p>
      )}

      <p className="text-muted-foreground mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
        <span className="inline-flex min-w-0 items-center gap-1">
          <Calendar className="size-3.5 shrink-0 opacity-70" aria-hidden />
          <span className="min-w-0 break-words">
            {formatBookingDate(booking.check_in_date)}
            <span className="text-muted-foreground/50 mx-0.5" aria-hidden>
              →
            </span>
            {formatBookingDate(booking.check_out_date)}
          </span>
        </span>
        <span className="inline-flex items-center gap-1">
          <Users className="size-3.5 shrink-0 opacity-70" aria-hidden />
          {pax} pax · {nights} {nights === 1 ? 'night' : 'nights'}
        </span>
      </p>

      <div className="mt-3 space-y-2">
        {!editMode ? (
          <button
            type="button"
            onClick={onToggleDetails}
            aria-expanded={detailsExpanded}
            aria-controls="booking-detail-full-panel"
            className={cn(
              'flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg px-3 text-[13px] font-semibold transition-all duration-200',
              detailsExpanded
                ? 'border-border bg-muted/50 text-foreground hover:bg-muted border'
                : 'border-sidebar-primary/30 bg-sidebar-primary/5 text-sidebar-primary hover:bg-sidebar-primary/10 border'
            )}
          >
            <span>{detailsExpanded ? 'Hide' : 'Details'}</span>
            <ChevronDown
              className={cn(
                'size-4 shrink-0 transition-transform duration-300 ease-out motion-reduce:transition-none',
                detailsExpanded && 'rotate-180'
              )}
              aria-hidden
            />
          </button>
        ) : null}

        {editMode ? (
          <button
            type="button"
            onClick={onCancelEdit}
            aria-label="Cancel editing and return to view"
            className="border-border bg-card text-muted-foreground hover:bg-muted/50 inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-lg border px-4 text-[13px] font-semibold shadow-sm transition-colors"
          >
            <X className="size-4 shrink-0" aria-hidden />
            Cancel
          </button>
        ) : (
          detailsExpanded && (
            <div className="flex items-stretch gap-2">
              {onEdit ? (
                <Button
                  type="button"
                  onClick={onEdit}
                  size="sm"
                  className="min-h-[44px] flex-1 gap-1.5 rounded-lg text-[13px] font-semibold"
                >
                  <Edit2 className="size-4 shrink-0" aria-hidden />
                  Edit booking
                </Button>
              ) : null}
              <BookingDetailActionsMenu actions={actions} />
            </div>
          )
        )}
      </div>
    </section>
  );
}
