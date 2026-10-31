import { PawPrint } from 'lucide-react';

import { DocPreview } from '@/features/dashboard/bookings/components/booking-detail/BookingDocPreview';
import { BookingDetailCard } from '@/features/dashboard/bookings/components/booking-detail/primitives/BookingDetailCard';
import {
  BookingDetailRow,
  BookingDetailRowBlock,
  BookingDetailRowGroup,
} from '@/features/dashboard/bookings/components/booking-detail/primitives/BookingDetailRow';
import type { BookingRow } from '@/features/dashboard/bookings/lib/types';

import { formatBookingDate } from '@/utils/format/bookingDisplay';
import { formatMoney } from '@/utils/format/currency';

type PreviewHandler = (label: string, rawUrl: string) => void;

export function PetsPanel({
  booking,
  onPreview,
}: {
  booking: BookingRow;
  onPreview: PreviewHandler;
}) {
  return (
    <BookingDetailCard title="Pet information" icon={PawPrint}>
      <BookingDetailRowGroup>
        <BookingDetailRow label="Pet name" value={booking.pet_name} />
        <BookingDetailRow label="Type" value={booking.pet_type} />
        <BookingDetailRow label="Breed" value={booking.pet_breed} />
        <BookingDetailRow label="Age" value={booking.pet_age} />
        <BookingDetailRow
          label="Vaccination date"
          value={formatBookingDate(booking.pet_vaccination_date)}
        />
        {booking.pet_fee != null ? (
          <BookingDetailRow label="Pet fee" value={formatMoney(booking.pet_fee)} />
        ) : null}
      </BookingDetailRowGroup>
      {(booking.pet_image_url || booking.pet_vaccination_url || booking.approved_pet_pdf_url) && (
        <BookingDetailRowBlock className="border-border/60 border-t">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {booking.pet_image_url ? (
              <DocPreview label="Pet photo" url={booking.pet_image_url} onPreview={onPreview} />
            ) : null}
            {booking.pet_vaccination_url ? (
              <DocPreview
                label="Vaccination record"
                url={booking.pet_vaccination_url}
                onPreview={onPreview}
              />
            ) : null}
            {booking.approved_pet_pdf_url ? (
              <DocPreview
                label="Approved pet form"
                url={booking.approved_pet_pdf_url}
                onPreview={onPreview}
              />
            ) : null}
          </div>
        </BookingDetailRowBlock>
      )}
    </BookingDetailCard>
  );
}
