import { useMemo } from 'react';

import {
  guestCalendarPath,
  guestFormPath,
  guestMessagesPreviewPath,
  guestPropertyPath,
  guestReviewPath,
  guestSdFormPath,
} from '@/features/guest/lib/guestPublicPaths';

import { useBookingDocumentShareLink } from '@/features/dashboard/bookings/hooks/useBookingDocumentShareLink';
import { useBookingParkingShareLink } from '@/features/dashboard/bookings/hooks/useBookingParkingShareLink';
import { useBookingStayGuideLink } from '@/features/dashboard/bookings/hooks/useBookingStayGuideLink';
import { useOwnerDefaultParking } from '@/features/dashboard/bookings/hooks/useOwnerDefaultParking';
import { isStayGuideEligibleStatus } from '@/features/dashboard/bookings/lib/bookingStatus';
import type { BookingRow } from '@/features/dashboard/bookings/lib/types';

export type InboxShareRow = {
  key: string;
  label: string;
  url: string;
  pending?: boolean;
};

const SD_FORM_ELIGIBLE_STATUSES = new Set(['READY_FOR_CHECKOUT', 'PENDING_SD_REFUND', 'COMPLETED']);

export function useInboxPropertyShareRows(propertySlug: string): InboxShareRow[] {
  return useMemo(
    () => [
      {
        key: 'property',
        label: 'Property page',
        url: `${window.location.origin}${guestPropertyPath(propertySlug)}`,
      },
      {
        key: 'calendar',
        label: 'Calendar',
        url: `${window.location.origin}${guestCalendarPath(propertySlug)}`,
      },
      {
        key: 'form',
        label: 'Guest form',
        url: `${window.location.origin}${guestFormPath(propertySlug)}`,
      },
      {
        key: 'messages',
        label: 'Chat with host',
        url: `${window.location.origin}${guestMessagesPreviewPath(propertySlug)}`,
      },
    ],
    [propertySlug]
  );
}

export function useInboxBookingShareRows(
  propertySlug: string,
  selectedBooking: BookingRow | null
): InboxShareRow[] {
  const stayGuideLink = useBookingStayGuideLink(selectedBooking);
  const gafLink = useBookingDocumentShareLink(selectedBooking, 'gaf');
  const petLink = useBookingDocumentShareLink(selectedBooking, 'pet');
  const ownerDefaultQuery = useOwnerDefaultParking(selectedBooking?.id);
  const parkingShare = useBookingParkingShareLink(selectedBooking, ownerDefaultQuery.data);

  return useMemo(() => {
    if (!selectedBooking) return [];
    const rows: InboxShareRow[] = [];

    // Stay guide is Pro+ (`propertyShowcase`): no share row the guest could not open.
    if (isStayGuideEligibleStatus(selectedBooking.status) && !stayGuideLink.locked) {
      rows.push({
        key: 'stay-guide',
        label: 'Stay Guide',
        url: stayGuideLink.url,
        pending: stayGuideLink.pending,
      });
    }
    if (selectedBooking.approved_gaf_pdf_url) {
      rows.push({
        key: 'gaf',
        label: 'Approved GAF',
        url: gafLink.url,
        pending: gafLink.pending,
      });
    }
    if (selectedBooking.approved_pet_pdf_url) {
      rows.push({
        key: 'pet',
        label: 'Approved Pet Form',
        url: petLink.url,
        pending: petLink.pending,
      });
    }
    if (selectedBooking.parking_endorsement_url) {
      rows.push({
        key: 'parking-endorsement',
        label: 'Parking Endorsement',
        url: selectedBooking.parking_endorsement_url,
      });
    }
    if (selectedBooking.need_parking && !(Number(selectedBooking.parking_rate_paid) > 0)) {
      rows.push({
        key: 'find-parking',
        label: parkingShare.isOwnDefault ? 'Use your parking' : 'Find parking',
        url: parkingShare.url,
        pending: ownerDefaultQuery.isLoading,
      });
    }
    if (SD_FORM_ELIGIBLE_STATUSES.has(String(selectedBooking.status))) {
      rows.push({
        key: 'sd-form',
        label: 'Security Deposit Refund',
        url: `${window.location.origin}${guestSdFormPath(propertySlug, selectedBooking.id)}`,
      });
    }
    if (selectedBooking.status === 'COMPLETED') {
      rows.push({
        key: 'review',
        label: 'Leave a Review',
        url: `${window.location.origin}${guestReviewPath(propertySlug, selectedBooking.id)}`,
      });
    }

    return rows;
  }, [
    selectedBooking,
    propertySlug,
    stayGuideLink,
    gafLink,
    petLink,
    parkingShare,
    ownerDefaultQuery.isLoading,
  ]);
}
