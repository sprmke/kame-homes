import { useMemo } from 'react';

import { useBookings } from '@/features/dashboard/bookings/hooks/useBookings';
import { DEFAULT_BOOKINGS_QUERY } from '@/features/dashboard/bookings/lib/types';
import { matchBookingForConversation } from '@/features/dashboard/inbox/lib/inboxMatchBooking';
import type { InboxConversation } from '@/features/dashboard/inbox/types/inbox';

/** Best-effort booking row for the open inbox thread (inquiry dates + guest name). */
export function useInboxMatchedBooking(conversation: InboxConversation | null | undefined) {
  const { data, isLoading } = useBookings({
    ...DEFAULT_BOOKINGS_QUERY,
    bookingKind: 'property',
    sort: 'check_in_date:desc',
    // Include COMPLETED — stay-guide / review / SD links still apply after checkout.
    showCompletedBookings: true,
    // Wider window so older matching stays are not missed for Insert → Booking.
    // Aligned with `list-bookings` maxLimit (200).
    limit: 150,
  });

  const bookings = data?.rows ?? [];

  const booking = useMemo(
    () => matchBookingForConversation(conversation, bookings),
    [conversation, bookings]
  );

  return { booking, bookings, isLoading };
}
