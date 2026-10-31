/**
 * Guest success-page parking CTA — prefer org-owned default form when available.
 */

import { useQuery } from '@tanstack/react-query';

import {
  guestParkingFindPath,
  guestParkingOwnDefaultPath,
} from '@/features/guest/lib/guestPublicPaths';
import { fetchPayParking } from '@/features/guest/pay-parking/lib/api';

export function useGuestParkingSuccessHref(
  bookingId: string | null | undefined,
  needParking: boolean
): string {
  const id = (bookingId ?? '').trim();
  const query = useQuery({
    queryKey: ['guest-parking-success-href', id],
    queryFn: () => fetchPayParking(id),
    enabled: needParking && id.length > 0,
    staleTime: 60_000,
    retry: false,
  });

  if (!needParking) return '/parkings';
  if (!id) return '/parkings';

  const ownSlug = query.data?.owner_default_parking_slug?.trim();
  if (ownSlug) {
    return guestParkingOwnDefaultPath({
      parkingSlug: ownSlug,
      bookingId: id,
      checkInDate: query.data?.owner_default_check_in,
      checkOutDate: query.data?.owner_default_check_out,
    });
  }

  return guestParkingFindPath({
    bookingId: id,
    locationSlug: query.data?.city_location_slug,
  });
}
