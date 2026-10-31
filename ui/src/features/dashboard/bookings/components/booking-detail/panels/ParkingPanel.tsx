import { useState } from 'react';

import { Car, ChevronDown } from 'lucide-react';

import { DocPreview } from '@/features/dashboard/bookings/components/booking-detail/BookingDocPreview';
import { BookingDetailCard } from '@/features/dashboard/bookings/components/booking-detail/primitives/BookingDetailCard';
import {
  BookingDetailRow,
  BookingDetailRowBlock,
  BookingDetailRowGroup,
} from '@/features/dashboard/bookings/components/booking-detail/primitives/BookingDetailRow';
import { useLinkedParkingBooking } from '@/features/dashboard/bookings/hooks/useLinkedParkingBooking';
import type { BookingRow } from '@/features/dashboard/bookings/lib/types';

import { parkingStatusProperty } from '@/lib/parking/parkingFlowCopy';
import { sanitizeEmailSnapshotHtml } from '@/lib/sanitizeHtml';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/utils/format/currency';

type PreviewHandler = (label: string, rawUrl: string) => void;

/**
 * Phase 7 — once this stay is linked to a marketplace parking booking (guest self-served
 * instead of the legacy admin-broadcast flow), show the live match/host-contact view instead
 * of the legacy owner/rate fields below. Historical bookings with no link keep rendering
 * exactly as before.
 */
export function ParkingPanel({
  booking,
  onPreview,
}: {
  booking: BookingRow;
  onPreview: PreviewHandler;
}) {
  const linkedQuery = useLinkedParkingBooking(booking.id, booking.need_parking === true);
  const linked = linkedQuery.data?.linked === true ? linkedQuery.data : null;
  const [endorsementOpen, setEndorsementOpen] = useState(false);

  if (linked) {
    return (
      <BookingDetailCard title="Parking" icon={Car}>
        <BookingDetailRowGroup>
          <BookingDetailRow label="Status" value={parkingStatusProperty(linked.status)} />
          {linked.hostContact ? (
            <>
              <BookingDetailRow label="Host" value={linked.hostContact.name} />
              <BookingDetailRow label="Email" value={linked.hostContact.email} />
              {linked.hostContact.phone ? (
                <BookingDetailRow label="Phone" value={linked.hostContact.phone} />
              ) : null}
            </>
          ) : null}
          {linked.endorsementSendError && !linked.endorsementSentAt ? (
            <BookingDetailRow label="Endorsement" value="Send failed. Guest can retry" />
          ) : null}
        </BookingDetailRowGroup>
        {linked.endorsementSentAt && linked.endorsementEmailSnapshot ? (
          <BookingDetailRowBlock className="border-border/60 border-t pt-3">
            <button
              type="button"
              className="text-foreground flex min-h-[44px] w-full items-center justify-between gap-2 text-left text-sm font-medium"
              aria-expanded={endorsementOpen}
              onClick={() => setEndorsementOpen((open) => !open)}
            >
              Endorsement copy
              <ChevronDown
                className={cn(
                  'text-muted-foreground h-4 w-4 shrink-0 transition-transform',
                  endorsementOpen && 'rotate-180'
                )}
                aria-hidden
              />
            </button>
            {endorsementOpen ? (
              <div
                className="border-border/80 bg-muted/30 mt-2 max-h-64 overflow-y-auto rounded-lg border p-3 text-sm [&_*]:max-w-full"
                dangerouslySetInnerHTML={{
                  __html: sanitizeEmailSnapshotHtml(linked.endorsementEmailSnapshot),
                }}
              />
            ) : null}
          </BookingDetailRowBlock>
        ) : null}
      </BookingDetailCard>
    );
  }

  const vehicle = [booking.car_brand_model, booking.car_color].filter(Boolean).join(' · ');

  return (
    <BookingDetailCard title="Parking" icon={Car}>
      <BookingDetailRowGroup>
        <BookingDetailRow label="Plate" value={booking.car_plate_number} />
        <BookingDetailRow label="Vehicle" value={vehicle || undefined} />
        <BookingDetailRow label="Owner / agent" value={booking.parking_owner} />
        {booking.parking_rate_guest != null ? (
          <BookingDetailRow label="Guest rate" value={formatMoney(booking.parking_rate_guest)} />
        ) : null}
        {booking.parking_rate_paid != null ? (
          <BookingDetailRow label="Owner rate" value={formatMoney(booking.parking_rate_paid)} />
        ) : null}
      </BookingDetailRowGroup>
      {booking.parking_endorsement_url ? (
        <BookingDetailRowBlock className="border-border/60 border-t">
          <DocPreview
            label="Endorsement"
            url={booking.parking_endorsement_url}
            onPreview={onPreview}
          />
        </BookingDetailRowBlock>
      ) : null}
    </BookingDetailCard>
  );
}
