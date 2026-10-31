import { adminTableBodyText } from '@/features/dashboard/bookings/components/AdminDataTable';

import { cn } from '@/lib/utils';
import { formatBookingDate, formatBookingDateShort } from '@/utils/format/bookingDisplay';

type Props = {
  checkInDate: string | null | undefined;
  checkOutDate?: string | null | undefined;
  numberOfNights?: number | null;
  className?: string;
};

/**
 * Stay column pattern shared by Bookings and Finance tables:
 * `Jun 3 → Jun 4, 2026` with `1 night` below.
 */
export function BookingStayDatesCell({
  checkInDate,
  checkOutDate,
  numberOfNights,
  className,
}: Props) {
  const nights =
    numberOfNights != null && Number.isFinite(numberOfNights) && numberOfNights > 0
      ? numberOfNights
      : null;

  return (
    <div className={cn('flex flex-col gap-1 whitespace-nowrap', className)}>
      <p className={cn('leading-snug', adminTableBodyText.primary)}>
        {formatBookingDateShort(checkInDate)}
        {checkOutDate ? (
          <>
            <span className="text-muted-foreground/50 mx-1.5 font-light">→</span>
            {formatBookingDate(checkOutDate)}
          </>
        ) : null}
      </p>
      {nights != null ? (
        <p className={cn('leading-snug', adminTableBodyText.secondary)}>
          {nights} {nights === 1 ? 'night' : 'nights'}
        </p>
      ) : null}
    </div>
  );
}
