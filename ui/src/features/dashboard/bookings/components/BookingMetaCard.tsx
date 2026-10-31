import { Info } from 'lucide-react';

import { BookingDetailCard } from '@/features/dashboard/bookings/components/booking-detail/primitives/BookingDetailCard';
import {
  BookingDetailRow,
  BookingDetailRowGroup,
} from '@/features/dashboard/bookings/components/booking-detail/primitives/BookingDetailRow';
import { InlineCopyIconButton } from '@/features/dashboard/bookings/components/InlineCopyIconButton';
import type { BookingRow } from '@/features/dashboard/bookings/lib/types';

import { formatRelative } from '@/utils/format/bookingDisplay';

type Props = {
  booking: BookingRow;
  onCopyBookingId: () => void;
  className?: string;
};

export function BookingMetaCard({ booking, onCopyBookingId, className }: Props) {
  return (
    <BookingDetailCard title="Booking meta" icon={Info} className={className}>
      <BookingDetailRowGroup>
        <BookingDetailRow label="Booking ID">
          <span className="inline-flex max-w-full flex-wrap items-baseline justify-end gap-x-1 gap-y-0.5 text-right">
            <span className="text-muted-foreground break-all font-mono text-[11px]">
              {booking.id}
            </span>
            <InlineCopyIconButton
              aria-label="Copy booking ID to clipboard"
              onClick={onCopyBookingId}
            />
          </span>
        </BookingDetailRow>
        <BookingDetailRow label="Created" value={formatRelative(booking.created_at)} />
        {booking.updated_at ? (
          <BookingDetailRow label="Updated" value={formatRelative(booking.updated_at)} />
        ) : null}
      </BookingDetailRowGroup>
    </BookingDetailCard>
  );
}
