import { useBookingAiReview } from '@/features/dashboard/bookings/hooks/useBookingAiReview';
import {
  hasBookingAiReviewRun,
  isBookingAiReviewStale,
} from '@/features/dashboard/bookings/lib/bookingAiReviewProgress';
import type { BookingViewTab } from '@/features/dashboard/bookings/lib/resolveBookingViewTab';
import type { BookingRow } from '@/features/dashboard/bookings/lib/types';

import { SegmentedControl } from '@/components/ui/sliding-tabs';

export type { BookingViewTab };

type Props = {
  value: BookingViewTab;
  onChange: (tab: BookingViewTab) => void;
  booking: BookingRow;
};

/** Thin wrapper around `SegmentedControl` for the view-mode section tabs. */
export function BookingDetailTabs({ value, onChange, booking }: Props) {
  const { data: review } = useBookingAiReview(booking.id);
  const showAiSummary = hasBookingAiReviewRun(review);
  const aiSummaryStale = isBookingAiReviewStale(review);

  return (
    <SegmentedControl
      value={value}
      onChange={onChange}
      size="compact"
      aria-label="Booking detail sections"
      className="max-w-full"
      options={[
        ...(showAiSummary
          ? [
              {
                value: 'ai_summary' as const,
                label: aiSummaryStale ? (
                  <span className="inline-flex items-center gap-1.5">
                    AI Summary
                    <span className="bg-warning size-1.5 shrink-0 rounded-full" aria-hidden />
                  </span>
                ) : (
                  'AI Summary'
                ),
                ariaLabel: aiSummaryStale ? 'AI Summary, outdated' : 'AI Summary',
              },
            ]
          : []),
        // Value stays `overview` (route/state contract); the label names what it holds.
        { value: 'overview', label: 'Stay' },
        { value: 'guests', label: 'Guests' },
        ...(booking.need_parking ? [{ value: 'parking' as const, label: 'Parking' }] : []),
        ...(booking.has_pets ? [{ value: 'pets' as const, label: 'Pets' }] : []),
        ...(booking.status !== 'PENDING_REVIEW'
          ? [{ value: 'pricing' as const, label: 'Pricing' }]
          : []),
        { value: 'files', label: 'Files' },
      ]}
    />
  );
}
