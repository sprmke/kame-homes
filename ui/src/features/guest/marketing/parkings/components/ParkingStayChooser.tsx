import { Building2, ChevronRight, PenLine } from 'lucide-react';

import type { LinkableParkingBooking } from '@/features/guest/marketing/parkings/hooks/useLinkableParkingBookings';
import {
  PARKING_MANUAL_BOOKING_OPTION_LABEL,
  PARKING_STAY_CHOOSER_TITLE,
} from '@/features/guest/marketing/parkings/lib/parkingRequestEntryCopy';

import { formatParkingStayRange } from '@/utils/format/parkingStayDisplay';

type Props = {
  bookings: LinkableParkingBooking[];
  onSelectStay: (bookingId: string) => void;
  onSelectManual: () => void;
};

function stayMeta(booking: LinkableParkingBooking): string {
  const range = formatParkingStayRange(booking.checkInDate, booking.checkOutDate);
  const unit = booking.towerAndUnitNumber?.trim();
  return [range, unit].filter(Boolean).join(' · ');
}

export function ParkingStayChooser({ bookings, onSelectStay, onSelectManual }: Props) {
  return (
    <div className="space-y-4">
      <h2 className="text-foreground text-base font-semibold tracking-tight">
        {PARKING_STAY_CHOOSER_TITLE}
      </h2>

      <ul className="space-y-2" role="list">
        {bookings.map((booking) => {
          const name = booking.propertyName?.trim() || 'Your stay';
          const meta = stayMeta(booking);
          return (
            <li key={booking.id}>
              <button
                type="button"
                onClick={() => onSelectStay(booking.id)}
                className="border-border/80 hover:border-primary/40 hover:bg-muted/40 focus-visible:ring-ring flex w-full cursor-pointer items-center gap-3 rounded-xl border bg-white px-4 py-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              >
                <span className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
                  <Building2 className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-foreground block truncate text-sm font-semibold">
                    {name}
                  </span>
                  {meta ? (
                    <span className="text-muted-foreground mt-0.5 block truncate text-xs">
                      {meta}
                    </span>
                  ) : null}
                </span>
                <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
              </button>
            </li>
          );
        })}

        <li>
          <button
            type="button"
            onClick={onSelectManual}
            className="border-border/80 hover:border-primary/40 hover:bg-muted/40 focus-visible:ring-ring flex w-full cursor-pointer items-center gap-3 rounded-xl border border-dashed bg-transparent px-4 py-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          >
            <span className="bg-muted text-muted-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
              <PenLine className="h-4 w-4" aria-hidden />
            </span>
            <span className="text-foreground min-w-0 flex-1 text-sm font-medium">
              {PARKING_MANUAL_BOOKING_OPTION_LABEL}
            </span>
            <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
          </button>
        </li>
      </ul>
    </div>
  );
}
