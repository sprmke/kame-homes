import { useMemo } from 'react';

import { useBookings } from '@/features/dashboard/bookings/hooks/useBookings';
import { DEFAULT_BOOKINGS_QUERY } from '@/features/dashboard/bookings/lib/types';
import { matchBookingForConversation } from '@/features/dashboard/inbox/lib/inboxMatchBooking';
import type { InboxConversation } from '@/features/dashboard/inbox/types/inbox';
import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';

export type InboxCrossPropertyMatch = {
  propertyId: string;
  propertySlug: string;
  propertyName: string;
};

/**
 * When a property has no Meta Page of its own, its Inbox falls back to the org's
 * shared connection — so a Facebook/Instagram thread here may really belong to a
 * different property in the org. Best-effort match against org-wide bookings
 * (excluding this property) so the host can jump to where this guest is likely
 * actually staying. Only fetches when the caller says it's worth checking
 * (Meta thread + org fallback active) to avoid an org-wide bookings query otherwise.
 */
export function useInboxCrossPropertyMatch(
  conversation: InboxConversation | null | undefined,
  enabled: boolean
): InboxCrossPropertyMatch | null {
  const currentPropertyId = usePropertyIdParam();

  const { data } = useBookings(
    { ...DEFAULT_BOOKINGS_QUERY, bookingKind: 'property', sort: 'check_in_date:desc', limit: 150 },
    { scope: 'org', enabled }
  );

  const otherPropertyBookings = useMemo(() => {
    if (!enabled) return [];
    return (data?.rows ?? []).filter(
      (row) => row.property_id && row.property_id !== currentPropertyId
    );
  }, [data?.rows, currentPropertyId, enabled]);

  return useMemo(() => {
    if (!enabled) return null;
    const match = matchBookingForConversation(conversation, otherPropertyBookings);
    if (!match?.property_id || !match.property_slug) return null;
    return {
      propertyId: match.property_id,
      propertySlug: match.property_slug,
      propertyName: match.property_name ?? 'another property',
    };
  }, [conversation, otherPropertyBookings, enabled]);
}
