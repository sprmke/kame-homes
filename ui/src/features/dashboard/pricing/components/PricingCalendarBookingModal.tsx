import { useNavigate } from 'react-router-dom';

import { CalendarDayBookingCard } from '@/features/dashboard/bookings/components/calendar/CalendarDayBookingCard';
import { useOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { bookingDetailPath } from '@/features/dashboard/org/lib/tenantPaths';
import type { PropertyPricingCalendarBooking } from '@/features/dashboard/pricing/lib/propertyPricingApi';

import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';

type Props = {
  booking: PropertyPricingCalendarBooking | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Saved booking_rate, or property default stay total when unset. */
  displayAmount?: number | null;
};

export function PricingCalendarBookingModal({ booking, open, onOpenChange, displayAmount }: Props) {
  const navigate = useNavigate();
  const { orgSlug, propertySlug } = useOrgContext();

  if (!booking) return null;

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent
        sheetLayout="split"
        className="max-w-[min(calc(100vw-1.5rem),24rem)] gap-0 overflow-hidden !p-0"
      >
        <ResponsiveModalHeader className="border-border/60 space-y-0 border-b px-4 py-3 pr-14 text-left sm:px-5">
          <ResponsiveModalTitle className="flex min-h-[44px] items-center text-base font-semibold leading-none sm:text-lg">
            Booking Details
          </ResponsiveModalTitle>
        </ResponsiveModalHeader>
        <div className="p-2 sm:p-3">
          <CalendarDayBookingCard
            row={booking}
            amount={{
              mode: 'booking_rate',
              amount: displayAmount ?? booking.booking_rate,
            }}
            onOpen={() => {
              onOpenChange(false);
              navigate(bookingDetailPath(orgSlug, propertySlug, booking.id));
            }}
          />
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
